// Editor WYSIWYG con TipTap.
//
// 🔑 CONCEPTO CLAVE: el editor tiene SU PROPIO ESTADO (un documento de ProseMirror),
// fuera de React. Es como un <input defaultValue="..."> (NO controlado):
//   - le damos el contenido INICIAL una vez,
//   - él gestiona cursor, selección, deshacer...,
//   - y nos AVISA de cada cambio (onUpdate) -> lo subimos al padre con un callback.
//
// ❌ Hacerlo "controlado" (value={html} + editor.commands.setContent(html) en cada
//    cambio) re-crea el documento a cada tecla: el cursor salta y se pierde el undo.
// ✅ Fuente de verdad mientras escribes = el editor. React solo recibe una COPIA (html).
import { EditorContent, useEditor } from '@tiptap/react'
import { editorExtensions } from './extensions'
import { Toolbar } from './Toolbar'

type TemplateEditorProps = {
  initialHtml: string // solo se lee al CREAR el editor (como defaultValue)
  onChange: (html: string) => void // editor -> padre (lifting state)
}

export function TemplateEditor({ initialHtml, onChange }: TemplateEditorProps) {
  // useEditor crea la instancia UNA vez (por montaje) y la conserva entre renders.
  const editor = useEditor({
    extensions: editorExtensions,
    content: initialHtml,
    // Al crearse: TipTap NORMALIZA el HTML inicial (quita saltos de línea, ajusta
    // etiquetas...). Avisamos ya, para que el padre tenga el HTML real desde el inicio.
    onCreate: ({ editor }) => onChange(editor.getHTML()),
    // Se llama en cada cambio del documento (escribir, negrita, deshacer...).
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  })

  return (
    <div className="editor">
      {/* La toolbar recibe la instancia por props y llama a sus comandos. */}
      <Toolbar editor={editor} />
      {/* EditorContent = el área editable (un contentEditable que maneja TipTap). */}
      <EditorContent editor={editor} className="editor-content" />
    </div>
  )
}
