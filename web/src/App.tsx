// Paso 3: comodines como nodo propio + panel de variables.
//
// Quién es dueño de qué:
//   App
//   ├─ editor (useEditor)          -> instancia compartida por barra, área y panel
//   ├─ variables (useState)        -> definiciones { key, label, type }
//   ├─ html (useState)             -> copia del HTML del editor (onCreate/onUpdate)
//   └─ usedKeys (useEditorState)   -> DERIVADO del documento: comodines presentes
//
//   VariablePanel ── onAdd / onRemove / onInsert ──▶ App
//   TemplateEditor ◀── editor
import { useState } from 'react'
import { useEditor, useEditorState } from '@tiptap/react'
import { editorExtensions } from './feature/editor/extensions'
import { TemplateEditor } from './feature/editor/TemplateEditor'
import { VariablePanel } from './feature/editor/VariablePanel'
import { ApiStatus } from './feature/health/ApiStatus'
import type { TemplateVariable } from './feature/template/types'

// Contenido inicial de ejemplo (en el paso 4 vendrá de la API). Los <span data-variable>
// se convierten en chips gracias al parseHTML del VariableNode.
const INITIAL_HTML = `
<h1 style="text-align: center">Contrato de servicios</h1>
<p>En Santiago, a <span data-variable="fecha"></span>, comparece
<span data-variable="cliente_nombre"></span>, en adelante <em>el Cliente</em>.</p>
<p>El monto acordado es de $ <span data-variable="monto"></span>.</p>
`

const INITIAL_VARIABLES: TemplateVariable[] = [
  { key: 'cliente_nombre', label: 'Nombre del cliente', type: 'text' },
  { key: 'fecha', label: 'Fecha', type: 'date' },
  { key: 'monto', label: 'Monto', type: 'number' },
  { key: 'cliente_rut', label: 'RUT del cliente', type: 'text' },
]

function App() {
  const [variables, setVariables] = useState(INITIAL_VARIABLES)
  const [html, setHtml] = useState('')

  const editor = useEditor({
    extensions: editorExtensions,
    content: INITIAL_HTML,
    onCreate: ({ editor }) => setHtml(editor.getHTML()),
    onUpdate: ({ editor }) => setHtml(editor.getHTML()),
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

  // --- Callbacks que bajan al panel (siempre actualizaciones INMUTABLES) ---
  function handleAddVariable(variable: TemplateVariable) {
    setVariables((prev) => [...prev, variable])
  }

  function handleRemoveVariable(key: string) {
    setVariables((prev) => prev.filter((v) => v.key !== key))
  }

  function handleInsertVariable(key: string) {
    // Comando que definimos en VariableNode (tipado gracias al `declare module`).
    editor.chain().focus().insertVariable(key).run()
  }

  // ESTADO DERIVADO: lo que se enviaría a la API (paso 4). La API además descarta
  // las variables no usadas; aquí lo hacemos igual para verlo.
  const payload = {
    html,
    variables: variables.filter((v) => usedKeys.includes(v.key)),
  }

  return (
    <main className="app">
      <header className="app-header">
        <h1>Plantillas</h1>
        <ApiStatus />
      </header>

      <div className="workspace">
        <VariablePanel
          variables={variables}
          usedKeys={usedKeys}
          onAdd={handleAddVariable}
          onRemove={handleRemoveVariable}
          onInsert={handleInsertVariable}
        />

        <section>
          <h2>Editor</h2>
          <TemplateEditor editor={editor} />
        </section>

        <section>
          <h2>Datos a guardar</h2>
          <pre className="html-output">{JSON.stringify(payload, null, 2)}</pre>
        </section>
      </div>
    </main>
  )
}

export default App
