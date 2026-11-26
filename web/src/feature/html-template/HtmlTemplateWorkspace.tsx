// Editor de plantillas: UN solo HTML, varias formas de verlo/editarlo.
//
//   [ Diseño ]      editar el documento real sin código (iframe editable)
//   [ Código ]      editar el HTML (CodeMirror)
//   [ Dividido ]    código + diseño a la vez, sincronizados
//   [ Vista previa] cómo queda al rellenarlo (listas expandidas, condiciones marcadas)
//
// 🔑 Fuente de verdad ÚNICA = `html` (useState aquí). Diseño y Código son dos "ventanas"
//    que lo leen y lo modifican; todo lo demás (variables, vista previa) es DERIVADO.
//
//   DesignEditor ──onChange(html)──┐
//   CodeMirror   ──onChange(html)──┼──▶ setHtml ──▶ analyzeTemplate ──▶ panel de variables
//   Importar     ──setHtml─────────┘             └─▶ renderPreview   ──▶ vista previa
import { useDeferredValue, useMemo, useRef, useState } from 'react'
import CodeMirror, { type EditorView } from '@uiw/react-codemirror'
import { html as htmlLanguage } from '@codemirror/lang-html'
import { analyzeTemplate, type DetectedVariable } from './analyze'
import { DesignEditor, type DesignEditorHandle } from './DesignEditor'
import { DocumentPreview } from './DocumentPreview'
import { HtmlVariablePanel } from './HtmlVariablePanel'
import { ImportHtmlDialog, type ImportMode } from './ImportHtmlDialog'
import { renderPreview } from './preview'
import { BLANK_TEMPLATE } from './blankTemplate'

type View = 'design' | 'code' | 'split' | 'preview'

const VIEWS: { value: View; label: string }[] = [
  { value: 'design', label: '✎ Diseño' },
  { value: 'code', label: '</> Código' },
  { value: 'split', label: '◫ Dividido' },
  { value: 'preview', label: '👁 Vista previa' },
]

// Extensiones de CodeMirror creadas UNA vez (fuera del componente): si se crearan en
// cada render, CodeMirror se reconfiguraría a cada tecla.
const codeExtensions = [htmlLanguage()]

export function HtmlTemplateWorkspace() {
  const [html, setHtml] = useState(BLANK_TEMPLATE)
  const [view, setView] = useState<View>('design')
  // Única configuración que no sale del HTML: obligatoria/opcional por clave.
  const [requiredByKey, setRequiredByKey] = useState<Record<string, boolean>>({})

  // Instancias de los dos editores, para "insertar en el cursor" desde el panel.
  const codeViewRef = useRef<EditorView | null>(null)
  const designRef = useRef<DesignEditorHandle>(null)
  // ¿Cuál se usó por última vez? (en la vista dividida decide dónde insertar).
  // Ref y no estado: no hace falta re-renderizar al cambiar el foco.
  const lastFocusedRef = useRef<'design' | 'code'>('design')

  // useDeferredValue: análisis + vista previa (caros) con un valor "diferido";
  // escribir en cualquiera de los editores no se traba.
  const deferredHtml = useDeferredValue(html)
  const analysis = useMemo(() => analyzeTemplate(deferredHtml), [deferredHtml])

  // Si el HTML está a medio escribir ({{#if}} sin cerrar) se mantienen las últimas
  // variables válidas (setState condicional durante el render: converge en 1 paso).
  const [lastVariables, setLastVariables] = useState<DetectedVariable[]>([])
  if (analysis.ok && analysis.variables !== lastVariables) {
    setLastVariables(analysis.variables)
  }
  const variables = analysis.ok ? analysis.variables : lastVariables

  // La vista previa solo se calcula si se está mostrando.
  const preview = useMemo(
    () => (view === 'preview' ? renderPreview(deferredHtml, variables) : null),
    [view, deferredHtml, variables],
  )

  const error = !analysis.ok ? analysis.error : preview && !preview.ok ? preview.error : null

  const showDesign = view === 'design' || view === 'split'
  const showCode = view === 'code' || view === 'split'

  function handleInsert(snippet: string) {
    const target = view === 'split' ? lastFocusedRef.current : view
    if (target === 'design') {
      designRef.current?.insert(snippet)
    } else if (target === 'code' && codeViewRef.current) {
      const cm = codeViewRef.current
      cm.dispatch(cm.state.replaceSelection(snippet))
      cm.focus()
    }
  }

  function handleImport(imported: string, mode: ImportMode) {
    if (mode === 'replace') setHtml(imported)
    else handleInsert(imported)
  }

  function handleNew() {
    if (window.confirm('¿Empezar un documento en blanco? Se perderá el contenido actual.')) {
      setHtml(BLANK_TEMPLATE)
    }
  }

  return (
    <div className="html-workspace">
      <HtmlVariablePanel
        variables={variables}
        isRequired={(key) => requiredByKey[key] ?? true}
        onToggleRequired={(key) => setRequiredByKey((prev) => ({ ...prev, [key]: !(prev[key] ?? true) }))}
        onInsert={handleInsert}
        insertDisabled={view === 'preview'}
      />

      <section className="editor-area">
        <div className="section-header">
          <nav className="view-tabs" aria-label="Vista">
            {VIEWS.map((v) => (
              <button key={v.value} type="button" aria-pressed={view === v.value} onClick={() => setView(v.value)}>
                {v.label}
              </button>
            ))}
          </nav>
          <div className="section-actions">
            <button type="button" onClick={handleNew}>
              Nuevo
            </button>
            <ImportHtmlDialog
              onImport={handleImport}
              hint="El HTML se conserva tal cual (estilos, clases, Handlebars). Los <script> no se ejecutan."
            />
          </div>
        </div>
        {error && <p className="error code-error">⚠️ {error}</p>}

        <div className={`editor-panes ${view === 'split' ? 'split' : ''}`}>
          {showCode && (
            <div className="code-pane" onFocus={() => (lastFocusedRef.current = 'code')}>
              {/* CodeMirror "controlado" (value + onChange): la librería aplica solo la
                  diferencia, así que el cursor no salta aunque `html` cambie desde Diseño. */}
              <CodeMirror
                value={html}
                onChange={setHtml}
                extensions={codeExtensions}
                theme="dark"
                height="calc(100vh - 190px)"
                onCreateEditor={(cmView) => {
                  codeViewRef.current = cmView
                }}
              />
            </div>
          )}
          {showDesign && (
            <DesignEditor
              ref={designRef}
              html={html}
              onChange={setHtml}
              onFocus={() => (lastFocusedRef.current = 'design')}
            />
          )}
          {view === 'preview' && preview?.ok && <DocumentPreview html={preview.html} />}
        </div>
      </section>
    </div>
  )
}
