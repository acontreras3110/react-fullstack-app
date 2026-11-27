// Una variable de tipo LISTA ({{#each coberturas}}): filas que se agregan y quitan.
//
// 🔑 ¿Por qué un componente aparte y no un .map() dentro de DynamicForm?
//   useFieldArray es un HOOK y hay una lista por cada {{#each}}:
//   ❌ fields.map(f => useFieldArray(...))  -> hooks en un bucle (su número cambia entre
//      renders: React pierde la cuenta de qué estado es de quién).
//   ✅ Un componente por lista; CADA instancia llama a su useFieldArray una sola vez.
import { useFieldArray, type Control, type FieldErrors, type UseFormRegister } from 'react-hook-form'
import { emptyRow, type FormField, type FormValues } from './formModel'
import { labelFromKey } from '../template/types'

type ListFieldProps = {
  field: Extract<FormField, { kind: 'list' }>
  control: Control<FormValues>
  register: UseFormRegister<FormValues>
  errors: FieldErrors<FormValues>
}

type RowErrors = { message?: string; root?: { message?: string } } & Record<
  number,
  Record<string, { message?: string }> | undefined
>

export function ListField({ field, control, register, errors }: ListFieldProps) {
  // `fields` (de RHF) = filas actuales, cada una con un `id` estable para usar como key.
  // ❌ key={index}: al borrar la fila 0, React reutilizaría sus inputs para la fila 1.
  const rows = useFieldArray({ control, name: field.key as never })
  const listErrors = errors[field.key] as RowErrors | undefined

  return (
    <fieldset className="list-field">
      <legend>
        ☰ {field.label} {field.required && <span className="req">*</span>}
      </legend>

      {field.fields.length === 0 && <p className="muted">La lista no usa campos ({'{{this.x}}'}).</p>}

      {rows.fields.map((row, index) => (
        <div key={row.id} className="list-row">
          <span className="muted">{index + 1}.</span>
          {field.fields.map((name) => {
            const error = listErrors?.[index]?.[name]?.message
            return (
              <label key={name} className="form-field">
                <span>{labelFromKey(name)}</span>
                {/* Nombre con puntos = ruta: "coberturas.0.codigo" -> data.coberturas[0].codigo */}
                <input {...register(`${field.key}.${index}.${name}`)} aria-invalid={!!error} />
                {error && <small className="error">{error}</small>}
              </label>
            )
          })}
          <button type="button" onClick={() => rows.remove(index)} title="Quitar fila">
            ✕
          </button>
        </div>
      ))}

      <button type="button" onClick={() => rows.append(emptyRow(field.fields) as never)}>
        + Agregar fila
      </button>
      {/* Error de la lista entera (z.array().min(1)): llega en .message o .root.message */}
      {(listErrors?.message ?? listErrors?.root?.message) && (
        <small className="error">{listErrors?.message ?? listErrors?.root?.message}</small>
      )}
    </fieldset>
  )
}
