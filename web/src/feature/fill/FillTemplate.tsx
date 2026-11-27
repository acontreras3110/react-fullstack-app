// Pestaña "Rellenar": formulario de la plantilla GUARDADA -> PDF generado por la API.
//
// Flujo async:  enviar (válido) ──▶ pdf.mutate({ id, data })
//                                    ├ isPending  -> "Generando PDF…" (botón deshabilitado)
//                                    ├ isError    -> mensaje (422 de la API, 504 timeout...)
//                                    └ data       -> <PdfViewer>
// Todo ese estado (cargando/error/resultado) lo lleva useMutation: aquí no hay ni un
// useState de "loading" ni de "error".
import { useMemo } from 'react'
import type { Template } from '../templates/api'
import { useGeneratePdf } from '../templates/queries'
import { DynamicForm } from './DynamicForm'
import { buildFormFields, type FormValues } from './formModel'
import { PdfViewer } from './PdfViewer'

export function FillTemplate({ template }: { template: Template }) {
  // Derivado y caro (analiza 100 KB de HTML): solo se recalcula si cambia la plantilla.
  const fields = useMemo(() => buildFormFields(template), [template])
  const pdf = useGeneratePdf()

  // Llamado por handleSubmit SOLO con datos válidos.
  // (Si se envía otra vez antes de que llegue la respuesta, useMutation se queda con el
  //  resultado de la ÚLTIMA llamada: una respuesta vieja que llega tarde no pisa la nueva.)
  const handleValid = (values: FormValues) => pdf.mutate({ id: template.id, data: values })

  return (
    <div className="fill-layout">
      <section>
        <p className="muted">
          Formulario generado desde la versión <strong>guardada</strong> de «{template.name}» ({fields.length}{' '}
          comodines). Los cambios sin guardar del editor no aparecen aquí.
        </p>
        {/* key: al guardar una nueva versión (updatedAt cambia) el formulario se regenera. */}
        <DynamicForm
          key={template.updatedAt}
          fields={fields}
          onSubmit={handleValid}
          submitLabel={pdf.isPending ? 'Generando PDF…' : 'Generar PDF'}
          submitting={pdf.isPending}
        />
      </section>

      <aside className="fill-result">
        {pdf.isPending && <p className="muted">⏳ Generando PDF en el servidor…</p>}
        {pdf.isError && <p className="error">⚠️ {pdf.error.message}</p>}
        {pdf.data && !pdf.isPending && <PdfViewer base64={pdf.data.pdfBase64} filename={pdf.data.filename} />}
        {pdf.isIdle && <p className="muted">Rellena el formulario y pulsa «Generar PDF».</p>}
      </aside>
    </div>
  )
}
