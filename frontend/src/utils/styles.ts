import type { CSSProperties } from 'react'
import type { StyleMap, Viewport } from '../types/pageTree'

export function mergeResponsiveStyles(
  base: StyleMap | undefined,
  responsive: Partial<StyleMap> | undefined,
): StyleMap {
  return { ...(base ?? {}), ...(responsive ?? {}) }
}

export function stylesForViewport(
  base: StyleMap | undefined,
  responsive:
    | import('../types/pageTree').ResponsiveStyles
    | undefined,
  viewport: Viewport,
): StyleMap {
  const tier =
    viewport === 'mobile'
      ? responsive?.mobile
      : viewport === 'tablet'
        ? responsive?.tablet
        : responsive?.desktop
  return mergeResponsiveStyles(base, tier)
}

export function styleObjectToReactStyle(map: StyleMap): CSSProperties {
  const out: Record<string, string | number> = {}
  for (const [k, v] of Object.entries(map)) {
    if (v === undefined) continue
    const camel = k.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())
    out[camel] = typeof v === 'number' ? v : String(v)
  }
  return out as CSSProperties
}
