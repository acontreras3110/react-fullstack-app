import { describe, expect, it } from "vitest";
import * as list from "@/app/api/templates/route";
import * as byId from "@/app/api/templates/[id]/route";
import { buildOpenApi } from "@/lib/openapi";
import { extractVariableKeys, sanitizeTemplateHtml } from "@/lib/template";

const req = (method: string, body?: unknown) =>
  new Request("http://test/api/templates", {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
const ctx = (id: number | string) => ({ params: Promise.resolve({ id: String(id) }) });
const hb = (key: string) => `{{${key}}}`;

const contrato = {
  name: "Contrato",
  html: `<h1>Contrato</h1><p>Cliente: ${hb("cliente_nombre")}, fecha ${hb("fecha")}. Otra vez ${hb("cliente_nombre")}</p>`,
  variables: [
    { key: "cliente_nombre", label: "Nombre del cliente", required: true },
    { key: "fecha", label: "Fecha", required: false },
    { key: "no_usada", label: "No usada", required: true },
  ],
};

describe("saneado quirúrgico", () => {
  it("conserva documento completo byte a byte: doctype, <style>, class, data:, comentarios, Handlebars", () => {
    const doc =
      `<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8"/><style>.a{color:red}</style></head>` +
      `<body><div class="page" style="width:8.5in" data-dynamic><!-- nota -->` +
      `<img src="data:image/png;base64,iVBOR=" alt=x>` +
      `<table><tbody>{{#each coberturas}}<tr><td>{{this.codigo}}</td></tr>{{/each}}</tbody></table>` +
      `{{#ifEquals medio-pago "1"}}<b>PAT</b>{{/ifEquals}} {{> parcial}}</div></body></html>`;
    expect(sanitizeTemplateHtml(doc)).toBe(doc);
  });

  it("quita script, link, iframe, meta http-equiv, on*, javascript: (y solo eso)", () => {
    const out = sanitizeTemplateHtml(
      `<head><link rel="icon" href="/favicon.svg"/><meta http-equiv="refresh" content="0;url=x">` +
        `<script type="module">const a = "<p>";</script></head>` +
        `<p class="x" onclick="x()">Hola</p><img src=x onerror=alert(1) />` +
        `<a href="  java	script:alert(1)">link</a><iframe src="https://evil"><p>dentro</p></iframe>{{a}}`,
    );
    expect(out).toBe(`<head></head><p class="x">Hola</p><img src="x" /><a>link</a>{{a}}`);
  });

  it("extrae claves con el AST de Handlebars (no regex)", () => {
    const html =
      `{{cliente}} {{#if monto}}{{monto}}{{/if}} {{#ifEquals medio-pago 1}}x{{/ifEquals}}` +
      `{{#each coberturas}}{{this.codigo}} {{descripcion}} {{@index}}{{/each}} {{cliente}}`;
    expect(extractVariableKeys(html)).toEqual(["cliente", "monto", "medio-pago", "coberturas"]);
  });
});

describe("CRUD /api/templates", () => {
  it("crea, lista, obtiene, reemplaza y borra", async () => {
    const created = await list.POST(req("POST", contrato));
    expect(created.status).toBe(201);
    const t = await created.json();
    // Solo se guardan las variables realmente usadas
    expect(t.variables.map((v: { key: string }) => v.key)).toEqual(["cliente_nombre", "fecha"]);

    const all = await (await list.GET()).json();
    expect(all.items).toHaveLength(1);
    expect(all.items[0]).not.toHaveProperty("html");

    const one = await byId.GET(req("GET"), ctx(t.id));
    expect((await one.json()).html).toBe(contrato.html); // se guarda tal cual

    const put = await byId.PUT(
      req("PUT", { name: "Contrato v2", html: `<p>${hb("fecha")}</p>`, variables: contrato.variables }),
      ctx(t.id),
    );
    expect(put.status).toBe(200);
    const updated = await put.json();
    expect(updated.name).toBe("Contrato v2");
    expect(updated.variables).toEqual([{ key: "fecha", label: "Fecha", required: false }]);

    expect((await byId.DELETE(req("DELETE"), ctx(t.id))).status).toBe(204);
    expect((await byId.GET(req("GET"), ctx(t.id))).status).toBe(404);
    expect((await byId.DELETE(req("DELETE"), ctx(t.id))).status).toBe(404);
  });

  it("422: variable usada sin definir, duplicada, clave inválida o nombre vacío", async () => {
    const missing = await list.POST(req("POST", { name: "X", html: `<p>${hb("sin_def")}</p>`, variables: [] }));
    expect(missing.status).toBe(422);
    expect((await missing.json()).detail).toContain("sin_def");

    const v = { key: "a", label: "A", required: true };
    expect((await list.POST(req("POST", { name: "X", html: "", variables: [v, v] }))).status).toBe(422);
    for (const bad of ["1empieza-por-numero", "con espacio", "con{{llave}}", "x".repeat(51)]) {
      expect((await list.POST(req("POST", { name: "X", html: "", variables: [{ ...v, key: bad }] }))).status).toBe(422);
    }
    // Guiones y mayúsculas SÍ (deben coincidir con los datos de origen: "tipo-poliza").
    const ok = await list.POST(
      req("POST", { name: "X", html: `<p>${hb("tipo-poliza")}</p>`, variables: [{ ...v, key: "tipo-poliza" }] }),
    );
    expect(ok.status).toBe(201);
    expect((await list.POST(req("POST", { name: "  ", html: "" }))).status).toBe(422);
  });

  it("404 en ids inválidos y OpenAPI generable", async () => {
    expect((await byId.GET(req("GET"), ctx("abc"))).status).toBe(404);
    expect((await byId.PUT(req("PUT", { name: "X", html: "" }), ctx(9999))).status).toBe(404);
    expect(Object.keys(buildOpenApi().paths)).toEqual(["/api/templates", "/api/templates/{id}"]);
  });
});

describe("required", () => {
  it("por defecto es obligatoria si no se indica", async () => {
    const r = await list.POST(
      req("POST", { name: "R", html: `<p>${hb("x")}</p>`, variables: [{ key: "x", label: "X" }] }),
    );
    expect((await r.json()).variables).toEqual([{ key: "x", label: "X", required: true }]);
  });
});

describe("Handlebars inválido", () => {
  it("422 con el mensaje del parser", async () => {
    const r = await list.POST(req("POST", { name: "X", html: "{{#if a}}sin cerrar", variables: [] }));
    expect(r.status).toBe(422);
    expect((await r.json()).detail).toContain("Handlebars");
  });
});
