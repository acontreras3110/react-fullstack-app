import Handlebars from "handlebars";
import { z } from "zod";
import type { Template } from "@/db/schema";
import { HttpError } from "./http";
import { sanitizeTemplateHtml } from "./template";

/**
 * Render SEGURO de una plantilla con datos del usuario. Capas:
 *  1. Datos validados (solo strings / listas de strings, con límites de tamaño).
 *  2. Handlebars escapa `{{x}}` (& < > " ' ` =): un valor "<script>" sale como TEXTO.
 *     Instancia aislada (create) y sin acceso al prototipo (por defecto desde 4.6).
 *  3. La salida se vuelve a sanear (por si la plantilla usa `{{{x}}}` sin escapar).
 *  4. Playwright: sin JavaScript y sin red (pdf.ts).
 */
const hb = Handlebars.create();

// Helper de las plantillas existentes: {{#ifEquals medio-pago 1}}...{{else}}...{{/ifEquals}}.
// Los datos del formulario son strings y el literal puede ser número: se compara como texto.
hb.registerHelper("ifEquals", function (this: unknown, a: unknown, b: unknown, options: Handlebars.HelperOptions) {
  return String(a ?? "") === String(b ?? "") ? options.fn(this) : options.inverse(this);
});

const Text = z.string().max(10_000);
export const RenderInput = z.object({
  data: z.record(z.string().max(100), z.union([Text, z.array(z.record(z.string().max(100), Text)).max(500)])),
});
export type RenderData = z.infer<typeof RenderInput>["data"];

const isEmpty = (v: RenderData[string] | undefined) =>
  v === undefined || (typeof v === "string" ? v.trim() === "" : v.length === 0);

export function renderTemplate(template: Pick<Template, "html" | "variables">, data: RenderData): string {
  const missing = template.variables.filter((v) => v.required && isEmpty(data[v.key]));
  if (missing.length) {
    throw new HttpError(422, `Faltan datos obligatorios: ${missing.map((v) => v.label).join(", ")}`);
  }

  // Solo las claves de la plantilla (lo demás que llegue se ignora).
  const known = new Set(template.variables.map((v) => v.key));
  const context = Object.fromEntries(Object.entries(data).filter(([k]) => known.has(k)));

  let output: string;
  try {
    output = hb.compile(template.html)(context);
  } catch (e) {
    // Helper desconocido ({{#formatoFecha}}), etc.
    throw new HttpError(422, `No se pudo renderizar: ${e instanceof Error ? e.message : String(e)}`);
  }
  return sanitizeTemplateHtml(output);
}
