// Editor WYSIWYG: barra + área editable. Componente PRESENTACIONAL: la instancia del
// editor la crea App (useEditor) y llega por props.
//
// ¿Por qué se movió useEditor a App? (paso 3)
//   El panel de variables necesita llamar a editor.insertVariable(...) y la vista de
//   "datos a guardar" necesita saber qué variables se usan. Si dos hermanos necesitan
//   lo mismo, se sube al padre común: es LIFTING STATE, aplicado a una instancia.
//
// 🔑 Recordatorio del paso 2: el editor es NO CONTROLADO. Tiene su propio estado
// (texto, cursor, deshacer) y avisa de los cambios; React guarda solo una copia.
import { EditorContent, type Editor } from '@tiptap/react'
import { Toolbar } from './Toolbar'

type TemplateEditorProps = {
  editor: Editor
}

export function TemplateEditor({ editor }: TemplateEditorProps) {
  return (
    <div className="editor">
      <Toolbar editor={editor} />
      {/* EditorContent = el área editable (un contentEditable que maneja TipTap). */}
      <EditorContent editor={editor} className="editor-content" />
    </div>
  )
}
