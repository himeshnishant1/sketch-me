import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import type { NodeMeta, PageNode, Viewport } from '../types/pageTree'
import { componentRegistry } from '../registry/componentRegistry'
import {
  findWithParent,
  insertChild,
  isSelfOrDescendant,
  moveNode,
  removeNode,
} from '../utils/tree'
import { useHistoryStore } from './historyStore'
import { v4 as uuid } from 'uuid'

const STORAGE_KEY = 'sketch_me_page_tree_v1'

interface EditorState {
  tree: PageNode
  selectedId: string | null
  hoveredId: string | null
  viewport: Viewport
  setSelectedId: (id: string | null) => void
  setHoveredId: (id: string | null) => void
  setViewport: (v: Viewport) => void
  setTree: (tree: PageNode) => void
  /** Replace tree from validated import; snapshots current tree for undo */
  importTree: (tree: PageNode) => void
  persist: () => void
  loadPersisted: () => void
  addBlock: (parentId: string, blockType: string, index?: number) => void
  moveBlock: (nodeId: string, newParentId: string, index: number) => void
  updateNodeProps: (nodeId: string, patch: Record<string, unknown>) => void
  updateNodeStyles: (nodeId: string, patch: Record<string, unknown>) => void
  updateNodeMeta: (nodeId: string, patch: Partial<NodeMeta>) => void
  deleteNode: (nodeId: string) => void
  moveSibling: (nodeId: string, delta: -1 | 1) => void
  undo: () => void
  redo: () => void
}

export function createDefaultPageTree(): PageNode {
  const span = (text: string, styles: PageNode['styles'] = {}): PageNode => ({
    id: uuid(),
    type: 'Span',
    props: { text },
    styles,
    children: [],
  })

  return {
    id: 'page-root',
    type: 'Page',
    props: { title: 'Home', slug: '/' },
    styles: {
      minHeight: '100%',
      display: 'flex',
      flexDirection: 'column',
    },
    children: [
      {
        id: uuid(),
        type: 'Navbar',
        props: {},
        styles: {
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 'var(--spacing-lg)',
          flexWrap: 'wrap',
          padding: 'var(--spacing-md) var(--spacing-lg)',
          backgroundColor: 'var(--color-surface)',
          borderBottom: '1px solid var(--color-border)',
        },
        responsive: {
          mobile: {
            alignItems: 'stretch',
            gap: '10px',
          },
        },
        children: [
          {
            id: uuid(),
            type: 'Container',
            meta: { role: 'navbar-left' },
            props: {},
            styles: {
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              flex: '1',
              minWidth: '0',
            },
            responsive: {
              mobile: {
                width: '100%',
              },
            },
            children: [
              span('My Site', {
                fontWeight: '700',
                fontFamily: 'var(--font-heading)',
                fontSize: '18px',
                color: 'var(--color-text)',
              }),
            ],
          },
          {
            id: uuid(),
            type: 'Container',
            meta: { role: 'navbar-center' },
            props: {},
            styles: {
              display: 'flex',
              justifyContent: 'center',
              gap: '16px',
              flexWrap: 'wrap',
              flex: '1',
              minWidth: '0',
            },
            responsive: {
              mobile: {
                width: '100%',
                justifyContent: 'flex-start',
                flexDirection: 'column',
                gap: '8px',
              },
            },
            children: [
              {
                id: uuid(),
                type: 'Button',
                props: {
                  navLink: true,
                  subMenu: [
                    { label: 'Overview', href: '#overview' },
                    { label: 'Changelog', href: '#changelog' },
                  ],
                },
                meta: { href: '#product' },
                styles: {
                  backgroundColor: 'transparent',
                  color: 'var(--color-text)',
                  textDecoration: 'none',
                  padding: '8px 10px',
                  fontWeight: '600',
                },
                children: [span('Product')],
              },
              {
                id: uuid(),
                type: 'Button',
                props: { navLink: true },
                meta: { href: '#pricing' },
                styles: {
                  backgroundColor: 'transparent',
                  color: 'var(--color-text)',
                  textDecoration: 'none',
                  padding: '8px 10px',
                  fontWeight: '600',
                },
                children: [span('Pricing')],
              },
              {
                id: uuid(),
                type: 'Button',
                props: { navLink: true },
                meta: { href: '#about' },
                styles: {
                  backgroundColor: 'transparent',
                  color: 'var(--color-text)',
                  textDecoration: 'none',
                  padding: '8px 10px',
                  fontWeight: '600',
                },
                children: [span('About')],
              },
            ],
          },
          {
            id: uuid(),
            type: 'Container',
            meta: { role: 'navbar-right' },
            props: {},
            styles: {
              display: 'flex',
              justifyContent: 'flex-end',
              alignItems: 'center',
              gap: '12px',
              flex: '1',
              minWidth: '0',
            },
            responsive: {
              mobile: {
                width: '100%',
                justifyContent: 'flex-start',
              },
            },
            children: [
              {
                id: uuid(),
                type: 'Button',
                props: {},
                meta: { href: '#' },
                styles: {
                  display: 'inline-block',
                  padding: '8px 16px',
                  backgroundColor: 'var(--color-primary)',
                  color: '#fff',
                  borderRadius: 'var(--border-radius-md)',
                  fontWeight: '600',
                  textDecoration: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-body)',
                  fontSize: '14px',
                },
                children: [span('Sign in')],
              },
            ],
          },
        ],
      },
      {
        id: uuid(),
        type: 'Section',
        props: {},
        styles: {
          flex: '1',
          padding: 'var(--spacing-xl) var(--spacing-lg)',
          backgroundColor: 'var(--color-background)',
        },
        children: [
          {
            id: uuid(),
            type: 'Container',
            props: {},
            styles: { maxWidth: '960px', margin: '0 auto' },
            children: [
              {
                id: uuid(),
                type: 'Heading',
                props: {},
                meta: { headingLevel: 1, role: 'hero-heading' },
                styles: {
                  fontFamily: 'var(--font-heading)',
                  fontSize: '48px',
                  color: 'var(--color-text)',
                  margin: '0 0 var(--spacing-md)',
                },
                responsive: {
                  mobile: { fontSize: '32px' },
                },
                children: [span('Build anything.')],
              },
              {
                id: uuid(),
                type: 'Text',
                props: {},
                styles: {
                  fontFamily: 'var(--font-body)',
                  fontSize: 'var(--font-size-base)',
                  color: 'var(--color-text-muted)',
                  lineHeight: '1.6',
                  margin: '0 0 var(--spacing-lg)',
                },
                children: [
                  span(
                    'Drag blocks from the library, edit styles in the panel, and undo anytime. Layout is defined only by the JSON tree — Navbar zones are plain Containers with meta.role.',
                  ),
                ],
              },
              {
                id: uuid(),
                type: 'Button',
                props: {},
                meta: { href: '#' },
                styles: {
                  display: 'inline-block',
                  padding: '12px 24px',
                  backgroundColor: 'var(--color-primary)',
                  color: '#fff',
                  borderRadius: 'var(--border-radius-md)',
                  fontWeight: '600',
                  textDecoration: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-body)',
                },
                children: [span('Get started')],
              },
            ],
          },
        ],
      },
      {
        id: uuid(),
        type: 'Footer',
        props: {},
        styles: {
          marginTop: 'auto',
          padding: 'var(--spacing-lg)',
          backgroundColor: 'var(--color-surface)',
          borderTop: '1px solid var(--color-border)',
          textAlign: 'center',
          color: 'var(--color-text-muted)',
          fontSize: '14px',
        },
        children: [
          {
            id: uuid(),
            type: 'Text',
            props: {},
            styles: { margin: '0' },
            children: [span('Made with Sketch Me (frontend-only builder)')],
          },
        ],
      },
    ],
  }
}

