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
 * Claves de comodín usadas (sin repetir, en orden de aparición) con el AST de Handlebars,
 * igual que el front (web/src/feature/html-template/analyze.ts):
 *   {{cliente}}, {{#if monto}}, {{#ifEquals medio-pago 1}} -> variables;
 *   {{#each coberturas}} -> variable (lista); {{this.codigo}} / @index dentro -> no.
 * Lanza 422 si la plantilla no es Handlebars válido ({{#if}} sin cerrar...).
 */
export function extractVariableKeys(html: string): string[] {
  let program: hbs.AST.Program;
  try {
    program = Handlebars.parse(html);
  } catch (e) {
    throw new HttpError(422, `Plantilla Handlebars inválida: ${e instanceof Error ? e.message : String(e)}`);
  }
  const keys = new Set<string>();

  const visitExpr = (expr: hbs.AST.Expression, inEach: boolean) => {
    if (expr.type === "SubExpression") {
      (expr as hbs.AST.SubExpression).params.forEach((p) => visitExpr(p, inEach));
      return;
    }
    if (expr.type !== "PathExpression" || inEach) return; // dentro de each = campos del elemento
    const path = expr as hbs.AST.PathExpression;
    if (path.data || path.original === "this" || path.original.startsWith("this.") || path.parts.length === 0) return;
    keys.add(path.original);
  };

  const visit = (node: hbs.AST.Node, inEach: boolean) => {
    if (node.type === "Program") {
      (node as hbs.AST.Program).body.forEach((n) => visit(n, inEach));
    } else if (node.type === "MustacheStatement") {
      const m = node as hbs.AST.MustacheStatement;
      if (m.params.length === 0) visitExpr(m.path as hbs.AST.Expression, inEach);
      else m.params.forEach((p) => visitExpr(p, inEach));
    } else if (node.type === "BlockStatement") {
      const b = node as hbs.AST.BlockStatement;
      b.params.forEach((p) => visitExpr(p, inEach));
      const isEach = b.path.original === "each";
      if (b.program) visit(b.program, inEach || isEach);
      if (b.inverse) visit(b.inverse, inEach);
    }
  };

  visit(program, false);
  return [...keys];
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
