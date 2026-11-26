// Renderiza la plantilla con Handlebars para la VISTA PREVIA.
//
// En vez de datos reales usamos "marcadores": cada {{variable}} se sustituye por una
// etiqueta resaltada con su nombre. Así ves DÓNDE cae cada comodín con el diseño real.
// (En el paso 6 el servidor hará lo mismo con datos reales + Playwright -> PDF.)
import Handlebars from 'handlebars'
import type { DetectedVariable } from './analyze'

// Instancia AISLADA de Handlebars (create()): los helpers de la vista previa no se
// mezclan con los de otras partes de la app.
const hb = Handlebars.create()

// Helper usado por las plantillas existentes: {{#ifEquals a b}}...{{/ifEquals}}.
// En la vista previa NO evaluamos la condición (no hay datos): mostramos el bloque
// recuadrado con su condición, para que se vea qué parte es condicional.
hb.registerHelper('ifEquals', function (this: unknown, a: unknown, b: unknown, options: Handlebars.HelperOptions) {
  const label = `si ${String(a)} = ${hb.escapeExpression(String(b))}`
  return new hb.SafeString(
    `<div class="__hb-cond"><span class="__hb-cond-label">${label}</span>${options.fn(this)}</div>`,
  )
})

function marker(text: string) {
  // SafeString = "este HTML es seguro, no lo escapes". El texto sí lo escapamos.
  return new hb.SafeString(`<mark class="__hb-var">${hb.escapeExpression(text)}</mark>`)
}

/** Datos de ejemplo: cada variable -> marcador; cada lista -> 1 elemento de ejemplo. */
function buildMarkerData(variables: DetectedVariable[]) {
  const data: Record<string, unknown> = {}
  for (const v of variables) {
    data[v.key] =
      v.kind === 'value'
        ? marker(v.key)
        : [Object.fromEntries(v.fields.map((f) => [f, marker(`${v.key}.${f}`)]))]
  }
  return data
}

// Estilos SOLO de la vista previa (se inyectan en el iframe, no tocan tu plantilla).
const PREVIEW_CSS = `
<style data-preview>
  .__hb-var { background: #ffe58a; color: #5a4300; border-radius: 3px; padding: 0 2px;
              font-family: inherit; font-size: inherit; outline: 1px dashed #c9a400; }
  .__hb-cond { outline: 1px dashed #6b8afd; position: relative; margin-top: 14px; }
  .__hb-cond-label { position: absolute; top: -13px; left: 0; font: 10px/1 sans-serif;
                     background: #6b8afd; color: #fff; padding: 1px 4px; border-radius: 2px; }
  .__hb-cond-label .__hb-var { background: transparent; color: #fff; outline: none; }
  /* Convención de las plantillas: elementos que no forman parte del documento impreso. */
  [no-print-layout] { display: none !important; }
</style>`

export type PreviewResult = { ok: true; html: string } | { ok: false; error: string }

export function renderPreview(template: string, variables: DetectedVariable[]): PreviewResult {
  try {
    const render = hb.compile(template)
    const output = render(buildMarkerData(variables))
    // Inyectar los estilos de la vista previa al final del <head> (o al principio si no hay).
    const html = output.includes('</head>')
      ? output.replace('</head>', `${PREVIEW_CSS}</head>`)
      : PREVIEW_CSS + output
    return { ok: true, html }
  } catch (e) {
    // Helper desconocido, bloque sin cerrar...
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}
