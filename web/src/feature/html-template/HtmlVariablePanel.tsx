// Panel de variables del MODO HTML.
//
// Diferencia con el modo visual: aquí las variables NO se "definen" a mano. Salen del
// propio HTML (DERIVADAS del análisis con Handlebars). Lo único que se guarda como
// estado es la configuración de cada una (obligatoria u opcional) -> `requiredByKey`.
import { useState } from 'react'
import type { DetectedVariable } from './analyze'

type HtmlVariablePanelProps = {
  variables: DetectedVariable[]
  isRequired: (key: string) => boolean
  onToggleRequired: (key: string) => void
  onInsert: (snippet: string) => void
  insertDisabled?: boolean // en "Vista previa" no hay cursor donde insertar
}

export function HtmlVariablePanel({
  variables,
  isRequired,
  onToggleRequired,
  onInsert,
  insertDisabled = false,
}: HtmlVariablePanelProps) {
  const [query, setQuery] = useState('')
  const [newKey, setNewKey] = useState('')

  const q = query.trim().toLowerCase()
  const visible = q === '' ? variables : variables.filter((v) => v.key.toLowerCase().includes(q))
  const lists = variables.filter((v) => v.kind === 'list').length

  // Clave válida para Handlebars: letras, números, "_" y "-" (sin espacios ni llaves).
  const cleanKey = newKey.trim()
  const validKey = /^[A-Za-z][\w-]{0,49}$/.test(cleanKey)

  return (
    <aside className="variable-panel">
      <h2>
        Variables <span className="muted">({variables.length}{lists > 0 && `, ${lists} lista(s)`})</span>
      </h2>

      <input
        type="search"
        className="variable-search"
        placeholder="Buscar…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      {variables.length === 0 && <p className="muted">El HTML no tiene comodines.</p>}

      <ul className="variable-list">
        {visible.map((v) => (
          <li key={v.key}>
            <button
              type="button"
              className="variable-insert"
              disabled={insertDisabled}
              onClick={() => onInsert(v.kind === 'value' ? `{{${v.key}}}` : eachSnippet(v.key, v.fields))}
              title="Insertar en el cursor del editor"
            >
              <span className="variable-label">
                {v.kind === 'list' ? '☰ ' : ''}
                {v.key}
              </span>
              {v.kind === 'list' && (
                <code className="variable-key">
                  {v.fields.length > 0 ? v.fields.join(', ') : 'sin campos'}
                </code>
              )}
            </button>
            <button
              type="button"
              className="variable-required"
              aria-pressed={isRequired(v.key)}
              onClick={() => onToggleRequired(v.key)}
              title={isRequired(v.key) ? 'Obligatoria (clic: opcional)' : 'Opcional (clic: obligatoria)'}
            >
              {isRequired(v.key) ? '*' : '○'}
            </button>
          </li>
        ))}
      </ul>
      <p className="muted legend">* obligatoria · ○ opcional · ☰ lista ({'{{#each}}'})</p>

      {/* Crear un comodín nuevo = escribirlo en el HTML. Aparece en la lista solo
          (porque la lista se DERIVA del HTML). */}
      <form
        className="variable-form"
        onSubmit={(e) => {
          e.preventDefault()
          if (!validKey) return
          onInsert(`{{${cleanKey}}}`)
          setNewKey('')
        }}
      >
        <h3>Nuevo comodín</h3>
        <input value={newKey} onChange={(e) => setNewKey(e.target.value)} placeholder="numero-poliza" />
        {cleanKey !== '' && !validKey && <p className="error">Letras, números, "_" o "-"; empieza por letra</p>}
        <button type="submit" disabled={!validKey || insertDisabled}>
          Insertar en el cursor
        </button>
      </form>
    </aside>
  )
}

function eachSnippet(key: string, fields: string[]) {
  const body = fields.length > 0 ? fields.map((f) => `{{this.${f}}}`).join(' ') : '{{this.campo}}'
  return `{{#each ${key}}}${body}{{/each}}`
}
