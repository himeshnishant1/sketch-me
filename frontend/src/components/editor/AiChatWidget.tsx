import { useEffect, useMemo, useRef, useState } from 'react'
import { useEditorStore } from '../../stores/editorStore'
import type { PageNode } from '../../types/pageTree'
import { parsePageTreeJson } from '../../utils/importTree'
import { findWithParent, insertChild, moveNode, removeNode } from '../../utils/tree'
import { MCP_PAGE_TREE_URL } from '../../config/mcp' // adjust path if needed

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

const JSON_ONLY_SUFFIX =
  'Generate a JSON object only for the UI page tree. Return only valid JSON by following the rule book. Do not use markdown, code fences, or explanations.'
const INITIAL_SYSTEM_MESSAGE =
  'Ask for UI content and I will generate a fresh page tree first; later prompts in this chat become patch updates.'

function extractPageTree(payload: unknown): PageNode | null {
  if (!payload || typeof payload !== 'object') return null
  const o = payload as Record<string, unknown>
  if (!('pageTree' in o)) return null
  const pageTree = o.pageTree
  if (!pageTree || typeof pageTree !== 'object') return null
  return pageTree as PageNode
}

function parsePatchPayload(payload: unknown): TreePatch | null {
  if (!payload || typeof payload !== 'object') return null
  const o = payload as Record<string, unknown>
  const patchSource =
    (o.patch as Record<string, unknown> | undefined) ??
    (Object.prototype.hasOwnProperty.call(o, 'updates') ||
    Object.prototype.hasOwnProperty.call(o, 'adds') ||
    Object.prototype.hasOwnProperty.call(o, 'deletes') ||
    Object.prototype.hasOwnProperty.call(o, 'moves')
      ? o
      : undefined)
  if (!patchSource || typeof patchSource !== 'object') return null

  if (
    !Array.isArray(patchSource.updates) ||
    !Array.isArray(patchSource.adds) ||
    !Array.isArray(patchSource.deletes) ||
    !Array.isArray(patchSource.moves)
  ) {
    return null
  }

  return {
    updates: patchSource.updates as PatchUpdate[],
    adds: patchSource.adds as PatchAdd[],
    deletes: patchSource.deletes as PatchDelete[],
    moves: patchSource.moves as PatchMove[],
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

  for (const op of patch.adds) {
    if (!op?.parentId || !op.node) continue
    const parent = nodeById(next, op.parentId)
    if (!parent) continue
    if (!op.node.id || !op.node.type || !Array.isArray(op.node.children)) continue
    if (nodeById(next, op.node.id)) continue
    const index = positionToIndex(op.position, parent.children.length)
    insertChild(next, op.parentId, index, structuredClone(op.node))
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

  return next
}

function formatErrorPayload(payload: unknown): string {
  if (!payload || typeof payload !== 'object') return ''
  const o = payload as Record<string, unknown>
  const error = typeof o.error === 'string' ? o.error : ''
  const detailsArray = Array.isArray(o.details) ? o.details.filter((x) => typeof x === 'string') : []
  const details =
    detailsArray.length > 0
      ? detailsArray.slice(0, 6).join('; ')
      : typeof o.details === 'string'
        ? o.details
        : ''
  if (!error && !details) return ''
  return [error, details].filter(Boolean).join(' — ')
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
  const [showScrollToBottom, setShowScrollToBottom] = useState(false)
  const messagesRef = useRef<HTMLDivElement | null>(null)

  const contextMessages = useMemo(
    () =>
      messages
        .filter((m) => m.role !== 'system')
        .map((m) => ({ role: m.role, content: m.content })),
    [messages],
  )

  useEffect(() => {
    const el = messagesRef.current
    if (!el) return
    const nearBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 24
    if (nearBottom) {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
      setShowScrollToBottom(false)
    } else {
      setShowScrollToBottom(true)
    }
  }, [messages])

  const onMessagesScroll = () => {
    const el = messagesRef.current
    if (!el) return
    const nearBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 24
    setShowScrollToBottom(!nearBottom)
  }

  const scrollMessagesToBottom = () => {
    const el = messagesRef.current
    if (!el) return
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
    setShowScrollToBottom(false)
  }

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
        let errorMessage = `MCP request failed with status ${res.status}`
        try {
          const errPayload = (await res.json()) as unknown
          const parsed = formatErrorPayload(errPayload)
          if (parsed) errorMessage = parsed
        } catch {
          // ignore non-JSON error payload
        }
        throw new Error(errorMessage)
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

      const pageTree = extractPageTree(body)
      if (!pageTree) {
        throw new Error('AI response did not include a valid pageTree or patch payload.')
      }

      const parsedTree = parsePageTreeJson(pageTree)
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
        className={`ai-chat-fab ${pendingDraft ? 'ai-chat-fab--attention' : ''}`}
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

      <div className="ai-chat__messages" ref={messagesRef} onScroll={onMessagesScroll}>
        {messages.map((m, idx) => (
          <article key={`${m.role}-${idx}`} className={`ai-chat__message ai-chat__message--${m.role}`}>
            <div className="ai-chat__role">{m.role}</div>
            <pre className="ai-chat__content">{m.content}</pre>
          </article>
        ))}
      </div>
      {showScrollToBottom ? (
        <button
          type="button"
          className="ai-chat__scroll-bottom"
          onClick={scrollMessagesToBottom}
          aria-label="Scroll chat to bottom"
        >
          ↓
        </button>
      ) : null}

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
