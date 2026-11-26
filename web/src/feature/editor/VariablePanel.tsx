// Panel lateral: definir variables (comodines) e insertarlas en el editor.
//
// Reparto del estado (¿dónde vive cada cosa?):
//   - Lista de variables (`variables`)   -> en App: la necesitan el panel Y la vista de
//                                           "datos a guardar". Llega por props.
//   - Qué variables se usan (`usedKeys`) -> DERIVADO del documento del editor (App).
//   - Lo que escribes en el formulario   -> LOCAL aquí (a nadie más le importa).
// El panel no modifica nada de App directamente: AVISA con callbacks (onAdd/onRemove/...).
//
// Los comodines NO tienen tipo: el valor que llegue se inserta tal cual. Solo se
// marca si es OBLIGATORIO (el formulario lo exigirá) u OPCIONAL (puede quedar vacío).
import { useState, type FormEvent } from 'react'
import { keyFromLabel, labelFromKey, VARIABLE_KEY_REGEX, type TemplateVariable } from '../template/types'

type VariablePanelProps = {
  variables: TemplateVariable[]
  usedKeys: string[]
  onAdd: (variables: TemplateVariable[]) => void // array: "definir todas" añade varias de golpe
  onRemove: (key: string) => void
  onInsert: (key: string) => void
  onToggleRequired: (key: string) => void
}

export function VariablePanel({
  variables,
  usedKeys,
  onAdd,
  onRemove,
  onInsert,
  onToggleRequired,
}: VariablePanelProps) {
  const [label, setLabel] = useState('')
  const [required, setRequired] = useState(true)
  // Texto del buscador: estado LOCAL (solo afecta a lo que muestra este panel).
  const [query, setQuery] = useState('')

  // ✅ ESTADO DERIVADO: la lista filtrada NO se guarda, se calcula en cada render.
  // ❌ useState(filtradas) + actualizarla al cambiar query O variables = bugs seguros.
  const q = query.trim().toLowerCase()
  const visibleVariables =
    q === '' ? variables : variables.filter((v) => v.label.toLowerCase().includes(q) || v.key.includes(q))
  const usedCount = variables.filter((v) => usedKeys.includes(v.key)).length

  // DERIVADO: comodines que están en el documento pero no definidos (aparecen al
  // escribir {{algo}} o pegar HTML con comodines). La API rechazaría guardar así (422).
  const undefinedKeys = usedKeys.filter((k) => !variables.some((v) => v.key === k))

  // ✅ ESTADO DERIVADO: la clave sale de la etiqueta en cada render.
  const key = keyFromLabel(label)

  // La validación también es derivada: no hay un useState(error).
  let error: string | null = null
  if (label.trim() !== '' && !VARIABLE_KEY_REGEX.test(key)) {
    error = 'La etiqueta debe contener al menos una letra'
  } else if (variables.some((v) => v.key === key)) {
    error = `Ya existe la variable {{${key}}}`
  }
  const canAdd = label.trim() !== '' && error === null

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!canAdd) return
    onAdd([{ key, label: label.trim(), required }])
    setLabel('') // limpiar el formulario tras añadir
    setRequired(true)
  }

  function handleDefineMissing() {
    onAdd(undefinedKeys.map((k) => ({ key: k, label: labelFromKey(k), required: true })))
  }

  return (
    <aside className="variable-panel">
      <h2>
        Variables{' '}
        <span className="muted">
          ({usedCount}/{variables.length} en uso)
        </span>
      </h2>

      {undefinedKeys.length > 0 && (
        <div className="warning">
          <p>
            ⚠️ Comodines sin definir:{' '}
            {undefinedKeys.map((k) => (
              <code key={k}>{`{{${k}}} `}</code>
            ))}
          </p>
          <button type="button" onClick={handleDefineMissing}>
            Definirlos ({undefinedKeys.length})
          </button>
        </div>
      )}

      <input
        type="search"
        className="variable-search"
        placeholder="Buscar por etiqueta o clave…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      {variables.length === 0 && <p className="muted">Aún no hay variables.</p>}
      {variables.length > 0 && visibleVariables.length === 0 && (
        <p className="muted">Ninguna coincide con “{query}”.</p>
      )}

      {/* Caja con ALTURA MÁXIMA + overflow:auto (ver .variable-list en index.css):
          con 5 o con 500 variables el panel ocupa lo mismo; lo que sobra se scrollea. */}
      <ul className="variable-list">
        {visibleVariables.map((v) => {
          const used = usedKeys.includes(v.key)
          return (
            <li key={v.key} className={used ? 'used' : undefined}>
              {/* Clic en la fila = insertar (botón grande y fácil de acertar). */}
              <button
                type="button"
                className="variable-insert"
                onClick={() => onInsert(v.key)}
                title={`Insertar {{${v.key}}}${used ? ' · en uso' : ''}`}
              >
                <span className="variable-label">
                  {used && '✅ '}
                  {v.label}
                </span>
                <code className="variable-key">{`{{${v.key}}}`}</code>
              </button>
              {/* Interruptor obligatoria/opcional: aria-pressed = estado on/off. */}
              <button
                type="button"
                className="variable-required"
                aria-pressed={v.required}
                onClick={() => onToggleRequired(v.key)}
                title={v.required ? 'Obligatoria (clic: opcional)' : 'Opcional (clic: obligatoria)'}
              >
                {v.required ? '*' : '○'}
              </button>
              {/* No dejamos borrar una variable en uso: el documento quedaría con un
                  comodín sin definir (la API respondería 422). */}
              <button
                type="button"
                className="variable-remove"
                onClick={() => onRemove(v.key)}
                disabled={used}
                title={used ? 'Quítala primero del documento' : 'Eliminar variable'}
                aria-label={`Eliminar ${v.label}`}
              >
                ✕
              </button>
            </li>
          )
        })}
      </ul>
      <p className="muted legend">* obligatoria · ○ opcional</p>

      <form className="variable-form" onSubmit={handleSubmit}>
        <h3>Nueva variable</h3>
        <label>
          Etiqueta
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Nombre del cliente"
          />
        </label>
        {/* Checkbox CONTROLADO: `checked` sale del estado, onChange lo actualiza. */}
        <label className="checkbox">
          <input type="checkbox" checked={required} onChange={(e) => setRequired(e.target.checked)} />
          Obligatoria
        </label>
        <p className="muted">
          Clave: <code>{key ? `{{${key}}}` : '—'}</code>
        </p>
        {error && <p className="error">{error}</p>}
        <button type="submit" disabled={!canAdd}>
          Añadir variable
        </button>
      </form>
    </aside>
  )
}
