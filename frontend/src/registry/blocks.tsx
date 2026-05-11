import { createElement, type ReactNode } from 'react'
import type { BlockRenderProps } from '../types/registry'
import {
  warnButtonLegacyProps,
  warnFooterNoteIgnored,
  warnHeadingLegacyProps,
  warnImageLegacyProps,
  warnNavbarBrandIgnored,
  warnTextLegacyProps,
} from '../utils/deprecatedProps'

/**
 * Page landmark: keeps `<main>` in the layout tree (avoid `display:contents` here for a11y).
 * Column flex fills the artboard so sections / footers can use margin-top: auto.
 */
export function BlockPage({ node: _node, children }: BlockRenderProps & { children?: ReactNode }) {
  return (
    <main
      data-page-root
      style={{
        flex: 1,
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {children}
    </main>
  )
}

export function BlockSection({ children }: BlockRenderProps & { children?: ReactNode }) {
  return (
    <section style={{ display: 'contents' }}>
      {children}
    </section>
  )
}

export function BlockContainer({ children }: BlockRenderProps & { children?: ReactNode }) {
  return <div style={{ display: 'contents' }}>{children}</div>
}

export function BlockColumns({ children }: BlockRenderProps & { children?: ReactNode }) {
  return <div style={{ display: 'contents' }}>{children}</div>
}

export function BlockDivider(_props: BlockRenderProps) {
  return <hr aria-hidden style={{ width: '100%' }} />
}

/** Navbar: flex layout comes from JSON `styles` on the node — only render shell + children */
export function BlockNavbar({ node, children }: BlockRenderProps & { children?: ReactNode }) {
  warnNavbarBrandIgnored(node)
  return (
    <nav aria-label="Primary" data-layout="navbar" style={{ display: 'contents' }}>
      {children}
    </nav>
  )
}

/** Footer: shell + children only */
export function BlockFooter({ node, children }: BlockRenderProps & { children?: ReactNode }) {
  warnFooterNoteIgnored(node)
  return <footer style={{ display: 'contents' }}>{children}</footer>
}

/** Text payload leaf — visible characters live here (allowed exception to “layout owns tree”) */
export function BlockSpan({ node }: BlockRenderProps) {
  const text = String(node.props.text ?? '')
  return <span>{text}</span>
}

export function BlockHeading({ node, children }: BlockRenderProps & { children?: ReactNode }) {
  warnHeadingLegacyProps(node)

  const rawMeta = node.meta?.headingLevel
  const metaLevel =
    typeof rawMeta === 'number' && rawMeta >= 1 && rawMeta <= 6 ? rawMeta : undefined
  const legacyLevel = Number(node.props.level)
  const level = Math.min(
    6,
    Math.max(1, metaLevel ?? (Number.isFinite(legacyLevel) ? legacyLevel : 2)),
  ) as 1 | 2 | 3 | 4 | 5 | 6

  const tag = `h${level}` as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'

  if (node.children.length > 0) {
    return createElement(tag, null, children)
  }

  const fallback = String(node.props.text ?? '')
  return createElement(tag, null, fallback)
}

export function BlockText({ node, children }: BlockRenderProps & { children?: ReactNode }) {
  warnTextLegacyProps(node)

  if (node.children.length > 0) {
    return <p>{children}</p>
  }

  return <p>{String(node.props.text ?? '')}</p>
}

export function BlockImage({ node }: BlockRenderProps) {
  warnImageLegacyProps(node)

  const src = String(node.meta?.src ?? node.props.src ?? '')
  const alt = String(node.meta?.alt ?? node.props.alt ?? '')

  return <img src={src || undefined} alt={alt} loading="lazy" />
}

export function BlockButton({ node, children }: BlockRenderProps & { children?: ReactNode }) {
  warnButtonLegacyProps(node)

  const href = String(node.meta?.href ?? node.props.href ?? '#')
  const navLink =
    node.props.navLink === true || String(node.props.navLink).toLowerCase() === 'true'
  const parseSubMenu = (): Array<{ label: string; href: string }> => {
    const raw = node.props.subMenu
    if (Array.isArray(raw)) {
      return raw
        .filter((item): item is { label: unknown; href: unknown } => !!item && typeof item === 'object')
        .map((item) => ({
          label: String(item.label ?? ''),
          href: String(item.href ?? '#'),
        }))
        .filter((item) => item.label.trim().length > 0)
    }
    if (typeof raw === 'string') {
      try {
        const parsed = JSON.parse(raw) as unknown
        if (!Array.isArray(parsed)) return []
        return parsed
          .filter((item): item is { label: unknown; href: unknown } => !!item && typeof item === 'object')
          .map((item) => ({
            label: String(item.label ?? ''),
            href: String(item.href ?? '#'),
          }))
          .filter((item) => item.label.trim().length > 0)
      } catch {
        return []
      }
    }
    return []
  }
  const subMenu = parseSubMenu()

  if (navLink) {
    return (
      <div className="nav-item">
        <a href={href} className="nav-link">
          {node.children.length > 0 ? children : String(node.props.label ?? '')}
        </a>
        {subMenu.length > 0 ? (
          <ul className="nav-submenu">
            {subMenu.map((item) => (
              <li key={`${item.label}-${item.href}`}>
                <a href={item.href}>{item.label}</a>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    )
  }

  if (node.children.length > 0) {
    return (
      <a href={href} role="button">
        {children}
      </a>
    )
  }

  const label = String(node.props.label ?? '')
  return (
    <a href={href} role="button">
      {label}
    </a>
  )
}

export function BlockInput({ node }: BlockRenderProps) {
  const type = String(node.props.type ?? 'text')
  const placeholder = String(node.props.placeholder ?? '')
  const value = String(node.props.value ?? '')
  return <input type={type} placeholder={placeholder || undefined} defaultValue={value} />
}

export function BlockTextField({ node }: BlockRenderProps) {
  const placeholder = String(node.props.placeholder ?? '')
  const value = String(node.props.value ?? '')
  return <input type="text" placeholder={placeholder || undefined} defaultValue={value} />
}

export function BlockTextArea({ node }: BlockRenderProps) {
  const placeholder = String(node.props.placeholder ?? '')
  const value = String(node.props.value ?? '')
  const rows = Math.max(2, Number(node.props.rows ?? 4))
  return <textarea placeholder={placeholder || undefined} defaultValue={value} rows={rows} />
}

export function BlockSelect({ children }: BlockRenderProps & { children?: ReactNode }) {
  return <select>{children}</select>
}

export function BlockOption({ node }: BlockRenderProps) {
  const value = String(node.props.value ?? '')
  const label = String(node.props.label ?? node.props.text ?? value)
  return <option value={value}>{label}</option>
}

export function BlockCheckbox({ node, children }: BlockRenderProps & { children?: ReactNode }) {
  const checked =
    node.props.checked === true || String(node.props.checked).toLowerCase() === 'true'
  const label = String(node.props.label ?? '')
  return (
    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <input type="checkbox" defaultChecked={checked} />
      {children ?? label}
    </label>
  )
}

export function BlockRadio({ node, children }: BlockRenderProps & { children?: ReactNode }) {
  const checked =
    node.props.checked === true || String(node.props.checked).toLowerCase() === 'true'
  const name = String(node.props.name ?? '')
  const label = String(node.props.label ?? '')
  return (
    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <input type="radio" name={name || undefined} defaultChecked={checked} />
      {children ?? label}
    </label>
  )
}

export function BlockLabel({ children }: BlockRenderProps & { children?: ReactNode }) {
  return <label>{children}</label>
}

export function BlockForm({ children }: BlockRenderProps & { children?: ReactNode }) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
      }}
    >
      {children}
    </form>
  )
}
