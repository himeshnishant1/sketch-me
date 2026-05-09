import { useRef, type ChangeEventHandler } from 'react'
import { useHistoryStore } from '../../stores/historyStore'
import { createDefaultPageTree, useEditorStore } from '../../stores/editorStore'
import type { Viewport } from '../../types/pageTree'
import { exportBuildFromTree } from '../../utils/exportBuild'
import { parsePageTreeFromText } from '../../utils/importTree'

export function Toolbar() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const viewport = useEditorStore((s) => s.viewport)
  const setViewport = useEditorStore((s) => s.setViewport)
  const undo = useEditorStore((s) => s.undo)
  const redo = useEditorStore((s) => s.redo)
  const tree = useEditorStore((s) => s.tree)
  const persist = useEditorStore((s) => s.persist)
  const setTree = useEditorStore((s) => s.setTree)
  const importTree = useEditorStore((s) => s.importTree)
  const loadPersisted = useEditorStore((s) => s.loadPersisted)

  const past = useHistoryStore((s) => s.past.length)
  const future = useHistoryStore((s) => s.future.length)

  const triggerImportPicker = () => fileInputRef.current?.click()

  const onImportFile: ChangeEventHandler<HTMLInputElement> = (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    const reader = new FileReader()
    reader.onload = () => {
      const text = typeof reader.result === 'string' ? reader.result : ''
      try {
        const tree = parsePageTreeFromText(text)
        importTree(tree)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        window.alert(`Could not import JSON.\n\n${msg}`)
      }
    }
    reader.onerror = () => window.alert('Could not read the file.')
    reader.readAsText(file, 'UTF-8')
  }

  const exportTree = () => {
    const blob = new Blob([JSON.stringify(tree, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'page-tree.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  const resetDemo = () => {
    if (!confirm('Reset to the demo layout? Unsaved local changes will be replaced.')) return
    useHistoryStore.getState().clear()
    setTree(createDefaultPageTree())
    persist()
  }

  return (
    <header className="editor-toolbar">
      <div className="editor-toolbar__brand">
        <strong>Sketch Me</strong>
      </div>

      <div className="editor-toolbar__cluster" role="group" aria-label="Viewport">
        {(['desktop', 'tablet', 'mobile'] as Viewport[]).map((v) => (
          <button
            key={v}
            type="button"
            className={`btn btn--toggle ${viewport === v ? 'is-on' : ''}`}
            onClick={() => setViewport(v)}
          >
            {v}
          </button>
        ))}
      </div>

      <div className="editor-toolbar__cluster" role="group" aria-label="History">
        <button type="button" className="btn btn--ghost" disabled={past === 0} onClick={undo}>
          Undo
        </button>
        <button type="button" className="btn btn--ghost" disabled={future === 0} onClick={redo}>
          Redo
        </button>
      </div>

      <div className="editor-toolbar__cluster">
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,application/json"
          className="visually-hidden"
          aria-hidden
          tabIndex={-1}
          onChange={onImportFile}
        />
        <button type="button" className="btn btn--ghost" onClick={triggerImportPicker}>
          Import JSON
        </button>
        <button type="button" className="btn btn--ghost" onClick={() => loadPersisted()}>
          Load saved
        </button>
        <button type="button" className="btn btn--ghost" onClick={exportTree}>
          Export JSON
        </button>
        <button type="button" className="btn btn--ghost" onClick={() => exportBuildFromTree(tree)}>
          Export Build
        </button>
        <button type="button" className="btn btn--danger-outline" onClick={resetDemo}>
          Reset demo
        </button>
      </div>
    </header>
  )
}
