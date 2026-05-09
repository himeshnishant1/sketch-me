import { useDraggable } from '@dnd-kit/core'
import clsx from 'clsx'
import { componentRegistry } from '../../registry/componentRegistry'

function LibraryItem({ type, label }: { type: string; label: string }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `library:${type}`,
    data: { kind: 'library', blockType: type },
  })

  return (
    <button
      type="button"
      ref={setNodeRef}
      className={clsx('library-item', isDragging && 'library-item--dragging')}
      {...listeners}
      {...attributes}
    >
      {label}
    </button>
  )
}

export function BlockLibrary({
  minimized,
  onToggleMinimized,
}: {
  minimized: boolean
  onToggleMinimized: () => void
}) {
  const blocks = componentRegistry
    .list()
    .filter((b) => b.type !== 'Page')
    .sort((a, b) => {
      const cat = a.category.localeCompare(b.category)
      if (cat !== 0) return cat
      return a.label.localeCompare(b.label)
    })

  const byCat = new Map<string, typeof blocks>()
  for (const b of blocks) {
    const list = byCat.get(b.category) ?? []
    list.push(b)
    byCat.set(b.category, list)
  }

  return (
    <aside className={clsx('panel panel--library', minimized && 'panel--collapsed')} aria-label="Block library">
      <div className="panel__header">
        <h2 className="panel__title">Blocks</h2>
        <button type="button" className="btn btn--ghost panel__toggle" onClick={onToggleMinimized}>
          {minimized ? 'Expand' : 'Minimize'}
        </button>
      </div>
      {!minimized ? (
        <>
          <p className="panel__hint">Drag onto the highlighted drop zones on the canvas.</p>
          <div className="library-groups">
            {[...byCat.entries()].map(([category, items]) => (
              <div key={category} className="library-group">
                <h3 className="library-group__label">{category}</h3>
                <div className="library-group__items">
                  {items.map((b) => (
                    <LibraryItem key={b.type} type={b.type} label={b.label} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      ) : null}
    </aside>
  )
}
