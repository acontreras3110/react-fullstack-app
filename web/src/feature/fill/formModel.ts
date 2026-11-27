// Modelo del formulario dinámico: TODO se deriva de la plantilla GUARDADA. Funciones puras.
//
//   plantilla (html + variables)
//     ├─ analyzeTemplate(html) -> qué es cada comodín: valor o lista (+ sus campos)
//     ├─ variables de la API   -> etiqueta y obligatoria/opcional
//     ▼
//   FormField[]  ──buildSchema──▶  esquema Zod (validación)
//                ──buildDefaults─▶ valores iniciales de React Hook Form
//
// ❌ Escribir a mano un esquema por plantilla: hay cientos y cambian.
// ✅ El esquema se CONSTRUYE en runtime a partir de los datos (como harías en el back
//    con un validador generado desde metadata).
import { z } from 'zod'
import { analyzeTemplate } from '../html-template/analyze'
import { labelFromKey } from '../template/types'
import type { Template } from '../templates/api'

export type FormField =
  | { kind: 'value'; key: string; label: string; required: boolean }
  | { kind: 'list'; key: string; label: string; required: boolean; fields: string[] }

/** Una fila de una lista ({{#each coberturas}}): { codigo: '...', descripcion: '...' } */
export type ListRow = Record<string, string>
/** Lo que produce el formulario = el objeto de datos que recibirá Handlebars. */
export type FormValues = Record<string, string | ListRow[]>

export function buildFormFields(template: Template): FormField[] {
  const analysis = analyzeTemplate(template.html)
  if (!analysis.ok) return [] // la API ya rechaza Handlebars inválido; por si acaso
  const meta = new Map(template.variables.map((v) => [v.key, v]))

  return analysis.variables.map((v) => {
    const label = meta.get(v.key)?.label ?? labelFromKey(v.key)
    const required = meta.get(v.key)?.required ?? true
    return v.kind === 'list'
      ? { kind: 'list', key: v.key, label, required, fields: v.fields }
      : { kind: 'value', key: v.key, label, required }
  })
}

const requiredText = z.string().trim().min(1, 'Obligatorio')

export function buildSchema(fields: FormField[]) {
  const shape: Record<string, z.ZodType> = {}
  for (const f of fields) {
    if (f.kind === 'value') {
      shape[f.key] = f.required ? requiredText : z.string()
    } else {
      // Cada fila: todos sus campos obligatorios (si la fila existe, se rellena entera).
      const row = z.object(Object.fromEntries(f.fields.map((name) => [name, requiredText])))
      shape[f.key] = f.required ? z.array(row).min(1, 'Agrega al menos una fila') : z.array(row)
    }
  }
  return z.object(shape)
}

export const emptyRow = (fields: string[]): ListRow => Object.fromEntries(fields.map((name) => [name, '']))

export function buildDefaults(fields: FormField[]): FormValues {
  return Object.fromEntries(
    fields.map((f) => [f.key, f.kind === 'value' ? '' : f.required ? [emptyRow(f.fields)] : []]),
  )
}
