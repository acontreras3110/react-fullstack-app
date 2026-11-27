// Pestaña "Rellenar": formulario de la plantilla GUARDADA + los datos resultantes.
// En el paso 6 esos datos se enviarán a la API para generar el PDF.
import { useMemo, useState } from 'react'
import type { Template } from '../templates/api'
import { DynamicForm } from './DynamicForm'
import { buildFormFields, type FormValues } from './formModel'

export function FillTemplate({ template }: { template: Template }) {
  // Derivado y caro (analiza 100 KB de HTML): solo se recalcula si cambia la plantilla.
  const fields = useMemo(() => buildFormFields(template), [template])
  const [submitted, setSubmitted] = useState<FormValues | null>(null)

  return (
    <div className="fill-layout">
      <section>
        <p className="muted">
          Formulario generado desde la versión <strong>guardada</strong> de «{template.name}» ({fields.length}{' '}
          comodines). Los cambios sin guardar del editor no aparecen aquí.
        </p>
        {/* key: al guardar una nueva versión (updatedAt cambia) el formulario se regenera. */}
        <DynamicForm key={template.updatedAt} fields={fields} onSubmit={setSubmitted} />
      </section>
      <aside className="fill-result">
        <h3>Datos para el documento</h3>
        {submitted ? <pre>{JSON.stringify(submitted, null, 2)}</pre> : <p className="muted">Valida el formulario.</p>}
      </aside>
    </div>
  )
}
