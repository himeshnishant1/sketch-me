import { useMemo, useState } from 'react'
import { useEditorStore } from '../../stores/editorStore'
import type { PageNode } from '../../types/pageTree'
import { parsePageTreeJson } from '../../utils/importTree'
import { findWithParent, insertChild, moveNode, removeNode } from '../../utils/tree'

type ChatRole = 'user' | 'assistant' | 'system'

type ChatMessage = {
  role: ChatRole
  content: string
}

type PatchUpdate = {
  id: string
  props?: Record<string, unknown>
  styles?: Record<string, string | number>
  responsive?: PageNode['responsive']
}

type PatchAdd = {
  parentId: string
  position: 'start' | 'end' | number
  node: PageNode
}

type PatchDelete = {
  id: string
}

type PatchMove = {
  id: string
  newParentId: string
  position: 'start' | 'end' | number
}

type TreePatch = {
  updates: PatchUpdate[]
  adds: PatchAdd[]
  deletes: PatchDelete[]
  moves: PatchMove[]
}

type PendingDraft =
  | { kind: 'tree'; tree: PageNode }
  | { kind: 'patch'; patch: TreePatch }

const MCP_PAGE_TREE_URL = 'http://localhost:4000/api/mcp/page-tree'
const JSON_ONLY_SUFFIX =
  'Generate a JSON object only for the UI page tree. Return only valid JSON. Do not use markdown, code fences, or explanations.'
const INITIAL_SYSTEM_MESSAGE =
  'Ask for UI content and I will generate a fresh page tree first; later prompts in this chat become patch updates.'

function extractTextPayload(payload: unknown): string {
  if (typeof payload === 'string') return payload
  if (!payload || typeof payload !== 'object') return String(payload ?? '')

  const o = payload as Record<string, unknown>
  const directCandidates = [
    o.outputText,
    o.response,
    o.content,
    o.message,
    o.answer,
    o.text,
  ]
  for (const item of directCandidates) {
    if (typeof item === 'string' && item.trim()) return item
  }

  const nestedCandidates = [o.result, o.data]
  for (const nested of nestedCandidates) {
    if (!nested || typeof nested !== 'object') continue
    const text = extractTextPayload(nested)
    if (text.trim()) return text
  }

  return JSON.stringify(payload)
}

function extractPageTreeJson(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null
  const o = payload as Record<string, unknown>
  if (!('pageTree' in o)) return null
  const pageTree = o.pageTree
  if (!pageTree || typeof pageTree !== 'object') return null
  return JSON.stringify(pageTree)
}

function parsePatchPayload(payload: unknown): TreePatch | null {
  if (!payload || typeof payload !== 'object') return null
  const o = payload as Record<string, unknown>
  const patchSource =
    (o.patch as Record<string, unknown> | undefined) ??
    (o.updates || o.adds || o.deletes || o.moves ? o : undefined)
  if (!patchSource || typeof patchSource !== 'object') return null

  const updates = Array.isArray(patchSource.updates) ? patchSource.updates : []
  const adds = Array.isArray(patchSource.adds) ? patchSource.adds : []
  const deletes = Array.isArray(patchSource.deletes) ? patchSource.deletes : []
  const moves = Array.isArray(patchSource.moves) ? patchSource.moves : []

  return {
    updates: updates as PatchUpdate[],
    adds: adds as PatchAdd[],
    deletes: deletes as PatchDelete[],
    moves: moves as PatchMove[],
  }
}

function positionToIndex(position: 'start' | 'end' | number, length: number): number {
  if (position === 'start') return 0
  if (position === 'end') return length
  if (typeof position === 'number' && Number.isFinite(position)) {
    return Math.max(0, Math.min(Math.floor(position), length))
  }
  return length
}

function nodeById(root: PageNode, id: string): PageNode | null {
  if (root.id === id) return root
  return findWithParent(root, id)?.target ?? null
}

