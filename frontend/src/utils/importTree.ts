import type { NodeMeta, PageNode, ResponsiveStyles, StyleMap } from '../types/pageTree'
import { warnImportedTreeDeprecatedLayoutProps } from './deprecatedProps'

function assertRecord(value: unknown, label: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object`)
  }
  return value as Record<string, unknown>
}

function normalizeStyles(raw: unknown): StyleMap {
  if (raw === undefined) return {}
  const o = assertRecord(raw, 'styles')
  const out: StyleMap = {}
  for (const [k, v] of Object.entries(o)) {
    if (v === undefined || v === null) continue
    if (typeof v === 'string' || typeof v === 'number') out[k] = v
  }
  return out
}

function normalizeResponsive(raw: unknown): ResponsiveStyles | undefined {
  if (raw === undefined) return undefined
  const o = assertRecord(raw, 'responsive')
  const mobile = o.mobile !== undefined ? normalizeStyles(o.mobile) : undefined
  const tablet = o.tablet !== undefined ? normalizeStyles(o.tablet) : undefined
  const desktop = o.desktop !== undefined ? normalizeStyles(o.desktop) : undefined
  if (!mobile && !tablet && !desktop) return undefined
  return { mobile, tablet, desktop }
}

function parseHeadingLevel(raw: unknown): NodeMeta['headingLevel'] | undefined {
  if (raw === undefined || raw === null) return undefined
  const n = typeof raw === 'string' ? Number(raw) : typeof raw === 'number' ? raw : NaN
  if (!Number.isFinite(n)) return undefined
  const i = Math.floor(n)
  if (i < 1 || i > 6) return undefined
  return i as NodeMeta['headingLevel']
}

function normalizeMeta(raw: unknown, nodeId: string): NodeMeta | undefined {
  if (raw === undefined) return undefined
  const o = assertRecord(raw, `meta (${nodeId})`)
  const meta: NodeMeta = {}

  if (typeof o.createdAt === 'string') meta.createdAt = o.createdAt
  if (typeof o.updatedAt === 'string') meta.updatedAt = o.updatedAt
  if (typeof o.authorId === 'string') meta.authorId = o.authorId

  if (typeof o.role === 'string' && o.role.trim()) meta.role = o.role.trim()

  const hl = parseHeadingLevel(o.headingLevel)
  if (hl !== undefined) meta.headingLevel = hl

  if (typeof o.href === 'string') meta.href = o.href
  if (typeof o.src === 'string') meta.src = o.src
  if (typeof o.alt === 'string') meta.alt = o.alt

  return Object.keys(meta).length > 0 ? meta : undefined
}

function normalizeNode(raw: unknown, isRoot: boolean): PageNode {
  const o = assertRecord(raw, 'node')

  const id = o.id
  const type = o.type
  if (typeof id !== 'string' || !id.trim()) {
    throw new Error('Each node needs a non-empty string "id"')
  }
  if (typeof type !== 'string' || !type.trim()) {
    throw new Error(`Node "${id}" needs a non-empty string "type"`)
  }
  if (isRoot && type !== 'Page') {
    throw new Error('Root node must have type "Page"')
  }

  const propsRaw = o.props
  const props =
    propsRaw === undefined ? {} : assertRecord(propsRaw, `props (${id})`)

  const styles = normalizeStyles(o.styles)
  const responsive = normalizeResponsive(o.responsive)
  const meta = normalizeMeta(o.meta, id)

  const childrenRaw = o.children
  if (!Array.isArray(childrenRaw)) {
    throw new Error(`Node "${id}" must have a "children" array`)
  }

  const locked = typeof o.locked === 'boolean' ? o.locked : undefined
  const hidden = typeof o.hidden === 'boolean' ? o.hidden : undefined

  const children = childrenRaw.map((child, i) => {
    try {
      return normalizeNode(child, false)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      throw new Error(`children[${i}] of "${id}": ${msg}`)
    }
  })

  const node: PageNode = {
    id,
    type,
    props: props as Record<string, unknown>,
    styles,
    children,
  }
  if (responsive) node.responsive = responsive
  if (locked !== undefined) node.locked = locked
  if (hidden !== undefined) node.hidden = hidden
  if (meta) node.meta = meta

  return node
}

/** Parse exported page-tree JSON after JSON.parse */
export function parsePageTreeJson(parsed: unknown): PageNode {
  const tree = normalizeNode(parsed, true)
  warnImportedTreeDeprecatedLayoutProps(tree)
  return tree
}

export function parsePageTreeFromText(text: string): PageNode {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('The file is not valid JSON.')
  }
  return parsePageTreeJson(parsed)
}
