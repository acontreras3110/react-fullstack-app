// App: cabecera + editor de plantillas (cargar/guardar en la API desde el paso 4).
//
// Un solo editor para todo: el HTML de la plantilla se edita SIN código (vista Diseño,
// directamente sobre el documento) o CON código (vista Código), y ambos se sincronizan.
// (El editor TipTap de los pasos 2 y 3 se retiró: no respetaba documentos maquetados.
//  Sigue en el historial de git como referencia.)
import { TemplateEditorPage } from './feature/templates/TemplateEditorPage'
import { ApiStatus } from './feature/health/ApiStatus'

function App() {
  return (
    <main className="app app-html">
      <header className="app-header">
        <h1>Plantillas</h1>
        <ApiStatus />
      </header>
      <TemplateEditorPage />
    </main>
  )
}

export default App
