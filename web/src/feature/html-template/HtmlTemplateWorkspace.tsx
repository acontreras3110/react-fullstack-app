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
//
// Paso 4 · Guardar/cargar: este componente recibe `initial` (lo que hay en la API) y guarda
// una copia como BASE (`saved`). "Sin guardar" = el borrador actual ≠ la base. DERIVADO.
import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import CodeMirror, { type EditorView } from '@uiw/react-codemirror'
import { html as htmlLanguage } from '@codemirror/lang-html'
import { analyzeTemplate, type DetectedVariable } from './analyze'
import { DesignEditor, type DesignEditorHandle } from './DesignEditor'
import { DocumentPreview } from './DocumentPreview'
import { HtmlVariablePanel } from './HtmlVariablePanel'
import { ImportHtmlDialog, type ImportMode } from './ImportHtmlDialog'
import { renderPreview } from './preview'
import { labelFromKey } from '../template/types'
import type { TemplateInput } from '../templates/api'
import { useDeleteTemplate, useSaveTemplate } from '../templates/queries'
import { TemplateBar } from '../templates/TemplateBar'

/** Lo que se edita (y se guarda) de una plantilla. Un `Template` de la API también encaja. */
export type TemplateDraft = TemplateInput

type HtmlTemplateWorkspaceProps = {
  templateId: number | null // null = aún no existe en la API
  initial: TemplateDraft //      solo se lee al MONTAR (el padre usa `key` para reiniciar)
  onOpen: (id: number | null) => void
}

const requiredMap = (d: TemplateDraft) => Object.fromEntries(d.variables.map((v) => [v.key, v.required]))

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

export function HtmlTemplateWorkspace({ templateId, initial, onOpen }: HtmlTemplateWorkspaceProps) {
  // Estado inicial desde la prop: useState solo usa `initial` en el PRIMER render.
  const [name, setName] = useState(initial.name)
  const [html, setHtml] = useState(initial.html)
  const [view, setView] = useState<View>('design')
  // Única configuración que no sale del HTML: obligatoria/opcional por clave.
  const [requiredByKey, setRequiredByKey] = useState<Record<string, boolean>>(() => requiredMap(initial))
  // BASE = última versión que la API confirmó. Comparar contra ella da "sin guardar".
  const [saved, setSaved] = useState(initial)

  const save = useSaveTemplate()
  const remove = useDeleteTemplate()

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

  // ---------- Cambios sin guardar (DERIVADO, nada de setIsDirty) ----------
  const isRequired = (key: string) => requiredByKey[key] ?? true
  const savedRequired = requiredMap(saved)
  const isDirty =
    name !== saved.name ||
    html !== saved.html ||
    variables.some((v) => isRequired(v.key) !== (savedRequired[v.key] ?? true))

  // Avisar al cerrar/recargar la pestaña con cambios. useEffect = SINCRONIZAR con algo
  // externo (window). Solo se registra mientras haya cambios; el cleanup lo quita.
  useEffect(() => {
    if (!isDirty) return
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [isDirty])

  function guardedOpen(id: number | null) {
    if (id === templateId && id !== null) return
    if (isDirty && !window.confirm('Hay cambios sin guardar. ¿Descartarlos?')) return
    onOpen(id)
  }

  function handleSave() {
    // ❌ Usar `variables` (del valor DIFERIDO): puede ir 1 tecla por detrás del html.
    // ✅ Analizar el html ACTUAL en el momento de guardar (evento = valor fresco).
    const current = analyzeTemplate(html)
    if (!current.ok) return
    const labels = Object.fromEntries(saved.variables.map((v) => [v.key, v.label]))
    const input: TemplateInput = {
      name: name.trim(),
      html,
      variables: current.variables.map((v) => ({
        key: v.key,
        label: labels[v.key] ?? labelFromKey(v.key),
        required: isRequired(v.key),
      })),
    }

    save.mutate(
      { id: templateId, input },
      {
        onSuccess: (result) => {
          if (templateId === null) {
            onOpen(result.id) // nueva -> ya tiene id: abrirla (la caché ya tiene el detalle)
            return
          }
          setSaved(result) // nueva BASE = lo que confirmó el servidor
          // El servidor pudo quitar <script>/on*: mostrar lo REALMENTE guardado...
          // ...pero solo si no seguiste escribiendo mientras viajaba la petición.
          // Updater funcional: recibe el html ACTUAL (no el del closure, que es viejo).
          setHtml((now) => (now === input.html ? result.html : now))
          setName((now) => (now === input.name ? result.name : now))
        },
      },
    )
  }

  function handleDelete() {
    if (templateId === null || !window.confirm(`¿Borrar "${saved.name}"? No se puede deshacer.`)) return
    remove.mutate(templateId, { onSuccess: () => onOpen(null) })
  }

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

  return (
    <>
      <TemplateBar
        templateId={templateId}
        name={name}
        onNameChange={setName}
        isDirty={isDirty}
        canSave={isDirty && name.trim() !== '' && analysis.ok}
        isSaving={save.isPending}
        saveError={save.error?.message ?? remove.error?.message ?? null}
        onSave={handleSave}
        onOpen={guardedOpen}
        onDelete={handleDelete}
        isDeleting={remove.isPending}
      />
      <div className="html-workspace">
        <HtmlVariablePanel
          variables={variables}
          isRequired={isRequired}
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
    </>
  )
}
