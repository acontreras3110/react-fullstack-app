// App: cabecera + selector de MODO de plantilla.
//
//   - HTML (diseñado): documentos ya maquetados (HTML + CSS + Handlebars). El HTML se
//     conserva TAL CUAL y se ve en un iframe tamaño carta -> se ve como el documento real.
//   - Visual (TipTap): documentos sencillos creados desde cero con un editor tipo Word.
//
// Renderizado condicional: solo se MONTA el modo activo. Al cambiar de modo, el otro se
// desmonta y pierde su estado (en el paso 4 cada plantilla se guardará en la API).
import { useState } from 'react'
import { HtmlTemplateWorkspace } from './feature/html-template/HtmlTemplateWorkspace'
import { VisualTemplateWorkspace } from './feature/editor/VisualTemplateWorkspace'
import { ApiStatus } from './feature/health/ApiStatus'

type Mode = 'html' | 'visual'

const MODES: { value: Mode; label: string }[] = [
  { value: 'html', label: 'Documento HTML (diseñado)' },
  { value: 'visual', label: 'Documento visual (simple)' },
]

function App() {
  const [mode, setMode] = useState<Mode>('html')

  return (
    <main className={`app app-${mode}`}>
      <header className="app-header">
        <h1>Plantillas</h1>
        <nav className="mode-tabs" aria-label="Tipo de plantilla">
          {MODES.map((m) => (
            <button
              key={m.value}
              type="button"
              aria-pressed={mode === m.value}
              onClick={() => setMode(m.value)}
            >
              {m.label}
            </button>
          ))}
        </nav>
        <ApiStatus />
      </header>

      {mode === 'html' ? <HtmlTemplateWorkspace /> : <VisualTemplateWorkspace />}
    </main>
  )
}

export default App
