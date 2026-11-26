// Página del editor: decide QUÉ plantilla se edita y la carga desde la API.
//
// 🔑 `key` = identidad de la "sesión de edición".
//   El workspace guarda su propio estado (html, nombre, vista, deshacer...) e inicializa
//   con `initial` SOLO en el primer render (useState(initial) ignora cambios posteriores).
//   ❌ useEffect(() => setHtml(initial.html), [initial])  -> render extra con datos viejos,
//      y hay que acordarse de resetear CADA estado (nombre, required, vista...).
//   ✅ key distinta -> React DESMONTA el workspace viejo y monta uno nuevo: todo el estado
//      local vuelve a empezar desde `initial`. Un cambio de key = "es otro componente".
//
// `session.n` cambia en cada apertura: así "Nueva" sobre una nueva también reinicia.
import { useState } from 'react'
import { HtmlTemplateWorkspace, type TemplateDraft } from '../html-template/HtmlTemplateWorkspace'
import { BLANK_TEMPLATE } from '../html-template/blankTemplate'
import { useTemplate } from './queries'

const NEW_DRAFT: TemplateDraft = { name: '', html: BLANK_TEMPLATE, variables: [] }

export function TemplateEditorPage() {
  const [session, setSession] = useState<{ id: number | null; n: number }>({ id: null, n: 0 })
  const template = useTemplate(session.id)

  // Callback estable para los hijos: "abre esta plantilla" (o null = nueva).
  const open = (id: number | null) => setSession((s) => ({ id, n: s.n + 1 }))

  // Estados de la query del detalle. (Con id null la query está deshabilitada: se salta.)
  if (session.id !== null && template.isPending) {
    return <p className="muted">Cargando plantilla…</p>
  }
  if (session.id !== null && template.isError) {
    return (
      <p className="error">
        ⚠️ No se pudo cargar la plantilla: {template.error.message}{' '}
        <button type="button" onClick={() => open(null)}>
          Empezar una nueva
        </button>
      </p>
    )
  }

  const initial = session.id !== null && template.data ? template.data : NEW_DRAFT

  return (
    <HtmlTemplateWorkspace
      key={`${session.id ?? 'new'}-${session.n}`}
      templateId={session.id}
      initial={initial}
      onOpen={open}
    />
  )
}