function applyPatchToTree(baseTree: PageNode, patch: TreePatch): PageNode {
  const next = structuredClone(baseTree)

  for (const op of patch.updates) {
    if (!op?.id) continue
    const target = nodeById(next, op.id)
    if (!target) continue
    if (op.props && typeof op.props === 'object') Object.assign(target.props, op.props)
    if (op.styles && typeof op.styles === 'object') Object.assign(target.styles, op.styles)
    if (op.responsive && typeof op.responsive === 'object') {
      target.responsive = {
        ...(target.responsive ?? {}),
        ...op.responsive,
      }
    }
  }

  for (const op of patch.deletes) {
    if (!op?.id || op.id === next.id) continue
    removeNode(next, op.id)
  }

  for (const op of patch.moves) {
    if (!op?.id || !op.newParentId) continue
    const newParent = nodeById(next, op.newParentId)
    if (!newParent) continue
    const index = positionToIndex(op.position, newParent.children.length)
    moveNode(next, op.id, op.newParentId, index)
  }

  for (const op of patch.adds) {
    if (!op?.parentId || !op.node) continue
    const parent = nodeById(next, op.parentId)
    if (!parent) continue
    if (!op.node.id || !op.node.type || !Array.isArray(op.node.children)) continue
    if (nodeById(next, op.node.id)) continue
    const index = positionToIndex(op.position, parent.children.length)
    insertChild(next, op.parentId, index, structuredClone(op.node))
  }

  return next
}

function extractFirstJsonObject(raw: string): string | null {
  const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const source = (fenceMatch?.[1] ?? raw).trim()

  let depth = 0
  let start = -1
  let inString = false
  let escape = false

  for (let i = 0; i < source.length; i += 1) {
    const ch = source[i]
    if (inString) {
      if (escape) {
        escape = false
      } else if (ch === '\\') {
        escape = true
      } else if (ch === '"') {
        inString = false
      }
      continue
    }

    if (ch === '"') {
      inString = true
      continue
    }
    if (ch === '{') {
      if (depth === 0) start = i
      depth += 1
      continue
    }
    if (ch === '}') {
      if (depth === 0) continue
      depth -= 1
      if (depth === 0 && start >= 0) {
        return source.slice(start, i + 1)
      }
    }
  }

  return null
}

