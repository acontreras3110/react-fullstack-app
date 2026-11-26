// VISOR del documento: un <iframe> con el HTML tal cual.
//
// ¿Por qué un iframe y no meter el HTML en un <div>?
//   ❌ <div dangerouslySetInnerHTML>: el CSS de la plantilla (`* { margin: 0 }`, `body {...}`,
//      `table {...}`) se mezclaría con el de la app y lo rompería todo (y al revés).
//   ✅ <iframe srcDoc>: es un DOCUMENTO aparte, con su propio CSS, igual que una pestaña
//      nueva. Se ve exactamente como el HTML original (y como lo imprimirá Playwright).
//
// Seguridad: sandbox="allow-same-origin" SIN "allow-scripts" -> los <script> de la
// plantilla NO se ejecutan. allow-same-origin solo sirve para que nosotros (el padre)
// podamos leer la altura del contenido y ajustar el iframe.
import { useState } from 'react'

const ZOOM_OPTIONS = [0.5, 0.6, 0.75, 1, 1.25]

type DocumentPreviewProps = {
  html: string
}

export function DocumentPreview({ html }: DocumentPreviewProps) {
  const [zoom, setZoom] = useState(0.6)
  // Altura del documento: solo se conoce cuando el iframe termina de cargar.
  const [height, setHeight] = useState(1056) // 11in a 96 dpi (una página carta)

  function handleLoad(e: React.SyntheticEvent<HTMLIFrameElement>) {
    const doc = e.currentTarget.contentDocument
    if (doc) setHeight(Math.max(doc.documentElement.scrollHeight, doc.body?.scrollHeight ?? 0))
  }

  return (
    <div className="preview">
      <div className="preview-toolbar">
        <span>Vista previa (tamaño carta)</span>
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

      {/* "Mesa" gris con scroll; dentro, la hoja escalada con CSS zoom. */}
      <div className="preview-desk">
        <div className="preview-sheet" style={{ zoom }}>
          <iframe
            title="Vista previa del documento"
            sandbox="allow-same-origin"
            srcDoc={html}
            onLoad={handleLoad}
            style={{ height }}
          />
        </div>
      </div>
    </div>
  )
}
