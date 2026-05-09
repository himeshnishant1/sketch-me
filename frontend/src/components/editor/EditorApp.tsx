import { useEffect } from 'react'
import { registerBuiltinBlocks } from '../../registry/registerBuiltinBlocks'
import { initThemeDom } from '../../stores/themeStore'
import { useEditorStore } from '../../stores/editorStore'
import { EditorLayout } from './EditorLayout'

registerBuiltinBlocks()

export function EditorApp() {
  const loadPersisted = useEditorStore((s) => s.loadPersisted)

  useEffect(() => {
    initThemeDom()
    loadPersisted()
  }, [loadPersisted])

  return <EditorLayout />
}