function createNodeFromType(type: string): PageNode | null {
  const def = componentRegistry.get(type)
  if (!def) return null

  const span = (text: string): PageNode => ({
    id: uuid(),
    type: 'Span',
    props: { text },
    styles: {},
    children: [],
  })

  if (type === 'Heading') {
    return {
      id: uuid(),
      type: 'Heading',
      props: {},
      meta: { headingLevel: 2, role: 'hero-heading' },
      styles: { ...def.defaultStyles },
      children: [span('Heading')],
    }
  }
  if (type === 'Text') {
    return {
      id: uuid(),
      type: 'Text',
      props: {},
      styles: { ...def.defaultStyles },
      children: [span('Paragraph text')],
    }
  }
  if (type === 'Button') {
    return {
      id: uuid(),
      type: 'Button',
      props: {},
      meta: { href: '#' },
      styles: { ...def.defaultStyles },
      children: [span('Button')],
    }
  }
  if (type === 'Image') {
    return {
      id: uuid(),
      type: 'Image',
      props: {},
      meta: {
        src: 'https://images.unsplash.com/photo-1557683316-973673baf926?w=800&q=80',
        alt: 'Placeholder',
      },
      styles: { ...def.defaultStyles },
      children: [],
    }
  }
  if (type === 'Select') {
    return {
      id: uuid(),
      type: 'Select',
      props: {},
      styles: { ...def.defaultStyles },
      children: [
        {
          id: uuid(),
          type: 'Option',
          props: { value: 'option-1', label: 'Option 1' },
          styles: {},
          children: [],
        },
      ],
    }
  }
  if (type === 'Checkbox') {
    return {
      id: uuid(),
      type: 'Checkbox',
      props: { label: 'Accept terms', checked: false },
      styles: { ...def.defaultStyles },
      children: [span('Accept terms')],
    }
  }
  if (type === 'Radio') {
    return {
      id: uuid(),
      type: 'Radio',
      props: { name: 'group', label: 'Option', checked: false },
      styles: { ...def.defaultStyles },
      children: [span('Option')],
    }
  }
  if (type === 'Label') {
    return {
      id: uuid(),
      type: 'Label',
      props: {},
      styles: { ...def.defaultStyles },
      children: [span('Label')],
    }
  }
  if (type === 'Form') {
    return {
      id: uuid(),
      type: 'Form',
      props: {},
      styles: { ...def.defaultStyles },
      children: [],
    }
  }

  return {
    id: uuid(),
    type: def.type,
    props: { ...def.defaultProps },
    styles: { ...def.defaultStyles },
    children: [],
  }
}

