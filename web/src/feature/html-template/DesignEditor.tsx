// Vista DISEÑO: el documento real (iframe) se vuelve EDITABLE.
//
// 🔑 Igual que TipTap en el paso 2, es un editor NO CONTROLADO:
//   - Carga el HTML una vez (srcDoc). El navegador gestiona cursor, selección y deshacer.
//   - Cada cambio (evento `input`) se serializa y se AVISA al padre con onChange(html).
//   - ❌ Si recargáramos el iframe con cada cambio que nosotros mismos emitimos, el cursor
//     saltaría al inicio en cada tecla. Por eso recordamos lo último emitido
//     (`lastEmittedRef`) y SOLO recargamos ante cambios EXTERNOS (código, importar).
//
// Edición: `body.contentEditable = 'true'` + document.execCommand (negrita, alinear,
// insertar HTML...). execCommand está "deprecated" pero sigue siendo la única API que
// integra los cambios con el deshacer nativo (Ctrl+Z) del navegador.
import { useEffect, useImperativeHandle, useMemo, useRef, useState, type Ref } from 'react'
import { blockLabel, decodeHbComment, fromDesignDocument, toDesignHtml } from './designDoc'

// Lo que el padre puede pedirle a este componente (vía ref): insertar en el cursor.
export type DesignEditorHandle = {
  insert: (snippet: string) => void
}

type DesignEditorProps = {
  html: string
  onChange: (html: string) => void
  ref?: Ref<DesignEditorHandle> // React 19: `ref` es un prop normal (sin forwardRef)
  onFocus?: () => void
}

// Estilos SOLO de la vista Diseño (se quitan al serializar: data-design-ui).
const DESIGN_CSS = `<style data-design-ui>
  .__hb-chip { background: #ffe58a; color: #5a4300; border-radius: 3px; padding: 0 3px;
               outline: 1px dashed #c9a400; cursor: default; font: inherit; white-space: nowrap; }
  .__hb-block { display: inline-block; font: 10px/1.5 system-ui, sans-serif; background: #6b8afd;
                color: #fff; padding: 0 5px; border-radius: 3px; margin: 1px 2px; user-select: none;
                cursor: default; }
  [data-design-mark] > td, [data-design-mark] > th { outline: 1px dashed #6b8afd; outline-offset: -1px; }
  [no-print-layout] { display: none !important; }
  body[contenteditable] { outline: none; caret-color: #d0021b; }
</style>`

const TABLE_PARENTS = new Set(['TABLE', 'TBODY', 'THEAD', 'TFOOT', 'TR', 'COLGROUP'])
const ZOOM_OPTIONS = [0.5, 0.75, 1, 1.25]

type Format = { bold: boolean; italic: boolean; underline: boolean }

