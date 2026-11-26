import Handlebars from "handlebars";
import { Parser } from "htmlparser2";
import type { TemplateVariable } from "@/db/schema";
import { HttpError } from "./http";

/**
 * Saneado QUIRÚRGICO de un documento HTML completo (doctype, <style>, clases, Handlebars).
 *
 * Una allowlist (sanitize-html) reescribe todo el documento: pierde <style>, <head>, el
 * doctype y escapa Handlebars ({{> x}} -> {{&gt; x}}). Aquí se recorre el HTML con
 * htmlparser2, se anotan solo los RANGOS peligrosos y se cortan; el resto queda byte a byte.
 *
 * Se quita:
 *  - elementos que ejecutan código o cargan otros documentos/recursos (script, iframe, link...);
 *  - <meta http-equiv> (refresh/redirecciones);
 *  - atributos on* (onclick, onerror...), srcdoc y URLs javascript:/vbscript:/data:text/html.
 * Se conserva: <style>, style/class, imágenes y fuentes data:, comentarios, Handlebars.
 * Segunda capa (paso 6): Playwright renderiza sin JS y sin red.
 */
const DROP_ELEMENTS = new Set(["script", "iframe", "frame", "frameset", "object", "embed", "applet", "base", "link", "noscript"]);
const VOID_ELEMENTS = new Set(["base", "link", "embed", "meta"]);
const BAD_URL = /^(javascript|vbscript|data:text\/html)/i;

function isBadAttribute(name: string, value: string): boolean {
  if (name.startsWith("on") || name === "srcdoc") return true;
  // Quitar espacios/controles: "java\tscript:" también lo ejecuta el navegador.
  return BAD_URL.test(value.replace(/[\s\u0000-\u001f]+/g, ""));
}