export const useEditorStore = create<EditorState>()(
  immer((set, get) => ({
    tree: createDefaultPageTree(),
    selectedId: null,
    hoveredId: null,
    viewport: 'desktop',

    setSelectedId: (id) => set({ selectedId: id }),
    setHoveredId: (id) => set({ hoveredId: id }),
    setViewport: (viewport) => set({ viewport }),

    setTree: (tree) => set({ tree }),

    importTree: (tree) => {
      useHistoryStore.getState().pushSnapshot(get().tree)
      set({
        tree: structuredClone(tree),
        selectedId: null,
      })
      get().persist()
    },

    persist: () => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(get().tree))
      } catch {
        /* ignore */
      }
    },

    loadPersisted: () => {
      try {
        const raw = localStorage.getItem(STORAGE_KEY)
        if (!raw) return
        const parsed = JSON.parse(raw) as PageNode
        if (parsed?.id && parsed?.type === 'Page')
          set({ tree: parsed, selectedId: null })
      } catch {
        /* ignore */
      }
    },

    undo: () => {
      const prev = useHistoryStore.getState().undo(get().tree)
      if (prev) set({ tree: prev })
    },

    redo: () => {
      const next = useHistoryStore.getState().redo(get().tree)
      if (next) set({ tree: next })
    },

    addBlock: (parentId, blockType, index) => {
      const tree = get().tree
      const node = createNodeFromType(blockType)
      if (!node) return
      const parent =
        parentId === tree.id ? tree : findWithParent(tree, parentId)?.target
      if (!parent || !componentRegistry.canNest(parent.type, blockType)) return
      useHistoryStore.getState().pushSnapshot(tree)
      const idx = index ?? parent.children.length
      set((draft) => {
        insertChild(draft.tree, parentId, idx, node)
      })
      get().persist()
    },

    moveBlock: (nodeId, newParentId, index) => {
      if (nodeId === 'page-root') return
      const tree = get().tree
      if (isSelfOrDescendant(tree, nodeId, newParentId)) return
      const moving = findWithParent(tree, nodeId)?.target
      if (!moving) return
      const newParent =
        newParentId === tree.id ? tree : findWithParent(tree, newParentId)?.target
      if (!newParent || !componentRegistry.canNest(newParent.type, moving.type)) return

      useHistoryStore.getState().pushSnapshot(tree)
      set((draft) => {
        moveNode(draft.tree, nodeId, newParentId, index)
      })
      get().persist()
    },

    updateNodeProps: (nodeId, patch) => {
      const tree = get().tree
      useHistoryStore.getState().pushSnapshot(tree)
      set((draft) => {
        const hit = findWithParent(draft.tree, nodeId)
        if (hit) Object.assign(hit.target.props, patch)
      })
      get().persist()
    },

    updateNodeStyles: (nodeId, patch) => {
      const tree = get().tree
      useHistoryStore.getState().pushSnapshot(tree)
      set((draft) => {
        const hit = findWithParent(draft.tree, nodeId)
        if (hit) Object.assign(hit.target.styles, patch)
      })
      get().persist()
    },

    updateNodeMeta: (nodeId, patch) => {
      const tree = get().tree
      useHistoryStore.getState().pushSnapshot(tree)
      set((draft) => {
        const hit = findWithParent(draft.tree, nodeId)
        if (!hit) return
        const next: NodeMeta = { ...(hit.target.meta ?? {}) }
        for (const [key, value] of Object.entries(patch) as [keyof NodeMeta, NodeMeta[keyof NodeMeta]][]) {
          if (value === undefined || value === '') {
            delete next[key]
          } else {
            next[key] = value as never
          }
        }
        hit.target.meta = Object.keys(next).length > 0 ? next : undefined
      })
      get().persist()
    },

    deleteNode: (nodeId) => {
      if (nodeId === 'page-root') return
      const tree = get().tree
      useHistoryStore.getState().pushSnapshot(tree)
      set((draft) => {
        removeNode(draft.tree, nodeId)
      })
      set((s) => ({
        selectedId: s.selectedId === nodeId ? null : s.selectedId,
      }))
      get().persist()
    },

    moveSibling: (nodeId, delta) => {
      if (nodeId === 'page-root') return
      const tree = get().tree
      const hit = findWithParent(tree, nodeId)
      if (!hit) return
      const newIndex = hit.index + delta
      if (newIndex < 0 || newIndex >= hit.parent.children.length) return
      useHistoryStore.getState().pushSnapshot(tree)
      set((draft) => {
        const h = findWithParent(draft.tree, nodeId)
        if (!h) return
        const arr = h.parent.children
        const [item] = arr.splice(h.index, 1)
        arr.splice(newIndex, 0, item)
      })
      get().persist()
    },
  })),
)
