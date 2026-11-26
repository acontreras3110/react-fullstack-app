// Barra de plantilla: abrir una guardada, nombre, guardar, borrar, "● sin guardar".
//
// Casi todo llega por PROPS (lo decide el workspace, que tiene el borrador). Lo único que
// pide por su cuenta es la LISTA de plantillas: solo esta barra la usa -> la query vive
// aquí (colocation). Si otro componente la necesitara, useTemplates() devuelve la MISMA
// caché: no se duplica la petición.
import { useTemplates } from './queries'

type TemplateBarProps = {
  templateId: number | null // null = nueva (aún no existe en la API)
  name: string
  onNameChange: (name: string) => void
  isDirty: boolean
  canSave: boolean
  isSaving: boolean
  saveError: string | null
  onSave: () => void
  onOpen: (id: number | null) => void
  onDelete: () => void
  isDeleting: boolean
}

export function TemplateBar({
  templateId,
  name,
  onNameChange,
  isDirty,
  canSave,
  isSaving,
  saveError,
  onSave,
  onOpen,
  onDelete,
  isDeleting,
}: TemplateBarProps) {
  const templates = useTemplates()

  return (
    <div className="template-bar">
      {/* <select> CONTROLADO: value = la plantilla abierta. Al elegir otra NO cambiamos
          `value` aquí: avisamos (onOpen) y el padre decide (puede cancelar si hay cambios). */}
      <select
        aria-label="Abrir plantilla"
        value={templateId ?? ''}
        onChange={(e) => onOpen(e.target.value === '' ? null : Number(e.target.value))}
        disabled={templates.isPending}
      >
        <option value="">{templateId === null ? '— Nueva plantilla —' : '+ Nueva plantilla'}</option>
        {templates.data?.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
      {templates.isError && <span className="error">⚠️ {templates.error.message}</span>}

      <input
        className="template-name"
        aria-label="Nombre de la plantilla"
        placeholder="Nombre de la plantilla"
        value={name}
        maxLength={150}
        onChange={(e) => onNameChange(e.target.value)}
      />

      {/* Estado DERIVADO (nadie hace setIsDirty): se calcula comparando con lo guardado. */}
      <span className={`save-status ${isDirty ? 'dirty' : ''}`}>
        {isSaving ? 'Guardando…' : isDirty ? '● Sin guardar' : templateId === null ? '' : '✓ Guardado'}
      </span>

      <button type="button" className="primary" onClick={onSave} disabled={!canSave || isSaving}>
        {templateId === null ? 'Crear' : 'Guardar'}
      </button>
      {templateId !== null && (
        <button type="button" onClick={onDelete} disabled={isDeleting || isSaving}>
          Borrar
        </button>
      )}
      {saveError && <span className="error">⚠️ {saveError}</span>}
    </div>
  )
}
