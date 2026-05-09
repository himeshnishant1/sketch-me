import { create } from 'zustand'

/** Site theme as CSS custom property names → values (frontend-only; mirrors doc 3.4) */
export type ThemeTokens = Record<string, string>

const defaultTokens: ThemeTokens = {
  'color-primary': '#2e75b6',
  'color-secondary': '#1a4d7a',
  'color-surface': '#f8fafc',
  'color-background': '#ffffff',
  'color-text': '#0f172a',
  'color-text-muted': '#64748b',
  'color-border': '#e2e8f0',
  'font-heading': "'DM Sans', system-ui, sans-serif",
  'font-body': "'Inter', system-ui, sans-serif",
  'font-mono': 'ui-monospace, monospace',
  'font-size-base': '16px',
  'spacing-xs': '4px',
  'spacing-sm': '8px',
  'spacing-md': '16px',
  'spacing-lg': '32px',
  'spacing-xl': '64px',
  'border-radius-sm': '4px',
  'border-radius-md': '8px',
  'border-radius-lg': '16px',
  'shadow-sm': '0 1px 2px rgba(0,0,0,0.06)',
  'shadow-md': '0 4px 12px rgba(0,0,0,0.08)',
}

function applyTokensToDocument(tokens: ThemeTokens) {
  const root = document.documentElement
  for (const [key, value] of Object.entries(tokens)) {
    root.style.setProperty(`--${key}`, value)
  }
}

interface ThemeState {
  tokens: ThemeTokens
  setToken: (key: string, value: string) => void
  reset: () => void
}

export const useThemeStore = create<ThemeState>((set) => ({
  tokens: { ...defaultTokens },
  setToken: (key, value) => {
    set((s) => {
      const tokens = { ...s.tokens, [key]: value }
      applyTokensToDocument(tokens)
      return { tokens }
    })
  },
  reset: () => {
    const tokens = { ...defaultTokens }
    applyTokensToDocument(tokens)
    set({ tokens })
  },
}))

export function initThemeDom() {
  applyTokensToDocument(getStateTokens())
}

export function getStateTokens(): ThemeTokens {
  return useThemeStore.getState().tokens
}
