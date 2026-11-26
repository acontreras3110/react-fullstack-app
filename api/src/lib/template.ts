import sanitizeHtml from "sanitize-html";
import type { TemplateVariable } from "@/db/schema";
import { HttpError } from "./http";

/**
 * Allowlist del HTML que puede producir el editor. Todo lo demás (script, iframe,
 * on*, style arbitrario, enlaces...) se elimina. Importante porque luego Playwright
 * renderiza este HTML en un navegador real.
 */
const SANITIZE: sanitizeHtml.IOptions = {
  allowedTags: [
    "p", "br", "hr", "h1", "h2", "h3", "strong", "b", "em", "i", "u", "s",
    "ul", "ol", "li", "blockquote", "span",
    "table", "thead", "tbody", "tr", "th", "td",
  ],
  allowedAttributes: {
    span: ["data-variable"],
    th: ["colspan", "rowspan"],
    td: ["colspan", "rowspan"],
    "*": ["style"],
  },
  allowedStyles: { "*": { "text-align": [/^(left|right|center|justify)$/] } },
};

// sanitize-html normaliza los atributos a comillas dobles -> regex fiable sobre su salida.
const VARIABLE_ATTR = /<span[^>]*\bdata-variable="([^"]*)"/g;

export const sanitizeTemplateHtml = (html: string) => sanitizeHtml(html, SANITIZE);

/** Claves de comodín usadas en el HTML (sin repetir, en orden de aparición). */
export function extractVariableKeys(html: string): string[] {
  return [...new Set([...html.matchAll(VARIABLE_ATTR)].map((m) => m[1]!))];
}

/**
 * Sanea el HTML y cruza los comodines usados con las definiciones recibidas:
 * - usado pero sin definir -> 422 (el formulario no sabría qué pedir);
 * - definido pero no usado  -> se descarta (el formulario solo pide lo necesario);
 * - clave definida dos veces -> 422.
 */
export function prepareTemplate(rawHtml: string, definitions: TemplateVariable[]) {
  const seen = new Set<string>();
  for (const d of definitions) {
    if (seen.has(d.key)) throw new HttpError(422, `Variable duplicada: ${d.key}`);
    seen.add(d.key);
  }

  const html = sanitizeTemplateHtml(rawHtml);
  const used = extractVariableKeys(html);
  const missing = used.filter((k) => !seen.has(k));
  if (missing.length) throw new HttpError(422, `Variables sin definir: ${missing.join(", ")}`);

  const usedSet = new Set(used);
  return { html, variables: definitions.filter((d) => usedSet.has(d.key)) };
}