const escapeAttr = (v: string) => v.replace(/&/g, "&amp;").replace(/"/g, "&quot;");

type Cut = { start: number; end: number; replacement: string };

export function sanitizeTemplateHtml(html: string): string {
  const cuts: Cut[] = [];
  // Elemento que se está cortando entero (p. ej. <script>...</script>). Se anota el tipo
  // explícito: TS no "ve" que los callbacks lo modifican y lo estrecharía a `null`.
  let dropping = null as { name: string; start: number; depth: number } | null;

  const parser = new Parser(
    {
      onopentag(name, attribs) {
        const start = parser.startIndex;
        const end = parser.endIndex;
        if (dropping) {
          if (name === dropping.name) dropping.depth++;
          return;
        }
        const isMetaRedirect = name === "meta" && "http-equiv" in attribs;
        if (DROP_ELEMENTS.has(name) || isMetaRedirect) {
          if (VOID_ELEMENTS.has(name)) cuts.push({ start, end, replacement: "" });
          else dropping = { name, start, depth: 1 };
          return;
        }
        const entries = Object.entries(attribs);
        if (entries.some(([n, v]) => isBadAttribute(n, v))) {
          // Solo ESTA etiqueta se reescribe (sin los atributos peligrosos).
          const kept = entries
            .filter(([n, v]) => !isBadAttribute(n, v))
            .map(([n, v]) => (v === "" ? ` ${n}` : ` ${n}="${escapeAttr(v)}"`))
            .join("");
          const selfClosing = html.slice(start, end + 1).endsWith("/>");
          cuts.push({ start, end, replacement: `<${name}${kept}${selfClosing ? " /" : ""}>` });
        }
      },
      onclosetag(name, isImplied) {
        if (!dropping || name !== dropping.name) return;
        if (--dropping.depth > 0) return;
        // Cierre implícito (falta </script>): cortar hasta el final del documento.
        const end = isImplied ? html.length - 1 : parser.endIndex;
        cuts.push({ start: dropping.start, end, replacement: "" });
        dropping = null;
      },
    },
    { decodeEntities: true },
  );
  parser.write(html);
  parser.end();
  if (dropping) cuts.push({ start: dropping.start, end: html.length - 1, replacement: "" });

  // Aplicar de atrás hacia delante: así los índices anteriores siguen siendo válidos.
  let out = html;
  for (const c of cuts.sort((a, b) => b.start - a.start)) {
    out = out.slice(0, c.start) + c.replacement + out.slice(c.end + 1);
  }
  return out;
}

/**
 * Analiza la plantilla con el AST de Handlebars (igual que web/src/feature/html-template/analyze.ts).
 * Devuelve, en orden de aparición, cada variable de primer nivel:
 *   null      -> valor          {{cliente}}, {{#if monto}}, {{#ifEquals medio-pago 1}}
 *   string[]  -> lista + campos {{#each coberturas}} {{this.codigo}} {{descripcion}} {{/each}}
 * (@index, @first... y {{this}} solo no son campos.) 422 si no es Handlebars válido.
 */
export function analyzeVariables(html: string): Map<string, string[] | null> {
  let program: hbs.AST.Program;
  try {
    program = Handlebars.parse(html);
  } catch (e) {
    throw new HttpError(422, `Plantilla Handlebars inválida: ${e instanceof Error ? e.message : String(e)}`);
  }
  const found = new Map<string, string[] | null>();

  // `list` = clave de la lista si estamos dentro de su {{#each}}.
  const visitExpr = (expr: hbs.AST.Expression, list: string | null) => {
    if (expr.type === "SubExpression") {
      (expr as hbs.AST.SubExpression).params.forEach((p) => visitExpr(p, list));
      return;
    }
    if (expr.type !== "PathExpression") return; // literales (1, "x") no son variables
    const path = expr as hbs.AST.PathExpression;
    if (path.data || path.parts.length === 0) return; // @index, {{this}}
    if (list) {
      const fields = found.get(list);
      const field = path.parts.join("."); // "this.codigo" -> parts ["codigo"]
      if (fields && !fields.includes(field)) fields.push(field);
      return;
    }
    if (path.original === "this" || path.original.startsWith("this.")) return;
    if (!found.has(path.original)) found.set(path.original, null);
  };

  const visit = (node: hbs.AST.Node, list: string | null) => {
    if (node.type === "Program") {
      (node as hbs.AST.Program).body.forEach((n) => visit(n, list));
    } else if (node.type === "MustacheStatement") {
      const m = node as hbs.AST.MustacheStatement;
      if (m.params.length === 0) visitExpr(m.path as hbs.AST.Expression, list);
      else m.params.forEach((p) => visitExpr(p, list)); // {{helper a b}}: el path es el helper
    } else if (node.type === "BlockStatement") {
      const b = node as hbs.AST.BlockStatement;
      const first = b.params[0];
      if (b.path.original === "each" && !list && first?.type === "PathExpression") {
        const key = (first as hbs.AST.PathExpression).original;
        if (found.get(key) == null) found.set(key, []); // lista (aunque antes se viera como valor)
        if (b.program) visit(b.program, key);
      } else {
        b.params.forEach((p) => visitExpr(p, list));
        if (b.program) visit(b.program, list);
      }
      if (b.inverse) visit(b.inverse, list); // {{else}}: mismo ámbito de fuera
    }
  };

  visit(program, null);
  return found;
}

/** Claves de primer nivel usadas (sin repetir, en orden de aparición). */
export const extractVariableKeys = (html: string) => [...analyzeVariables(html).keys()];

export type DataMapping = { [key: string]: string | DataMapping | DataMapping[] };

/** "a.b.c" -> { a: { b: { c: "" } } } (Handlebars resuelve {{a.b.c}} navegando objetos). */
function setPath(target: DataMapping, path: string) {
  const parts = path.split(".");
  let node = target;
  for (const part of parts.slice(0, -1)) {
    if (typeof node[part] !== "object" || Array.isArray(node[part])) node[part] = {};
    node = node[part] as DataMapping;
  }
  const last = parts[parts.length - 1]!;
  if (!(last in node)) node[last] = "";
}

/**
 * Molde de datos para rellenar la plantilla: cada clave con "" y cada lista con UN elemento
 * de ejemplo con sus campos. Se calcula del HTML (no se guarda): nunca se desfasa.
 *   { "asegurado": "", "coberturas": [{ "codigo": "", "descripcion": "" }] }
 */
export function buildDataMapping(html: string): DataMapping {
  const mapping: DataMapping = {};
  for (const [key, fields] of analyzeVariables(html)) {
    if (fields === null) {
      setPath(mapping, key);
    } else {
      const item: DataMapping = {};
      fields.forEach((f) => setPath(item, f));
      mapping[key] = fields.length > 0 ? [item] : [];
    }
  }
  return mapping;
}

/** Respuesta de la API: la fila + su `dataMapping` (derivado del html). */
export const withDataMapping = <T extends { html: string }>(t: T) => ({ ...t, dataMapping: buildDataMapping(t.html) });

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
