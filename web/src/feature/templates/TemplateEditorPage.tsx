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
//
// Paso 5 · Pestañas Editor / Rellenar.
//   ❌ {tab === 'edit' ? <Editor/> : <Formulario/>}  -> cambiar de pestaña DESMONTA el otro:
//      se pierden los cambios sin guardar del editor (y lo escrito en el formulario).
//   ✅ Ambos montados; el inactivo se oculta con el atributo `hidden`. El estado sigue vivo.
import { useState } from 'react'
import { FillTemplate } from '../fill/FillTemplate'
import { HtmlTemplateWorkspace, type TemplateDraft } from '../html-template/HtmlTemplateWorkspace'
import { BLANK_TEMPLATE } from '../html-template/blankTemplate'
import { useTemplate } from './queries'

const NEW_DRAFT: TemplateDraft = { name: '', html: BLANK_TEMPLATE, variables: [] }

export function TemplateEditorPage() {
  const [session, setSession] = useState<{ id: number | null; n: number }>({ id: null, n: 0 })
  const [tab, setTab] = useState<'edit' | 'fill'>('edit')
  const template = useTemplate(session.id)

  // "Abre esta plantilla" (o null = nueva). Siempre vuelve al editor.
  const open = (id: number | null) => {
    setSession((s) => ({ id, n: s.n + 1 }))
    setTab('edit')
  }

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

  const saved = session.id !== null ? template.data : undefined

  return (
    <>
      <nav className="page-tabs" aria-label="Modo">
        <button type="button" aria-pressed={tab === 'edit'} onClick={() => setTab('edit')}>
          ✎ Editar plantilla
        </button>
        <button
          type="button"
          aria-pressed={tab === 'fill'}
          onClick={() => setTab('fill')}
          disabled={!saved}
          title={saved ? undefined : 'Guarda la plantilla para poder rellenarla'}
        >
          📝 Rellenar formulario
        </button>
      </nav>

      <div hidden={tab !== 'edit'}>
        <HtmlTemplateWorkspace
          key={`${session.id ?? 'new'}-${session.n}`}
          templateId={session.id}
          initial={initial}
          onOpen={open}
        />
      </div>
      {saved && (
        <div hidden={tab !== 'fill'}>
          <FillTemplate key={saved.id} template={saved} />
        </div>
      )}
    </>
  )
}
