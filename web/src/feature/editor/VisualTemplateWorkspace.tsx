// MODO VISUAL (TipTap): para crear documentos SENCILLOS desde cero.
// (Para documentos ya diseñados con CSS/Handlebars -> modo HTML, src/feature/html-template.)
//
// Quién es dueño de qué:
//   VisualTemplateWorkspace
//   ├─ editor (useEditor)          -> instancia compartida por barra, área y panel
//   ├─ variables (useState)        -> definiciones { key, label, required }
//   ├─ html (useState)             -> copia del HTML del editor (onCreate/onUpdate)
//   └─ usedKeys (useEditorState)   -> DERIVADO del documento: comodines presentes
//
//   VariablePanel    ── onAdd / onRemove / onInsert / onToggleRequired ──▶ App
//   ImportHtmlDialog ── onImport(html, mode) ──▶ App
//   TemplateEditor   ◀── editor
import { useState } from 'react'
import { useEditor, useEditorState } from '@tiptap/react'
import { editorExtensions } from './extensions'
import { ImportHtmlDialog, type ImportMode } from './ImportHtmlDialog'
import { convertPlaceholders } from './placeholders'
import { TemplateEditor } from './TemplateEditor'
import { VariablePanel } from './VariablePanel'
import { labelFromKey, type TemplateVariable } from '../template/types'

// Contenido inicial de ejemplo (en el paso 4 vendrá de la API). Los <span data-variable>
// se convierten en chips gracias al parseHTML del VariableNode.
const INITIAL_HTML = `
<h1 style="text-align: center">Contrato de servicios</h1>
<p>En Santiago, a <span data-variable="fecha"></span>, comparece
<span data-variable="cliente_nombre"></span>, en adelante <em>el Cliente</em>.</p>
<p>El monto acordado es de $ <span data-variable="monto"></span>.</p>
`

const INITIAL_VARIABLES: TemplateVariable[] = [
  { key: 'cliente_nombre', label: 'Nombre del cliente', required: true },
  { key: 'fecha', label: 'Fecha', required: true },
  { key: 'monto', label: 'Monto', required: true },
  { key: 'cliente_rut', label: 'RUT del cliente', required: false },
]

export function VisualTemplateWorkspace() {
  const [variables, setVariables] = useState(INITIAL_VARIABLES)
  const [html, setHtml] = useState('')

  const editor = useEditor({
    extensions: editorExtensions,
    content: INITIAL_HTML,
    onCreate: ({ editor }) => setHtml(editor.getHTML()),
    onUpdate: ({ editor }) => setHtml(editor.getHTML()),
    editorProps: {
      // Al PEGAR HTML (p. ej. desde Word o una web), convertir los "{{clave}}" en chips.
      // Es una función pura: recibe HTML y devuelve HTML.
      transformPastedHTML: (pasted) => convertPlaceholders(pasted).html,
    },
  })

  // Recorremos el documento y juntamos las claves de los nodos 'variable'.
  // useEditorState re-renderiza App solo si la lista resultante cambia.
  const usedKeys = useEditorState({
    editor,
    selector: ({ editor }) => {
      const keys: string[] = []
      editor.state.doc.descendants((node) => {
        const key: unknown = node.attrs.key
        if (node.type.name === 'variable' && typeof key === 'string' && !keys.includes(key)) {
          keys.push(key)
        }
      })
      return keys
    },
  })

  // --- Callbacks que bajan a los hijos (siempre actualizaciones INMUTABLES) ---
  function handleAddVariables(newVariables: TemplateVariable[]) {
    // Updater (prev => ...): si llegan varias seguidas, cada una parte del valor más reciente.
    setVariables((prev) => [
      ...prev,
      ...newVariables.filter((n) => !prev.some((v) => v.key === n.key)), // sin duplicados
    ])
  }

  function handleRemoveVariable(key: string) {
    setVariables((prev) => prev.filter((v) => v.key !== key))
  }

  function handleToggleRequired(key: string) {
    // map + spread: copia nueva SOLO del elemento que cambia.
    setVariables((prev) => prev.map((v) => (v.key === key ? { ...v, required: !v.required } : v)))
  }

  function handleInsertVariable(key: string) {
    // Comando que definimos en VariableNode (tipado gracias al `declare module`).
    editor.chain().focus().insertVariable(key).run()
  }

  function handleImport(rawHtml: string, mode: ImportMode) {
    // 1. "{{clave}}" (texto) -> <span data-variable="clave"> (chip).
    const { html: converted, found } = convertPlaceholders(rawHtml)

    // 2. Meterlo en el editor. TipTap descarta lo que sus extensiones no conocen
    //    (scripts, imágenes, estilos...). Se puede deshacer con Ctrl+Z.
    if (mode === 'replace') {
      editor.chain().focus().setContent(converted).run()
    } else {
      editor.chain().focus().insertContent(converted).run()
    }

    // 3. Definir automáticamente los comodines nuevos (obligatorios por defecto).
    //    Etiqueta: el texto original si ya era una frase ({{Nombre del cliente}}); si no
    //    (deudorRut, cliente_nombre), una versión legible de la clave.
    handleAddVariables(
      found.map(({ raw, key }) => ({
        key,
        label: raw.includes(' ') ? raw : labelFromKey(key),
        required: true,
      })),
    )
  }

  // ESTADO DERIVADO: lo que se enviaría a la API (paso 4). La API además descarta
  // las variables no usadas; aquí lo hacemos igual para verlo.
  const payload = {
    html,
    variables: variables.filter((v) => usedKeys.includes(v.key)),
  }

  return (
      <div className="workspace">
        <VariablePanel
          variables={variables}
          usedKeys={usedKeys}
          onAdd={handleAddVariables}
          onRemove={handleRemoveVariable}
          onInsert={handleInsertVariable}
          onToggleRequired={handleToggleRequired}
        />

        <section>
          <div className="section-header">
            <h2>Editor</h2>
            <ImportHtmlDialog onImport={handleImport} />
          </div>
          <TemplateEditor editor={editor} />

          {/* <details>: plegable nativo, sin estado de React. Cerrado por defecto para
              dejar el espacio al editor. */}
          <details className="payload">
            <summary>Datos a guardar (JSON)</summary>
            <pre className="html-output">{JSON.stringify(payload, null, 2)}</pre>
          </details>
        </section>
      </div>
  )
}
