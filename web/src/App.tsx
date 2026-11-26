// App: cabecera + editor de plantillas.
//
// Un solo editor para todo: el HTML de la plantilla se edita SIN código (vista Diseño,
// directamente sobre el documento) o CON código (vista Código), y ambos se sincronizan.
// (El editor TipTap de los pasos 2 y 3 se retiró: no respetaba documentos maquetados.
//  Sigue en el historial de git como referencia.)
import { HtmlTemplateWorkspace } from './feature/html-template/HtmlTemplateWorkspace'
import { ApiStatus } from './feature/health/ApiStatus'

function App() {
  return (
    <main className="app app-html">
      <header className="app-header">
        <h1>Plantillas</h1>
        <ApiStatus />
      </header>
      <HtmlTemplateWorkspace />
    </main>
  )
}

export default App