export function DesignEditor({ html, onChange, ref, onFocus }: DesignEditorProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  // HTML actualmente cargado en el iframe (cambiarlo = recargar el iframe).
  const [loadedHtml, setLoadedHtml] = useState(html)
  // Último HTML que emitimos nosotros (para no recargar con nuestro propio cambio).
  const lastEmittedRef = useRef(html)
  const syncTimerRef = useRef<number | undefined>(undefined)
  const [zoom, setZoom] = useState(0.75)
  const [height, setHeight] = useState(1056)
  const [format, setFormat] = useState<Format>({ bold: false, italic: false, underline: false })

  // "Latest ref": los listeners del iframe se registran UNA vez por carga; si leyeran
  // `onChange` directamente, usarían la versión de ese render (stale closure). Con una
  // ref siempre llaman a la última. Se actualiza en un efecto (no durante el render).
  const onChangeRef = useRef(onChange)
  const onFocusRef = useRef(onFocus)
  useEffect(() => {
    onChangeRef.current = onChange
    onFocusRef.current = onFocus
  })

  // Cambios EXTERNOS (código, importar): recargar, pero con un pequeño retardo para no
  // recargar 100 KB en cada tecla escrita en el editor de código.
  // useEffect + setTimeout + cleanup = sincronizar con algo externo (un temporizador).
  useEffect(() => {
    if (html === lastEmittedRef.current || html === loadedHtml) return
    const timer = setTimeout(() => {
      lastEmittedRef.current = html
      setLoadedHtml(html)
    }, 400)
    return () => clearTimeout(timer) // si llega otra tecla antes, se cancela
  }, [html, loadedHtml])

  // Cancelar una sincronización pendiente si el componente se desmonta.
  useEffect(() => () => clearTimeout(syncTimerRef.current), [])

  const wasFullDocument = /<html[\s>]/i.test(loadedHtml)
  const srcDoc = useMemo(() => {
    const design = toDesignHtml(loadedHtml)
    return design.includes('</head>') ? design.replace('</head>', `${DESIGN_CSS}</head>`) : DESIGN_CSS + design
  }, [loadedHtml])

  function getDoc() {
    return iframeRef.current?.contentDocument ?? null
  }

  // Documento editado -> plantilla -> padre. Con "debounce": serializar 100 KB en cada
  // tecla sería caro; esperamos 300 ms de pausa.
  function scheduleSync() {
    clearTimeout(syncTimerRef.current)
    syncTimerRef.current = window.setTimeout(() => {
      const doc = getDoc()
      if (!doc) return
      const out = fromDesignDocument(doc, wasFullDocument)
      lastEmittedRef.current = out
      onChangeRef.current(out)
    }, 300)
  }

  function updateFormat() {
    const doc = getDoc()
    if (!doc) return
    setFormat({
      bold: doc.queryCommandState('bold'),
      italic: doc.queryCommandState('italic'),
      underline: doc.queryCommandState('underline'),
    })
  }

  // Se ejecuta cada vez que el iframe termina de cargar (srcDoc nuevo).
  function handleLoad() {
    const doc = getDoc()
    if (!doc?.body) return
    decorateBlocks(doc)
    doc.body.contentEditable = 'true'
    doc.body.spellcheck = false
    doc.addEventListener('input', scheduleSync)
    doc.addEventListener('selectionchange', updateFormat)
    doc.addEventListener('focusin', () => onFocusRef.current?.())
    setHeight(Math.max(doc.documentElement.scrollHeight, doc.body.scrollHeight))
  }

  function exec(command: string, value?: string) {
    const doc = getDoc()
    if (!doc) return
    iframeRef.current?.contentWindow?.focus() // recupera la selección que había en el iframe
    doc.execCommand(command, false, value)
    updateFormat()
    scheduleSync() // execCommand dispara `input` en la mayoría de casos; por si acaso
  }

  // API imperativa para el padre (insertar comodín desde el panel).
  useImperativeHandle(ref, () => ({
    insert(snippet: string) {
      // ❌ execCommand('insertHTML'): Chrome saca el chip FUERA del párrafo si el cursor
      //    está al final de un bloque (comprobado). ✅ Range API: inserción exacta.
      //    Contra: esa inserción no entra en el Ctrl+Z nativo (el chip se borra con Retroceso).
      const doc = getDoc()
      const win = iframeRef.current?.contentWindow
      if (!doc || !win) return
      win.focus() // recupera la selección que había en el iframe
      const selection = doc.getSelection()
      let range = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null
      if (!range || !doc.body.contains(range.commonAncestorContainer)) {
        // Sin cursor en el documento: insertar al final.
        range = doc.createRange()
        range.selectNodeContents(doc.body)
        range.collapse(false)
      }
      // Misma conversión que al cargar: {{a}} -> chip; {{#each}} -> comentarios + chips.
      const template = doc.createElement('template')
      template.innerHTML = toDesignHtml(snippet)
      const lastNode = template.content.lastChild
      range.deleteContents() // si había texto seleccionado, el comodín lo reemplaza
      range.insertNode(template.content)
      if (lastNode) {
        range.setStartAfter(lastNode) // cursor justo detrás de lo insertado
        range.collapse(true)
        selection?.removeAllRanges()
        selection?.addRange(range)
      }
      decorateBlocks(doc) // etiquetas para bloques nuevos ({{#each}} insertado)
      scheduleSync()
    },
  }))

  return (
    <div className="preview design-editor">
      <div className="preview-toolbar design-toolbar">
        <div className="design-format" role="toolbar" aria-label="Formato">
          <FormatButton label="Deshacer" text="↶" onClick={() => exec('undo')} />
          <FormatButton label="Rehacer" text="↷" onClick={() => exec('redo')} />
          <span className="toolbar-sep" />
          <FormatButton label="Negrita" text="B" active={format.bold} onClick={() => exec('bold')} />
          <FormatButton label="Cursiva" text="I" active={format.italic} onClick={() => exec('italic')} />
          <FormatButton label="Subrayado" text="U" active={format.underline} onClick={() => exec('underline')} />
          <span className="toolbar-sep" />
          <FormatButton label="Alinear a la izquierda" text="⯇" onClick={() => exec('justifyLeft')} />
          <FormatButton label="Centrar" text="≡" onClick={() => exec('justifyCenter')} />
          <FormatButton label="Alinear a la derecha" text="⯈" onClick={() => exec('justifyRight')} />
          <FormatButton label="Justificar" text="☰" onClick={() => exec('justifyFull')} />
        </div>
        <label>
          Zoom{' '}
          <select value={zoom} onChange={(e) => setZoom(Number(e.target.value))}>
            {ZOOM_OPTIONS.map((z) => (
              <option key={z} value={z}>
                {Math.round(z * 100)}%
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="preview-desk">
        <div className="preview-sheet" style={{ zoom }}>
          {/* Sin "allow-scripts": los <script> de la plantilla no corren. allow-same-origin:
              necesario para que NOSOTROS (el padre) podamos editar y leer su documento. */}
          <iframe
            ref={iframeRef}
            title="Documento editable"
            sandbox="allow-same-origin"
            srcDoc={srcDoc}
            onLoad={handleLoad}
            style={{ height }}
          />
        </div>
      </div>
    </div>
  )
}

// Marca visualmente los bloques Handlebars (que en el DOM son comentarios invisibles).
// Todo lo añadido lleva data-design-ui / data-design-mark y se quita al serializar.
function decorateBlocks(doc: Document) {
  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_COMMENT)
  const comments: Comment[] = []
  while (walker.nextNode()) comments.push(walker.currentNode as Comment)

  for (const comment of comments) {
    const mustache = decodeHbComment(comment)
    if (!mustache) continue
    // Idempotente: si ya tiene etiqueta (se llamó antes), no duplicarla.
    // (nodeType y no `instanceof Element`: el iframe tiene sus PROPIOS constructores,
    //  así que instanceof con el Element de la app daría siempre false.)
    const prev = comment.previousSibling
    if (prev?.nodeType === Node.ELEMENT_NODE && (prev as Element).hasAttribute('data-design-ui')) continue
    const parent = comment.parentElement
    if (parent && TABLE_PARENTS.has(parent.tagName)) {
      // Dentro de una tabla no puede ir un <span>: marcamos la fila siguiente.
      const next = comment.nextElementSibling
      if (next && !mustache.startsWith('{{/')) next.setAttribute('data-design-mark', blockLabel(mustache))
      continue
    }
    const label = doc.createElement('span')
    label.className = '__hb-block'
    label.contentEditable = 'false'
    label.setAttribute('data-design-ui', '')
    label.title = mustache
    label.textContent = blockLabel(mustache)
    comment.before(label)
  }
}

type FormatButtonProps = { label: string; text: string; onClick: () => void; active?: boolean }

function FormatButton({ label, text, onClick, active = false }: FormatButtonProps) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      // mousedown + preventDefault: el clic NO quita el foco/selección del iframe.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
    >
      {text}
    </button>
  )
}
