// Muestra un PDF que llega en Base64 y permite descargarlo.
//
// Base64 -> Blob -> URL "blob:http://localhost:5173/uuid" (createObjectURL).
// ❌ <iframe src="data:application/pdf;base64,...">: Chrome bloquea PDFs en data: URLs y
//    un string de 100 KB+ en el DOM es pesado.
// ✅ Blob URL: apunta a los bytes en memoria del navegador... que NO se liberan solos.
//
// 🔑 useEffect = sincronizar con algo EXTERNO a React (aquí: memoria de blobs del navegador).
//    Crear el recurso en el efecto y liberarlo en el CLEANUP:
//    - llega otro PDF   -> cleanup del anterior (revoke) -> efecto con el nuevo;
//    - se desmonta      -> cleanup (revoke).
//    En desarrollo, StrictMode monta-desmonta-monta: el cleanup evita que se filtre la 1ª URL.
import { useEffect, useState } from 'react'

function base64ToBlob(base64: string, type: string): Blob {
  const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0))
  return new Blob([bytes], { type })
}

type PdfViewerProps = { base64: string; filename: string }

export function PdfViewer({ base64, filename }: PdfViewerProps) {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    const objectUrl = URL.createObjectURL(base64ToBlob(base64, 'application/pdf'))
    // La regla set-state-in-effect avisa (suele indicar estado derivable en el render).
    // Aquí NO lo es: la URL es un recurso externo que debe nacer y morir con el efecto.
    // ❌ useMemo(() => createObjectURL(...)) + revoke en cleanup: StrictMode ejecuta
    //    cleanup + efecto otra vez -> revoca la URL que el iframe está mostrando.
    // oxlint-disable-next-line react/set-state-in-effect
    setUrl(objectUrl)
    return () => URL.revokeObjectURL(objectUrl)
  }, [base64])

  if (!url) return null

  return (
    <div className="pdf-viewer">
      <a href={url} download={filename} className="download">
        ⬇ Descargar {filename}
      </a>
      <iframe src={url} title={`PDF ${filename}`} />
    </div>
  )
}
