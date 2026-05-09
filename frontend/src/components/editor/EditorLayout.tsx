import { useEffect } from 'react'
import { useEditorStore } from '../../stores/editorStore'
import { findWithParent } from '../../utils/tree'
import { AiChatWidget } from './AiChatWidget'
import { Canvas } from './Canvas'
import { Toolbar } from './Toolbar'

export function EditorLayout() {
  const undo = useEditorStore((s) => s.undo)
  const redo = useEditorStore((s) => s.redo)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey
      if (meta && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        if (e.shiftKey) redo()
        else undo()
        return
      }
      if (e.key === 'Escape') {
        const id = useEditorStore.getState().selectedId
        if (!id) return
        const tree = useEditorStore.getState().tree
        const hit = findWithParent(tree, id)
        if (hit?.parent) useEditorStore.getState().setSelectedId(hit.parent.id)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [redo, undo])

  return (
    <div className="editor-root">
      <Toolbar />
      <div
        className="editor-body"
      >
        <Canvas />
      </div>
      <AiChatWidget />
    </div>
  )
}
