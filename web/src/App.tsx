// Paso 2: editor TipTap + vista del HTML que produce.
//
// Flujo de datos:
//   TemplateEditor (estado propio del editor)
//       └─ onChange(html) ──▶ App: setHtml(html) ──▶ re-render ──▶ <pre>{html}</pre>
//
// `html` es una COPIA del contenido del editor, guardada en App porque otros
// componentes la necesitarán (vista previa ahora; guardar en la API en el paso 4).
import { useState } from 'react'
import { TemplateEditor } from './feature/editor/TemplateEditor'
import { ApiStatus } from './feature/health/ApiStatus'

// Contenido inicial de ejemplo (en el paso 4 vendrá de la API).
const INITIAL_HTML = `
<h1 style="text-align: center">Contrato de servicios</h1>
<p>En Santiago, a <strong>[fecha]</strong>, comparece <strong>[cliente_nombre]</strong>,
en adelante <em>el Cliente</em>.</p>
<p>En el paso 3 estos [corchetes] serán comodines de verdad.</p>
`

function App() {
  const [html, setHtml] = useState(INITIAL_HTML)

  return (
    <main className="app">
      <header className="app-header">
        <h1>Plantillas</h1>
        <ApiStatus />
      </header>

      <div className="workspace">
        <section>
          <h2>Editor</h2>
          {/* setHtml se pasa tal cual como callback: misma firma (html: string) => void */}
          <TemplateEditor initialHtml={INITIAL_HTML} onChange={setHtml} />
        </section>

        <section>
          {/* ESTADO DERIVADO: se calcula en el render, no se guarda aparte. */}
          <h2>HTML generado ({html.length} caracteres)</h2>
          <pre className="html-output">{html}</pre>
        </section>
      </div>
    </main>
  )
}

export default App
