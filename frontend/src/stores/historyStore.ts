import { create } from 'zustand'
import type { PageNode } from '../types/pageTree'
import { cloneTree } from '../utils/tree'

const MAX = 20

interface HistoryState {
  past: PageNode[]
  future: PageNode[]
  pushSnapshot: (treeBeforeChange: PageNode) => void
  undo: (currentTree: PageNode) => PageNode | null
  redo: (currentTree: PageNode) => PageNode | null
  clear: () => void
}

export const useHistoryStore = create<HistoryState>((set, get) => ({
  past: [],
  future: [],
  pushSnapshot: (treeBeforeChange) => {
    const snap = cloneTree(treeBeforeChange)
    set((s) => ({
      past: [...s.past, snap].slice(-MAX),
      future: [],
    }))
  },
  undo: (currentTree) => {
    const { past } = get()
    if (past.length === 0) return null
    const prev = past[past.length - 1]
    const current = cloneTree(currentTree)
    set((s) => ({
      past: s.past.slice(0, -1),
      future: [...s.future, current],
    }))
    return cloneTree(prev)
  },
  redo: (currentTree) => {
    const { future } = get()
    if (future.length === 0) return null
    const next = future[future.length - 1]
    const current = cloneTree(currentTree)
    set((s) => ({
      future: s.future.slice(0, -1),
      past: [...s.past, current].slice(-MAX),
    }))
    return cloneTree(next)
  },
  clear: () => set({ past: [], future: [] }),
}))
