// Diálogo para traer un HTML ya existente: pegarlo o elegir un archivo .html.
//
// Conceptos:
// - <dialog> nativo + useRef: para abrirlo hay que llamar a un MÉTODO del elemento DOM
//   (showModal()), no basta con un prop. useRef da acceso a ese elemento.
// - textarea CONTROLADO: el texto vive en useState.
// - Leer un archivo es ASYNC (file.text() devuelve una Promise).
// - El diálogo NO toca el editor: entrega el HTML al padre con `onImport(html, mode)`.
import { useRef, useState, type ChangeEvent } from 'react'

export type ImportMode = 'replace' | 'insert'

type ImportHtmlDialogProps = {
  onImport: (html: string, mode: ImportMode) => void
}

export function ImportHtmlDialog({ onImport }: ImportHtmlDialogProps) {
  // Referencia al <dialog> del DOM. Cambiar una ref NO provoca re-render.
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [text, setText] = useState('')
  const [fileError, setFileError] = useState<string | null>(null)

  function open() {
    dialogRef.current?.showModal() // modal: bloquea el fondo, Esc lo cierra
  }

  function close() {
    dialogRef.current?.close()
  }

  async function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // permite volver a elegir el mismo archivo
    if (!file) return
    if (file.size > 2_000_000) {
      setFileError('El archivo supera 2 MB')
      return
    }
    setFileError(null)
    setText(await file.text()) // await: esperamos a leer el archivo
  }

  function handleImport(mode: ImportMode) {
    onImport(text, mode)
    setText('')
    close()
  }

  const isEmpty = text.trim() === ''

  return (
    <>
      <button type="button" onClick={open}>
        Importar HTML
      </button>

      <dialog ref={dialogRef} className="import-dialog">
        <h2>Importar HTML</h2>
        <p className="muted">
          Pega el HTML o elige un archivo. Los textos <code>{'{{clave}}'}</code> se convierten en
          comodines. Lo que el editor no soporta (scripts, imágenes, enlaces, estilos) se descarta.
        </p>

        <input type="file" accept=".html,.htm,text/html" onChange={handleFile} />
        {fileError && <p className="error">{fileError}</p>}

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="<h1>Contrato</h1><p>Cliente: {{cliente_nombre}}</p>"
          rows={12}
        />

        <div className="dialog-actions">
          <button type="button" onClick={close}>
            Cancelar
          </button>
          <button type="button" disabled={isEmpty} onClick={() => handleImport('insert')}>
            Insertar en el cursor
          </button>
          <button type="button" disabled={isEmpty} onClick={() => handleImport('replace')}>
            Reemplazar documento
          </button>
        </div>
      </dialog>
    </>
  )
}
