// Llamadas HTTP de plantillas. Funciones PURAS async: no saben nada de React ni de caché.
// (La caché/estado async la pone TanStack Query en queries.ts.)
//
// Tipos GENERADOS desde la API (npm run gen:api -> src/api/schema.d.ts):
// ❌ copiar a mano el tipo de la respuesta (se desincroniza cuando cambia la API)
// ✅ components['schemas'][...]: si la API cambia, regenerar y TS marca lo que se rompió.
import { apiFetch } from '../../api/client'
import type { components } from '../../api/schema'

export type Template = components['schemas']['TemplateOut']
export type TemplateSummary = components['schemas']['TemplateSummary']
export type TemplateInput = components['schemas']['TemplateInput']
type TemplateList = components['schemas']['TemplateList']

/** Listado SIN html (puede pesar cientos de KB): solo para elegir. */
export const listTemplates = () => apiFetch<TemplateList>('/api/templates').then((r) => r.items)

export const getTemplate = (id: number) => apiFetch<Template>(`/api/templates/${id}`)

export const createTemplate = (input: TemplateInput) =>
  apiFetch<Template>('/api/templates', { method: 'POST', body: JSON.stringify(input) })

/** PUT = reemplazo completo (html + variables viajan juntos y deben ser coherentes). */
export const updateTemplate = (id: number, input: TemplateInput) =>
  apiFetch<Template>(`/api/templates/${id}`, { method: 'PUT', body: JSON.stringify(input) })

export const deleteTemplate = (id: number) => apiFetch<void>(`/api/templates/${id}`, { method: 'DELETE' })

// ---------- Paso 6: PDF ----------
export type RenderInput = components['schemas']['RenderInput']
export type PdfOut = components['schemas']['PdfOut']

/** El servidor rellena la plantilla GUARDADA con `data` y devuelve el PDF en Base64. */
export const generatePdf = (id: number, data: RenderInput['data']) =>
  apiFetch<PdfOut>(`/api/templates/${id}/pdf`, { method: 'POST', body: JSON.stringify({ data }) })
