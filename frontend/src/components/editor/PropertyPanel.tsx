import { useMemo } from 'react'
import clsx from 'clsx'
import { componentRegistry } from '../../registry/componentRegistry'
import { useEditorStore } from '../../stores/editorStore'
import { useThemeStore } from '../../stores/themeStore'
import { findWithParent } from '../../utils/tree'

export function PropertyPanel({
  minimized,
  onToggleMinimized,
}: {
  minimized: boolean
  onToggleMinimized: () => void
}) {
  const tree = useEditorStore((s) => s.tree)
  const selectedId = useEditorStore((s) => s.selectedId)
  const updateNodeProps = useEditorStore((s) => s.updateNodeProps)
  const updateNodeStyles = useEditorStore((s) => s.updateNodeStyles)
  const updateNodeMeta = useEditorStore((s) => s.updateNodeMeta)
  const deleteNode = useEditorStore((s) => s.deleteNode)
  const moveSibling = useEditorStore((s) => s.moveSibling)

  const node = useMemo(() => {
    if (!selectedId) return null
    return findWithParent(tree, selectedId)?.target ?? null
  }, [tree, selectedId])

  const def = node ? componentRegistry.get(node.type) : undefined

  const tokens = useThemeStore((s) => s.tokens)
  const setToken = useThemeStore((s) => s.setToken)

  if (!node || !def) {
    return (
      <aside className={clsx('panel panel--props', minimized && 'panel--collapsed')} aria-label="Properties">
        <div className="panel__header">
          <h2 className="panel__title">Properties</h2>
          <button type="button" className="btn btn--ghost panel__toggle" onClick={onToggleMinimized}>
            {minimized ? 'Expand' : 'Minimize'}
          </button>
        </div>
        {!minimized ? <p className="panel__muted">Select a block on the canvas.</p> : null}
      </aside>
    )
  }

  return (
    <aside className={clsx('panel panel--props', minimized && 'panel--collapsed')} aria-label="Properties">
      <div className="panel__header">
        <h2 className="panel__title">Properties</h2>
        <button type="button" className="btn btn--ghost panel__toggle" onClick={onToggleMinimized}>
          {minimized ? 'Expand' : 'Minimize'}
        </button>
      </div>
      {!minimized ? (
        <>
          <p className="panel__meta">
            {def.label}
            <span className="mono">{node.type}</span>
          </p>

          {node.id !== 'page-root' ? (
            <div className="prop-actions">
              <button type="button" className="btn btn--ghost" onClick={() => moveSibling(node.id, -1)}>
                Move up
              </button>
              <button type="button" className="btn btn--ghost" onClick={() => moveSibling(node.id, 1)}>
                Move down
              </button>
              <button type="button" className="btn btn--danger" onClick={() => deleteNode(node.id)}>
                Delete
              </button>
            </div>
          ) : null}

          <section className="prop-section">
        <h3 className="prop-section__title">Meta (AI / tooling)</h3>
        <p className="panel__muted small">
          Optional hints — not rendered by blocks except heading level, link target, and image URLs when set.
        </p>
        <label className="field">
          <span className="field__label">role</span>
          <input
            className="field__input mono"
            type="text"
            value={String(node.meta?.role ?? '')}
            placeholder="navbar-left, hero-heading, …"
            onChange={(e) =>
              updateNodeMeta(node.id, {
                role: e.target.value.trim() ? e.target.value.trim() : undefined,
              })
            }
          />
        </label>
        {node.type === 'Heading' ? (
          <label className="field">
            <span className="field__label">headingLevel (1–6)</span>
            <input
              className="field__input"
              type="number"
              min={1}
              max={6}
              value={node.meta?.headingLevel ?? ''}
              placeholder="from meta"
              onChange={(e) => {
                const raw = e.target.value
                if (raw === '') {
                  updateNodeMeta(node.id, { headingLevel: undefined })
                  return
                }
                const n = Number(raw)
                if (n >= 1 && n <= 6) updateNodeMeta(node.id, { headingLevel: n as 1 | 2 | 3 | 4 | 5 | 6 })
              }}
            />
          </label>
        ) : null}
        {node.type === 'Button' ? (
          <label className="field">
            <span className="field__label">href (meta)</span>
            <input
              className="field__input"
              type="text"
              value={String(node.meta?.href ?? '')}
              placeholder="#"
              onChange={(e) =>
                updateNodeMeta(node.id, {
                  href: e.target.value.trim() ? e.target.value : undefined,
                })
              }
            />
          </label>
        ) : null}
        {node.type === 'Image' ? (
          <>
            <label className="field">
              <span className="field__label">src (meta)</span>
              <input
                className="field__input"
                type="text"
                value={String(node.meta?.src ?? '')}
                placeholder="https://…"
                onChange={(e) =>
                  updateNodeMeta(node.id, {
                    src: e.target.value.trim() ? e.target.value : undefined,
                  })
                }
              />
            </label>
            <label className="field">
              <span className="field__label">alt (meta)</span>
              <input
                className="field__input"
                type="text"
                value={String(node.meta?.alt ?? '')}
                onChange={(e) =>
                  updateNodeMeta(node.id, {
                    alt: e.target.value.trim() ? e.target.value : undefined,
                  })
                }
              />
            </label>
          </>
        ) : null}
          </section>

          {def.schema.length > 0 ? (
      <section className="prop-section">
        <h3 className="prop-section__title">Props (data / legacy)</h3>
        {def.schema.map((field) => {
          const value = node.props[field.key]
          const key = field.key
          if (field.type === 'text') {
            return (
              <label key={key} className="field">
                <span className="field__label">{field.label}</span>
                <input
                  className="field__input"
                  type="text"
                  value={String(value ?? '')}
                  placeholder={field.placeholder}
                  onChange={(e) => updateNodeProps(node.id, { [key]: e.target.value })}
                />
              </label>
            )
          }
          if (field.type === 'textarea') {
            return (
              <label key={key} className="field">
                <span className="field__label">{field.label}</span>
                <textarea
                  className="field__input field__textarea"
                  rows={4}
                  value={String(value ?? '')}
                  placeholder={field.placeholder}
                  onChange={(e) => updateNodeProps(node.id, { [key]: e.target.value })}
                />
              </label>
            )
          }
          if (field.type === 'number') {
            return (
              <label key={key} className="field">
                <span className="field__label">{field.label}</span>
                <input
                  className="field__input"
                  type="number"
                  min={field.min}
                  max={field.max}
                  value={Number(value ?? 0)}
                  onChange={(e) =>
                    updateNodeProps(node.id, { [key]: Number(e.target.value) })
                  }
                />
              </label>
            )
          }
          if (field.type === 'select') {
            return (
              <label key={key} className="field">
                <span className="field__label">{field.label}</span>
                <select
                  className="field__input"
                  value={String(value ?? field.options[0])}
                  onChange={(e) => updateNodeProps(node.id, { [key]: e.target.value })}
                >
                  {field.options.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </label>
            )
          }
          return null
        })}
      </section>
      ) : null}

          <section className="prop-section">
        <h3 className="prop-section__title">Styles</h3>
        <label className="field">
          <span className="field__label">Background</span>
          <input
            className="field__input"
            type="text"
            value={String(node.styles.backgroundColor ?? '')}
            placeholder="var(--color-surface) or #hex"
            onChange={(e) => updateNodeStyles(node.id, { backgroundColor: e.target.value })}
          />
        </label>
        <label className="field">
          <span className="field__label">Text color</span>
          <input
            className="field__input"
            type="text"
            value={String(node.styles.color ?? '')}
            onChange={(e) => updateNodeStyles(node.id, { color: e.target.value })}
          />
        </label>
        <label className="field">
          <span className="field__label">Padding</span>
          <input
            className="field__input"
            type="text"
            value={String(node.styles.padding ?? '')}
            placeholder="16px 24px"
            onChange={(e) => updateNodeStyles(node.id, { padding: e.target.value })}
          />
        </label>
          </section>

          <section className="prop-section">
        <h3 className="prop-section__title">Theme tokens</h3>
        <p className="panel__muted small">
          Updates CSS variables for the whole preview (see doc §3.4).
        </p>
        <label className="field">
          <span className="field__label">Primary</span>
          <input
            className="field__input"
            type="text"
            value={tokens['color-primary'] ?? ''}
            onChange={(e) => setToken('color-primary', e.target.value)}
          />
        </label>
        <label className="field">
          <span className="field__label">Surface</span>
          <input
            className="field__input"
            type="text"
            value={tokens['color-surface'] ?? ''}
            onChange={(e) => setToken('color-surface', e.target.value)}
          />
        </label>
          </section>
        </>
      ) : null}
    </aside>
  )
}
