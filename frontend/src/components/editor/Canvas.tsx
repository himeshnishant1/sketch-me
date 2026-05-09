import { useMemo } from 'react'
import { useEditorStore } from '../../stores/editorStore'
import { buildPreviewDocumentFromTree } from '../../utils/exportBuild'

export function Canvas() {
  const tree = useEditorStore((s) => s.tree)
  const viewport = useEditorStore((s) => s.viewport)
  const previewDoc = useMemo(() => buildPreviewDocumentFromTree(tree), [tree])

  return (
    <div className="canvas-shell" data-viewport={viewport}>
      <div className="canvas-scroll">
        <div className="canvas-artboard">
          <iframe title="Website preview" className="canvas-preview-frame" srcDoc={previewDoc} />
        </div>
      </div>
    </div>
  )
}
