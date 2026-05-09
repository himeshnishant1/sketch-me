import type { PageNode } from '../types/pageTree'

const seen = new Set<string>()

/** One-shot warnings after JSON import (same keys as runtime warnings — duplicates suppressed). */
export function warnImportedTreeDeprecatedLayoutProps(root: PageNode) {
  if (import.meta.env.PROD) return
  const visit = (node: PageNode) => {
    if (node.type === 'Navbar') warnNavbarBrandIgnored(node)
    if (node.type === 'Footer') warnFooterNoteIgnored(node)
    node.children.forEach(visit)
  }
  visit(root)
}

function warnOnce(key: string, message: string) {
  if (import.meta.env.PROD) return
  if (seen.has(key)) return
  seen.add(key)
  console.warn(`[sketch_me] ${message}`)
}

/** Navbar: props.brand must not affect DOM — use children (e.g. Span in a Container). */
export function warnNavbarBrandIgnored(node: PageNode) {
  if (!Object.prototype.hasOwnProperty.call(node.props, 'brand')) return
  warnOnce(
    `navbar-brand:${node.id}`,
    `Deprecated: Node "${node.id}" (Navbar): props.brand is ignored. Use Text or Span (or Image) nodes inside children instead.`,
  )
}

/** Footer: props.note must not affect DOM — use children. */
export function warnFooterNoteIgnored(node: PageNode) {
  if (!Object.prototype.hasOwnProperty.call(node.props, 'note')) return
  warnOnce(
    `footer-note:${node.id}`,
    `Deprecated: Node "${node.id}" (Footer): props.note is ignored. Use Text / Span nodes inside children instead.`,
  )
}

export function warnHeadingLegacyProps(node: PageNode) {
  const hasChildren = node.children.length > 0
  if (hasChildren && Object.prototype.hasOwnProperty.call(node.props, 'text')) {
    warnOnce(
      `heading-text:${node.id}`,
      `Node "${node.id}" (Heading): props.text is ignored because children are present. Use Span nodes for visible copy.`,
    )
  }
  if (
    hasChildren &&
    Object.prototype.hasOwnProperty.call(node.props, 'level')
  ) {
    warnOnce(
      `heading-level:${node.id}`,
      `Node "${node.id}" (Heading): props.level is ignored when children exist. Prefer meta.headingLevel (1–6).`,
    )
  }
  if (!hasChildren && (node.props.text != null || node.props.level != null)) {
    warnOnce(
      `heading-fallback:${node.id}`,
      `Node "${node.id}" (Heading): using legacy props for visible output. Prefer children + meta.headingLevel for AI-friendly trees.`,
    )
  }
}

export function warnTextLegacyProps(node: PageNode) {
  const hasChildren = node.children.length > 0
  if (hasChildren && Object.prototype.hasOwnProperty.call(node.props, 'text')) {
    warnOnce(
      `text-prop:${node.id}`,
      `Node "${node.id}" (Text): props.text is ignored because children are present. Use Span nodes inside.`,
    )
  }
  if (!hasChildren && node.props.text != null) {
    warnOnce(
      `text-fallback:${node.id}`,
      `Node "${node.id}" (Text): using legacy props.text. Prefer Span children for structured output.`,
    )
  }
}

export function warnButtonLegacyProps(node: PageNode) {
  const hasChildren = node.children.length > 0
  if (hasChildren && Object.prototype.hasOwnProperty.call(node.props, 'label')) {
    warnOnce(
      `button-label:${node.id}`,
      `Node "${node.id}" (Button): props.label is ignored because children are present. Put labels in Span (or other) children.`,
    )
  }
  if (
    hasChildren &&
    Object.prototype.hasOwnProperty.call(node.props, 'href')
  ) {
    warnOnce(
      `button-href:${node.id}`,
      `Node "${node.id}" (Button): props.href is ignored when children exist. Prefer meta.href for the link target.`,
    )
  }
  if (!hasChildren && (node.props.label != null || node.props.href != null)) {
    warnOnce(
      `button-fallback:${node.id}`,
      `Node "${node.id}" (Button): using legacy props for label/href. Prefer children + meta.href.`,
    )
  }
}

export function warnImageLegacyProps(node: PageNode) {
  if (node.children.length > 0) {
    warnOnce(
      `image-children:${node.id}`,
      `Node "${node.id}" (Image): children are ignored. Image is a leaf; use meta.src / meta.alt (or legacy props).`,
    )
  }
  const hasMetaSrc = node.meta?.src != null && String(node.meta.src).length > 0
  const hasMetaAlt = node.meta?.alt != null && String(node.meta.alt).length > 0
  if (
    !hasMetaSrc &&
    Object.prototype.hasOwnProperty.call(node.props, 'src')
  ) {
    warnOnce(
      `image-src:${node.id}`,
      `Node "${node.id}" (Image): props.src is legacy. Prefer meta.src.`,
    )
  }
  if (
    !hasMetaAlt &&
    Object.prototype.hasOwnProperty.call(node.props, 'alt')
  ) {
    warnOnce(
      `image-alt:${node.id}`,
      `Node "${node.id}" (Image): props.alt is legacy. Prefer meta.alt.`,
    )
  }
}