export function AiChatWidget() {
  const tree = useEditorStore((s) => s.tree)
  const importTree = useEditorStore((s) => s.importTree)
  const [minimized, setMinimized] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'system',
      content: INITIAL_SYSTEM_MESSAGE,
    },
  ])
  const [prompt, setPrompt] = useState('')
  const [loading, setLoading] = useState(false)
  const [pendingDraft, setPendingDraft] = useState<PendingDraft | null>(null)
  const [rollbackTree, setRollbackTree] = useState<PageNode | null>(null)
  const [hasGeneratedBaseTree, setHasGeneratedBaseTree] = useState(false)

  const contextMessages = useMemo(
    () =>
      messages
        .filter((m) => m.role !== 'system')
        .map((m) => ({ role: m.role, content: m.content })),
    [messages],
  )

  const sendPrompt = async () => {
    const userPrompt = prompt.trim()
    if (!userPrompt || loading) return

    setPrompt('')
    setLoading(true)
    setMessages((prev) => [...prev, { role: 'user', content: userPrompt }])

    try {
      const requestPrompt = `${userPrompt}\n\n${JSON_ONLY_SUFFIX}`
      const shouldRequestUpdate = hasGeneratedBaseTree
      const res = await fetch(MCP_PAGE_TREE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          has_to_updated: shouldRequestUpdate,
          prompt: requestPrompt,
          temperature: 0.0,
          ...(shouldRequestUpdate ? { tree } : {}),
          context: contextMessages,
        }),
      })

      if (!res.ok) {
        throw new Error(`MCP request failed with status ${res.status}`)
      }

      const body = (await res.json()) as unknown
      const patchPayload = parsePatchPayload(body)
      if (patchPayload) {
        setPendingDraft({ kind: 'patch', patch: patchPayload })
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: 'Generated patch changes. Click "Apply changes" to update the canvas.' },
        ])
        return
      }

      const pageTreeJson = extractPageTreeJson(body)
      const rawText = extractTextPayload(body)
      const jsonText = pageTreeJson ?? extractFirstJsonObject(rawText)
      if (!jsonText) {
        throw new Error('AI response did not include a valid pageTree or patch payload.')
      }

      const parsedTree = parsePageTreeJson(JSON.parse(jsonText))
      setPendingDraft({ kind: 'tree', tree: parsedTree })
      setHasGeneratedBaseTree(true)
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Generated a new draft page tree. Click "Apply changes" to update the canvas.' },
      ])
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setMessages((prev) => [...prev, { role: 'assistant', content: `Error: ${msg}` }])
    } finally {
      setLoading(false)
    }
  }

  const applyPendingJson = () => {
    if (!pendingDraft) return
    try {
      const nextTree =
        pendingDraft.kind === 'patch'
          ? parsePageTreeJson(applyPatchToTree(tree, pendingDraft.patch))
          : pendingDraft.tree
      setRollbackTree(structuredClone(tree))
      importTree(nextTree)
      setPendingDraft(null)
      setMessages((prev) => [...prev, { role: 'assistant', content: 'Applied generated changes to canvas.' }])
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      window.alert(`Could not import generated JSON.\n\n${msg}`)
    }
  }

  const rollbackLastApply = () => {
    if (!rollbackTree) return
    importTree(structuredClone(rollbackTree))
    setRollbackTree(null)
    setMessages((prev) => [...prev, { role: 'assistant', content: 'Rolled back to the previous page tree.' }])
  }

  const startNewChat = () => {
    if (loading) return
    setMessages([{ role: 'system', content: INITIAL_SYSTEM_MESSAGE }])
    setPrompt('')
    setPendingDraft(null)
    setRollbackTree(null)
    setHasGeneratedBaseTree(false)
  }

  if (minimized) {
    return (
      <button
        type="button"
        className="ai-chat-fab"
        onClick={() => setMinimized(false)}
        aria-label="Open AI chat"
      >
        AI Chat
      </button>
    )
  }

  return (
    <section className="ai-chat" aria-label="AI chat">
      <header className="ai-chat__header">
        <strong>AI Builder</strong>
        <div className="ai-chat__actions">
          <button
            type="button"
            className={`btn btn--ghost ${pendingDraft ? 'btn--attention' : ''}`}
            onClick={applyPendingJson}
            disabled={!pendingDraft}
          >
            Apply changes
          </button>
          <button type="button" className="btn btn--ghost" onClick={rollbackLastApply} disabled={!rollbackTree}>
            Rollback
          </button>
          <button type="button" className="btn btn--ghost" onClick={startNewChat} disabled={loading}>
            New chat
          </button>
          <button type="button" className="btn btn--ghost" onClick={() => setMinimized(true)}>
            Minimize
          </button>
        </div>
      </header>

      <div className="ai-chat__messages">
        {messages.map((m, idx) => (
          <article key={`${m.role}-${idx}`} className={`ai-chat__message ai-chat__message--${m.role}`}>
            <div className="ai-chat__role">{m.role}</div>
            <pre className="ai-chat__content">{m.content}</pre>
          </article>
        ))}
      </div>

      <div className="ai-chat__composer">
        <textarea
          className="field__input field__textarea"
          rows={3}
          value={prompt}
          placeholder="Describe the UI you want..."
          onChange={(e) => setPrompt(e.target.value)}
        />
        <button type="button" className="btn" onClick={sendPrompt} disabled={loading || !prompt.trim()}>
          {loading ? 'Generating...' : 'Generate'}
        </button>
      </div>
    </section>
  )
}
