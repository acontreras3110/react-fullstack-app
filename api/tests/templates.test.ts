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
const chip = (key: string) => `<span data-variable="${key}">{{${key}}}</span>`;

const contrato = {
  name: "Contrato",
  html: `<h1>Contrato</h1><p>Cliente: ${chip("cliente_nombre")}, fecha ${chip("fecha")}. Otra vez ${chip("cliente_nombre")}</p>`,
  variables: [
    { key: "cliente_nombre", label: "Nombre del cliente", required: true },
    { key: "fecha", label: "Fecha", required: false },
    { key: "no_usada", label: "No usada", required: true },
  ],
};

describe("saneado y extracción", () => {
  it("elimina script, on*, enlaces y estilos no permitidos; conserva data-variable y text-align", () => {
    const out = sanitizeTemplateHtml(
      `<p style="text-align:center;color:red" onclick="x()">Hola<script>alert(1)</script>` +
        `<a href="http://evil">link</a><img src=x onerror=alert(1)>${chip("a")}</p>`,
    );
    expect(out).toBe(`<p style="text-align:center">Holalink${chip("a")}</p>`);
  });

  it("extrae claves únicas en orden de aparición", () => {
    expect(extractVariableKeys(contrato.html)).toEqual(["cliente_nombre", "fecha"]);
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
    expect((await one.json()).html).toContain('data-variable="fecha"');

    const put = await byId.PUT(
      req("PUT", { name: "Contrato v2", html: `<p>${chip("fecha")}</p>`, variables: contrato.variables }),
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
    const missing = await list.POST(req("POST", { name: "X", html: `<p>${chip("sin_def")}</p>`, variables: [] }));
    expect(missing.status).toBe(422);
    expect((await missing.json()).detail).toContain("sin_def");

    const v = { key: "a", label: "A", required: true };
    expect((await list.POST(req("POST", { name: "X", html: "", variables: [v, v] }))).status).toBe(422);
    expect((await list.POST(req("POST", { name: "X", html: "", variables: [{ ...v, key: "Mal-Key" }] }))).status).toBe(422);
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
      req("POST", { name: "R", html: `<p>${chip("x")}</p>`, variables: [{ key: "x", label: "X" }] }),
    );
    expect((await r.json()).variables).toEqual([{ key: "x", label: "X", required: true }]);
  });
});

describe("tablas de TipTap", () => {
  it("conserva la tabla y sus celdas; quita colgroup y min-width", () => {
    const tiptap =
      `<table style="min-width: 50px;"><colgroup><col style="min-width: 25px;"><col style="min-width: 25px;"></colgroup>` +
      `<tbody><tr><th colspan="1" rowspan="1"><p>Cuota</p></th><td colspan="1" rowspan="1"><p>${chip("fecha")}</p></td></tr></tbody></table>`;
    expect(sanitizeTemplateHtml(tiptap)).toBe(
      `<table><tbody><tr><th colspan="1" rowspan="1"><p>Cuota</p></th>` +
        `<td colspan="1" rowspan="1"><p>${chip("fecha")}</p></td></tr></tbody></table>`,
    );
  });
});
