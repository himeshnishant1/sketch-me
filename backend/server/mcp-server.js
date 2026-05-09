import cors from 'cors'
import express from 'express'
import { GoogleGenerativeAI } from '@google/generative-ai'
import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
// Prefer server/.env (next to this file); cwd may be repo root so plain dotenv.config() misses it.
dotenv.config({ path: path.join(__dirname, '.env') })
if (!process.env.GOOGLE_API_KEY) {
  dotenv.config({ path: path.join(__dirname, '..', '.env') })
}

const app = express()
const PORT = process.env.MCP_PORT || 4000
const API_KEY = process.env.GOOGLE_API_KEY || ''
/** Optional override; if unset or invalid for your key, we auto-pick from ListModels. */
const GEMINI_MODEL_ENV = (process.env.GEMINI_MODEL || '').replace(/^models\//, '')
const genAI = API_KEY ? new GoogleGenerativeAI(API_KEY) : null

const MODEL_PICK_CACHE_MS = 5 * 60 * 1000
let resolvedModelCache = { id: null, expiresAt: 0 }

function modelIdForSdk(fullName) {
  if (!fullName || typeof fullName !== 'string') return ''
  return fullName.startsWith('models/') ? fullName.slice('models/'.length) : fullName
}

function supportsGenerateContent(model) {
  return (
    Array.isArray(model?.supportedGenerationMethods) &&
    model.supportedGenerationMethods.includes('generateContent')
  )
}

async function listGeminiModels(signal) {
  const listUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(API_KEY)}`
  const listResp = await fetch(listUrl, { signal })
  const listData = await listResp.json()
  if (!listResp.ok) {
    const detail = listData?.error?.message || 'Unable to list Gemini models.'
    throw new Error(detail)
  }
  return Array.isArray(listData?.models) ? listData.models : []
}

function pickGenerativeModelId(models) {
  const capable = models.filter(supportsGenerateContent)

  if (GEMINI_MODEL_ENV) {
    const requested = capable.find((m) => modelIdForSdk(m.name) === GEMINI_MODEL_ENV)
    if (requested) return modelIdForSdk(requested.name)
  }

  const preferred = capable.find(
    (m) => /flash/i.test(m.name || '') && !/exp|preview/i.test(m.name || ''),
  )
  if (preferred?.name) return modelIdForSdk(preferred.name)

  const fallback = capable[0]
  if (fallback?.name) return modelIdForSdk(fallback.name)

  throw new Error(
    'No Gemini model with generateContent support is available for this API key. Enable Generative Language API and check billing.',
  )
}

async function getResolvedModelId(signal) {
  if (resolvedModelCache.id && Date.now() < resolvedModelCache.expiresAt) {
    return resolvedModelCache.id
  }
  const models = await listGeminiModels(signal)
  const id = pickGenerativeModelId(models)
  resolvedModelCache = { id, expiresAt: Date.now() + MODEL_PICK_CACHE_MS }
  return id
}

const ALLOWED_BLOCK_TYPES = new Set([
  'Page',
  'Section',
  'Container',
  'Columns',
  'Divider',
  'Navbar',
  'Footer',
  'Span',
  'Heading',
  'Text',
  'Image',
  'Button',
  'Input',
  'TextField',
  'TextArea',
  'Select',
  'Option',
  'Checkbox',
  'Radio',
  'Label',
  'Form',
])

const LEAF_TYPES = new Set([
  'Span',
  'Image',
  'Divider',
  'Input',
  'TextField',
  'TextArea',
  'Checkbox',
  'Radio',
  'Option',
])
const STATE_STYLE_KEYS = new Set(['hover', 'focus', 'active', 'disabled', 'visited'])
const META_KEYS = new Set([
  'createdAt',
  'updatedAt',
  'authorId',
  'role',
  'headingLevel',
  'href',
  'src',
  'alt',
])

const PAGE_TREE_RULEBOOK = `Document shape:
- Output must be one JSON object (the page tree), parseable by JSON.parse. No markdown, no comments.
- The root node must have "type": "Page". A nested node must never use type "Page".

Every node required fields:
- id: non-empty unique string.
- type: non-empty string and one of: Page, Section, Container, Columns, Divider, Navbar, Footer, Span, Heading, Text, Image, Button, Input, TextField, TextArea, Select, Option, Checkbox, Radio, Label, Form.
- props: object (use {} if empty).
- styles: object (use {} if empty); style values must be string or number. Pseudo style blocks hover/focus/active/disabled/visited are allowed as nested style objects.
- children: array (use [] for leaves); each child must be a full node object.

Optional fields:
- responsive: object with optional mobile/tablet/desktop objects; style value must be string or number.
- meta: object with optional keys createdAt, updatedAt, authorId, role, headingLevel, href, src, alt.
- locked and hidden: booleans.

Nesting:
- Span, Image, Divider, Input, TextField, TextArea, Checkbox, Radio, Option must have children: [].
- Page, Section, Container, Columns, Navbar, Footer, Heading, Text, Button, Select, Label, Form may contain children.
- Do not place meaningful blocks under Span, Image, Divider.

Visible text:
- Put visible text in Span nodes via props.text (string), children must be [].
- For Heading/Text/Button prefer Span children over props.text/props.label.
- If Button has children, prefer link in meta.href.
- For Image prefer meta.src and meta.alt.

Special rules:
- Heading should use meta.headingLevel in 1..6.
- Navbar must not use props.brand.
- Footer must not use props.note.

Return JSON only.`

const PAGE_TREE_PATCH_RULEBOOK = `OBJECTIVE
Replace full JSON regeneration with ID-based PATCH operations.

PATCH FORMAT (REQUIRED)
Always use:
{
  "updates": [],
  "adds": [],
  "deletes": [],
  "moves": []
}
Return all fields even if empty.

OPERATIONS
UPDATE:
{
  "id": "node-id",
  "props": {},
  "styles": {},
  "responsive": {}
}
Merge only provided fields.
styles may include hover/focus/active/disabled/visited nested style objects.

ADD:
{
  "parentId": "parent-id",
  "position": "start" | "end" | number,
  "node": { full node }
}
Node must include id, type, children. ID must be unique.

DELETE:
{
  "id": "node-id"
}
Removes node and children.

MOVE:
{
  "id": "node-id",
  "newParentId": "parent-id",
  "position": "start" | "end" | number
}

RULES
- Never regenerate full tree.
- Never change IDs unnecessarily.
- Modify only required nodes.
- Keep structure intact.
- Prefer update over delete+add.

OUTPUT
Return only PATCH object. No explanation.`

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function isStyleObject(value) {
  if (!isPlainObject(value)) return false
  return Object.entries(value).every(([key, v]) => {
    if (typeof v === 'string' || typeof v === 'number') return true
    if (STATE_STYLE_KEYS.has(key)) return isStyleObject(v)
    return false
  })
}

function validatePageTreeNode(node, pathLabel, seenIds, isRoot, errors) {
  if (!isPlainObject(node)) {
    errors.push(`${pathLabel}: node must be an object`)
    return
  }

  if (typeof node.id !== 'string' || !node.id.trim()) {
    errors.push(`${pathLabel}: id must be a non-empty string`)
  } else if (seenIds.has(node.id)) {
    errors.push(`${pathLabel}: duplicate id "${node.id}"`)
  } else {
    seenIds.add(node.id)
  }

  if (typeof node.type !== 'string' || !node.type.trim()) {
    errors.push(`${pathLabel}: type must be a non-empty string`)
  } else if (!ALLOWED_BLOCK_TYPES.has(node.type)) {
    errors.push(`${pathLabel}: unsupported type "${node.type}"`)
  }

  if (isRoot && node.type !== 'Page') {
    errors.push(`${pathLabel}: root type must be "Page"`)
  }
  if (!isRoot && node.type === 'Page') {
    errors.push(`${pathLabel}: nested nodes cannot have type "Page"`)
  }

  if (!isPlainObject(node.props)) {
    errors.push(`${pathLabel}: props must be an object`)
  }
  if (!isStyleObject(node.styles)) {
    errors.push(`${pathLabel}: styles must be an object with string/number values`)
  }
  if (!Array.isArray(node.children)) {
    errors.push(`${pathLabel}: children must be an array`)
  }

  if (node.responsive !== undefined) {
    if (!isPlainObject(node.responsive)) {
      errors.push(`${pathLabel}: responsive must be an object`)
    } else {
      for (const bp of ['mobile', 'tablet', 'desktop']) {
        if (node.responsive[bp] !== undefined && !isStyleObject(node.responsive[bp])) {
          errors.push(`${pathLabel}: responsive.${bp} must be an object with string/number values`)
        }
      }
    }
  }

  if (node.meta !== undefined) {
    if (!isPlainObject(node.meta)) {
      errors.push(`${pathLabel}: meta must be an object`)
    } else {
      for (const [key, value] of Object.entries(node.meta)) {
        if (!META_KEYS.has(key)) {
          errors.push(`${pathLabel}: meta.${key} is not an allowed key`)
          continue
        }
        if (['createdAt', 'updatedAt', 'authorId', 'href', 'src', 'alt'].includes(key) && typeof value !== 'string') {
          errors.push(`${pathLabel}: meta.${key} must be a string`)
        }
        if (key === 'role' && (typeof value !== 'string' || !value.trim())) {
          errors.push(`${pathLabel}: meta.role must be a non-empty string`)
        }
        if (key === 'headingLevel') {
          const num = typeof value === 'string' ? Number(value) : value
          if (!Number.isInteger(num) || num < 1 || num > 6) {
            errors.push(`${pathLabel}: meta.headingLevel must be an integer between 1 and 6`)
          }
        }
      }
    }
  }

  if (node.locked !== undefined && typeof node.locked !== 'boolean') {
    errors.push(`${pathLabel}: locked must be boolean when present`)
  }
  if (node.hidden !== undefined && typeof node.hidden !== 'boolean') {
    errors.push(`${pathLabel}: hidden must be boolean when present`)
  }

  if (node.type === 'Span') {
    if (!isPlainObject(node.props) || typeof node.props.text !== 'string') {
      errors.push(`${pathLabel}: Span requires props.text as a string`)
    }
  }

  if ((node.type === 'Navbar' && isPlainObject(node.props) && 'brand' in node.props) ||
      (node.type === 'Footer' && isPlainObject(node.props) && 'note' in node.props)) {
    errors.push(`${pathLabel}: Navbar props.brand and Footer props.note are not allowed`)
  }

  if (LEAF_TYPES.has(node.type) && Array.isArray(node.children) && node.children.length > 0) {
    errors.push(`${pathLabel}: ${node.type} must have empty children`)
  }

  if (!Array.isArray(node.children)) return
  node.children.forEach((child, index) => {
    validatePageTreeNode(child, `${pathLabel}.children[${index}]`, seenIds, false, errors)
  })
}

function validatePageTreeDocument(doc) {
  const errors = []
  const seenIds = new Set()
  validatePageTreeNode(doc, 'root', seenIds, true, errors)
  return errors
}

function isValidPosition(position) {
  return (
    position === 'start' ||
    position === 'end' ||
    (Number.isInteger(position) && position >= 0)
  )
}

function buildNodeMaps(root) {
  const nodeMap = new Map()
  const parentMap = new Map()
  const visit = (node, parentId) => {
    nodeMap.set(node.id, node)
    parentMap.set(node.id, parentId)
    if (!Array.isArray(node.children)) return
    for (const child of node.children) visit(child, node.id)
  }
  visit(root, null)
  return { nodeMap, parentMap }
}

function isDescendant(nodeMap, ancestorId, targetId) {
  const ancestor = nodeMap.get(ancestorId)
  if (!ancestor) return false
  const stack = [...ancestor.children]
  while (stack.length > 0) {
    const next = stack.pop()
    if (next.id === targetId) return true
    if (Array.isArray(next.children)) stack.push(...next.children)
  }
  return false
}

function cloneTree(root) {
  return JSON.parse(JSON.stringify(root))
}

function normalizePosition(position, length) {
  if (position === 'start') return 0
  if (position === 'end') return length
  return Math.min(position, length)
}

function validatePatchShape(patch) {
  const errors = []
  if (!isPlainObject(patch)) {
    return ['patch must be an object']
  }
  const requiredKeys = ['updates', 'adds', 'deletes', 'moves']
  for (const key of requiredKeys) {
    if (!Array.isArray(patch[key])) {
      errors.push(`patch.${key} must be an array`)
    }
  }
  return errors
}

function validatePatchAgainstTree(tree, patch) {
  const errors = []
  const shapeErrors = validatePatchShape(patch)
  if (shapeErrors.length > 0) return shapeErrors

  const { nodeMap } = buildNodeMaps(tree)
  const existingIds = new Set(nodeMap.keys())
  const newIds = new Set()

  for (const [index, op] of patch.updates.entries()) {
    const path = `updates[${index}]`
    if (!isPlainObject(op)) {
      errors.push(`${path} must be an object`)
      continue
    }
    if (typeof op.id !== 'string' || !op.id.trim()) {
      errors.push(`${path}.id must be a non-empty string`)
      continue
    }
    if (!existingIds.has(op.id)) errors.push(`${path}.id "${op.id}" does not exist`)
    for (const field of ['props', 'styles', 'responsive']) {
      if (op[field] !== undefined && !isPlainObject(op[field])) {
        errors.push(`${path}.${field} must be an object when provided`)
      }
    }
    if (op.styles !== undefined && !isStyleObject(op.styles)) {
      errors.push(`${path}.styles must contain only string/number values`)
    }
    if (op.responsive !== undefined) {
      for (const bp of ['mobile', 'tablet', 'desktop']) {
        if (op.responsive[bp] !== undefined && !isStyleObject(op.responsive[bp])) {
          errors.push(`${path}.responsive.${bp} must be a style object`)
        }
      }
    }
  }

  for (const [index, op] of patch.adds.entries()) {
    const path = `adds[${index}]`
    if (!isPlainObject(op)) {
      errors.push(`${path} must be an object`)
      continue
    }
    if (typeof op.parentId !== 'string' || !op.parentId.trim()) {
      errors.push(`${path}.parentId must be a non-empty string`)
    } else if (!existingIds.has(op.parentId)) {
      errors.push(`${path}.parentId "${op.parentId}" does not exist`)
    }
    if (!isValidPosition(op.position)) {
      errors.push(`${path}.position must be "start", "end", or a non-negative integer`)
    }
    if (!isPlainObject(op.node)) {
      errors.push(`${path}.node must be an object`)
      continue
    }
    if (typeof op.node.id !== 'string' || !op.node.id.trim()) {
      errors.push(`${path}.node.id must be a non-empty string`)
    } else if (existingIds.has(op.node.id) || newIds.has(op.node.id)) {
      errors.push(`${path}.node.id "${op.node.id}" must be unique`)
    } else {
      newIds.add(op.node.id)
    }
    if (typeof op.node.type !== 'string' || !op.node.type.trim()) {
      errors.push(`${path}.node.type must be a non-empty string`)
    }
    if (!Array.isArray(op.node.children)) {
      errors.push(`${path}.node.children must be an array`)
    }
    const nodeErrors = []
    validatePageTreeNode(op.node, `${path}.node`, new Set(existingIds), false, nodeErrors)
    errors.push(...nodeErrors)
  }

  for (const [index, op] of patch.deletes.entries()) {
    const path = `deletes[${index}]`
    if (!isPlainObject(op)) {
      errors.push(`${path} must be an object`)
      continue
    }
    if (typeof op.id !== 'string' || !op.id.trim()) {
      errors.push(`${path}.id must be a non-empty string`)
      continue
    }
    if (!existingIds.has(op.id)) errors.push(`${path}.id "${op.id}" does not exist`)
    if (tree.id === op.id) errors.push(`${path}.id cannot delete the root node`)
  }

  for (const [index, op] of patch.moves.entries()) {
    const path = `moves[${index}]`
    if (!isPlainObject(op)) {
      errors.push(`${path} must be an object`)
      continue
    }
    if (typeof op.id !== 'string' || !op.id.trim()) {
      errors.push(`${path}.id must be a non-empty string`)
      continue
    }
    if (!existingIds.has(op.id)) errors.push(`${path}.id "${op.id}" does not exist`)
    if (tree.id === op.id) errors.push(`${path}.id cannot move the root node`)
    if (typeof op.newParentId !== 'string' || !op.newParentId.trim()) {
      errors.push(`${path}.newParentId must be a non-empty string`)
    } else if (!existingIds.has(op.newParentId)) {
      errors.push(`${path}.newParentId "${op.newParentId}" does not exist`)
    } else if (op.newParentId === op.id) {
      errors.push(`${path}: newParentId cannot equal id`)
    }
    if (!isValidPosition(op.position)) {
      errors.push(`${path}.position must be "start", "end", or a non-negative integer`)
    }
    if (existingIds.has(op.id) && existingIds.has(op.newParentId) && isDescendant(nodeMap, op.id, op.newParentId)) {
      errors.push(`${path}: cannot move a node into its own descendant`)
    }
  }

  return errors
}

function applyPatch(tree, patch) {
  const next = cloneTree(tree)
  const removeFromParent = (id) => {
    const { nodeMap, parentMap } = buildNodeMaps(next)
    const parentId = parentMap.get(id)
    if (!parentId) return
    const parent = nodeMap.get(parentId)
    parent.children = parent.children.filter((child) => child.id !== id)
  }

  for (const op of patch.updates) {
    const { nodeMap } = buildNodeMaps(next)
    const node = nodeMap.get(op.id)
    if (!node) continue
    if (op.props) node.props = { ...node.props, ...op.props }
    if (op.styles) node.styles = { ...node.styles, ...op.styles }
    if (op.responsive) {
      node.responsive = isPlainObject(node.responsive) ? { ...node.responsive } : {}
      for (const bp of ['mobile', 'tablet', 'desktop']) {
        if (op.responsive[bp]) {
          const current = isPlainObject(node.responsive[bp]) ? node.responsive[bp] : {}
          node.responsive[bp] = { ...current, ...op.responsive[bp] }
        }
      }
    }
  }

  for (const op of patch.adds) {
    const { nodeMap } = buildNodeMaps(next)
    const parent = nodeMap.get(op.parentId)
    if (!parent) continue
    const index = normalizePosition(op.position, parent.children.length)
    parent.children.splice(index, 0, op.node)
  }

  for (const op of patch.deletes) {
    removeFromParent(op.id)
  }

  for (const op of patch.moves) {
    const { nodeMap, parentMap } = buildNodeMaps(next)
    const node = nodeMap.get(op.id)
    const newParent = nodeMap.get(op.newParentId)
    if (!node || !newParent) continue
    const oldParentId = parentMap.get(op.id)
    if (oldParentId) {
      const oldParent = nodeMap.get(oldParentId)
      oldParent.children = oldParent.children.filter((child) => child.id !== op.id)
    }
    const index = normalizePosition(op.position, newParent.children.length)
    newParent.children.splice(index, 0, node)
  }

  return next
}

app.use(cors())
app.use(express.json({ limit: '1mb' }))

if (!API_KEY) {
  console.warn('GOOGLE_API_KEY is not set. Set process.env.GOOGLE_API_KEY with your API key.')
}

app.post('/api/mcp/page-tree', async (req, res) => {
  const {
    prompt,
    context = [],
    temperature = 0.0,
    has_to_updated = false,
    tree = null,
  } = req.body ?? {}
  if (!prompt || typeof prompt !== 'string') {
    res.status(400).json({ error: 'Prompt is required.' })
    return
  }
  if (has_to_updated) {
    if (!isPlainObject(tree)) {
      res.status(400).json({ error: 'tree is required when has_to_updated is true.' })
      return
    }
    const treeErrors = validatePageTreeDocument(tree)
    if (treeErrors.length > 0) {
      res.status(422).json({
        error: 'Input tree violates page-tree rulebook.',
        details: treeErrors,
      })
      return
    }
  }

  const controller = new AbortController()
  req.on('aborted', () => controller.abort())
  res.on('close', () => {
    if (!res.writableEnded) controller.abort()
  })

  try {
    if (!genAI) {
      res.status(500).json({
        error: 'Gemini SDK is not configured.',
        details: 'GOOGLE_API_KEY is missing.',
      })
      return
    }

    const modelId = await getResolvedModelId(controller.signal)
    const model = genAI.getGenerativeModel({ model: modelId })
    const history = Array.isArray(context)
      ? context
          .map((msg) => {
            if (!msg || typeof msg.content !== 'string') return null
            if (msg.role === 'assistant') return { role: 'model', parts: [{ text: msg.content }] }
            if (msg.role === 'user') return { role: 'user', parts: [{ text: msg.content }] }
            return null
          })
          .filter(Boolean)
      : []

    const instruction = has_to_updated
      ? `${PAGE_TREE_PATCH_RULEBOOK}\n\nCurrent tree:\n${JSON.stringify(tree)}\n\nUser request:\n${prompt}`
      : `${PAGE_TREE_RULEBOOK}\n\nUser request:\n${prompt}`

    const result = await model.generateContent({
      contents: [...history, { role: 'user', parts: [{ text: instruction }] }],
      generationConfig: {
        temperature,
        responseMimeType: 'application/json',
      },
    })
    const rawText = result?.response?.text?.() || ''

    let modelJson
    try {
      modelJson = JSON.parse(rawText)
    } catch {
      res.status(502).json({
        error: 'Model returned non-JSON output.',
        details: 'Expected one JSON object parseable by JSON.parse.',
        raw: rawText,
      })
      return
    }

    if (has_to_updated) {
      const patchErrors = validatePatchAgainstTree(tree, modelJson)
      if (patchErrors.length > 0) {
        res.status(422).json({
          error: 'Generated patch violates patch rulebook.',
          details: patchErrors,
          model: modelId,
          patch: modelJson,
        })
        return
      }

      const updatedTree = applyPatch(tree, modelJson)
      const updatedTreeErrors = validatePageTreeDocument(updatedTree)
      if (updatedTreeErrors.length > 0) {
        res.status(422).json({
          error: 'Generated patch produced an invalid page tree.',
          details: updatedTreeErrors,
          model: modelId,
          patch: modelJson,
        })
        return
      }

      res.json(modelJson)
      return
    }

    const validationErrors = validatePageTreeDocument(modelJson)
    if (validationErrors.length > 0) {
      res.status(422).json({
        error: 'Generated JSON violates page-tree rulebook.',
        details: validationErrors,
        model: modelId,
        pageTree: modelJson,
      })
      return
    }

    res.json({
      pageTree: modelJson,
      model: modelId,
    })
  } catch (error) {
    if (error.name === 'AbortError') {
      res.status(499).json({ error: 'Request aborted.' })
      return
    }
    const msg = String(error.message || '')
    if (/404|not found|is not supported for generateContent/i.test(msg)) {
      resolvedModelCache = { id: null, expiresAt: 0 }
    }
    res.status(500).json({
      error: 'MCP page-tree generation failed.',
      details: error.message || 'Unknown error',
    })
  }
})

app.listen(PORT, () => {
  console.log(`MCP layer listening on http://localhost:${PORT}`)
})
