// MODO HTML: para documentos ya diseñados (HTML + CSS + Handlebars).
//
//   [ Variables ]  [ Editor de código (CodeMirror) ]  [ Vista previa (iframe) ]
//
// 🔑 Fuente de verdad = el HTML TAL CUAL (con <style>, clases, {{#ifEquals}}...).
//    Nada se transforma: por eso el visor se ve igual que el documento original.
//
// Flujo de datos (todo lo demás es DERIVADO de `html`):
//   html (useState) ──▶ analyzeTemplate ──▶ variables ──▶ panel
//                   └─▶ renderPreview   ──▶ iframe
import { useDeferredValue, useMemo, useRef, useState } from 'react'
import CodeMirror, { type EditorView } from '@uiw/react-codemirror'
import { html as htmlLanguage } from '@codemirror/lang-html'
import { ImportHtmlDialog, type ImportMode } from '../editor/ImportHtmlDialog'
import { analyzeTemplate, type DetectedVariable } from './analyze'
import { DocumentPreview } from './DocumentPreview'
import { HtmlVariablePanel } from './HtmlVariablePanel'
import { renderPreview } from './preview'

const SAMPLE = `<!DOCTYPE html>
<html lang="es">
<head>
<style>
  body { font-family: Arial, sans-serif; font-size: 13px; margin: 0; }
  .page { width: 8.5in; min-height: 11in; padding: 0.6in; box-sizing: border-box; }
  h1 { text-align: center; letter-spacing: 4px; }
  table { width: 100%; border-collapse: collapse; }
  td, th { border: 1px solid #000; padding: 4px 6px; }
</style>
</head>
<body>
<div class="page">
  <h1>CONTRATO</h1>
  <p>Cliente: <strong>{{cliente-nombre}}</strong>, RUT {{cliente-rut}}.</p>
  {{#ifEquals medio-pago 1}}<p>Pago mediante PAC.</p>{{/ifEquals}}
  <table>
    <tr><th>Código</th><th>Descripción</th></tr>
    {{#each coberturas}}<tr><td>{{this.codigo}}</td><td>{{this.descripcion}}</td></tr>{{/each}}
  </table>
</div>
</body>
</html>`

// Extensiones de CodeMirror creadas UNA vez (fuera del componente): si se crearan en
// cada render, CodeMirror se reconfiguraría a cada tecla.
const codeExtensions = [htmlLanguage()]

export function HtmlTemplateWorkspace() {
  const [html, setHtml] = useState(SAMPLE)
  // Única configuración que no sale del HTML: obligatoria/opcional por clave.
  // Por defecto (clave ausente) = obligatoria.
  const [requiredByKey, setRequiredByKey] = useState<Record<string, boolean>>({})
  // Instancia de CodeMirror, para insertar en el cursor (igual que hicimos con TipTap).
  const viewRef = useRef<EditorView | null>(null)

  // 🔑 useDeferredValue: el editor se actualiza con cada tecla (urgente), pero el
  // análisis + vista previa (caro: 100 KB de HTML, recargar el iframe) usa un valor
  // "diferido" que React actualiza cuando hay tiempo. Escribir no se traba.
  const deferredHtml = useDeferredValue(html)

  // useMemo: recalcular SOLO si cambia el HTML (no en otros re-renders, p. ej. al
  // cambiar obligatoria/opcional).
  const analysis = useMemo(() => analyzeTemplate(deferredHtml), [deferredHtml])

  // Si el HTML está a medio escribir ({{#if}} sin cerrar), seguimos mostrando las
  // últimas variables válidas en vez de vaciar el panel.
  // (Patrón "ajustar estado según cambios": se permite setState durante el render
  //  si es condicional y converge. Alternativa sin él: guardarlo en un ref.)
  const [lastVariables, setLastVariables] = useState<DetectedVariable[]>([])
  if (analysis.ok && analysis.variables !== lastVariables) {
    setLastVariables(analysis.variables)
  }
  const variables = analysis.ok ? analysis.variables : lastVariables

  const preview = useMemo(() => renderPreview(deferredHtml, variables), [deferredHtml, variables])
  const [lastPreviewHtml, setLastPreviewHtml] = useState('')
  if (preview.ok && preview.html !== lastPreviewHtml) {
    setLastPreviewHtml(preview.html)
  }

  const error = !analysis.ok ? analysis.error : !preview.ok ? preview.error : null

  function isRequired(key: string) {
    return requiredByKey[key] ?? true
  }

  function handleToggleRequired(key: string) {
    setRequiredByKey((prev) => ({ ...prev, [key]: !(prev[key] ?? true) }))
  }

  function handleInsert(snippet: string) {
    const view = viewRef.current
    if (!view) return
    // Reemplaza la selección (o inserta en el cursor) y deja el cursor detrás.
    view.dispatch(view.state.replaceSelection(snippet))
    view.focus()
  }

  function handleImport(imported: string, mode: ImportMode) {
    if (mode === 'replace') {
      setHtml(imported) // CodeMirror recibe el nuevo `value` y se actualiza
    } else {
      handleInsert(imported)
    }
  }

  return (
    <div className="html-workspace">
      <HtmlVariablePanel
        variables={variables}
        isRequired={isRequired}
        onToggleRequired={handleToggleRequired}
        onInsert={handleInsert}
      />

      <section className="code-section">
        <div className="section-header">
          <h2>HTML</h2>
          <ImportHtmlDialog
            onImport={handleImport}
            hint="El HTML se conserva tal cual (estilos, clases, Handlebars). Los <script> no se ejecutan en la vista previa."
          />
        </div>
        {/* CodeMirror "controlado": value + onChange. A diferencia de TipTap, aquí SÍ
            funciona, porque la librería compara el value nuevo con su documento y solo
            aplica la diferencia (no reinicia cursor ni historial). */}
        <CodeMirror
          value={html}
          onChange={setHtml}
          extensions={codeExtensions}
          theme="dark"
          height="calc(100vh - 170px)"
          onCreateEditor={(view) => {
            viewRef.current = view
          }}
        />
        {error && <p className="error code-error">⚠️ {error}</p>}
      </section>

      <DocumentPreview html={lastPreviewHtml} />
    </div>
  )
}
