import clsx from 'clsx'
import { memo } from 'react'
import { componentRegistry } from '../../registry/componentRegistry'
import type { BlockRenderProps } from '../../types/registry'
import type { PageNode } from '../../types/pageTree'
import { useEditorStore } from '../../stores/editorStore'
import { stylesForViewport, styleObjectToReactStyle } from '../../utils/styles'

function FallbackBlock({ node }: BlockRenderProps) {
  return (
    <div className="canvas-unknown" data-unknown={node.type}>
      Unknown block: {node.type}
    </div>
  )
}

export const CanvasNode = memo(function CanvasNode({ node }: { node: PageNode }) {
  const def = componentRegistry.get(node.type)
  const Component = def?.component ?? FallbackBlock
  const viewport = useEditorStore((s) => s.viewport)
  const selectedId = useEditorStore((s) => s.selectedId)

  const merged = stylesForViewport(node.styles, node.responsive, viewport)
  const reactStyle = styleObjectToReactStyle(merged)

  const selected = selectedId === node.id

  if (node.hidden) return null

  return (
    <div
      data-node-id={node.id}
      data-meta-role={node.meta?.role ?? undefined}
      className={clsx(
        'canvas-node',
        selected && 'canvas-node--selected',
      )}
      style={reactStyle}
    >
      <Component node={node}>
        {node.children.map((child) => (
          <CanvasNode key={child.id} node={child} />
        ))}
      </Component>
    </div>
  )
})
