import { afterAll, describe, expect, it } from "vitest";
import * as list from "@/app/api/templates/route";
import * as pdf from "@/app/api/templates/[id]/pdf/route";
import { renderTemplate } from "@/lib/render";

const vars = (...keys: string[]) => keys.map((key) => ({ key, label: key.toUpperCase(), required: true }));

describe("renderTemplate", () => {
  it("escapa los valores: un <script> del usuario sale como texto", () => {
    const html = renderTemplate({ html: "<p>{{nombre}}</p>", variables: vars("nombre") }, { nombre: `<script>alert(1)</script>"` });
    expect(html).toBe("<p>&lt;script&gt;alert(1)&lt;/script&gt;&quot;</p>");
  });

  it("{{{x}}} (sin escapar) se vuelve a sanear: no quedan script ni on*", () => {
    const html = renderTemplate(
      { html: "<div>{{{x}}}</div>", variables: vars("x") },
      { x: `<b onclick="x()">hola</b><script>alert(1)</script>` },
    );
    expect(html).toBe("<div><b>hola</b></div>");
  });

  it("ifEquals compara como texto, each recorre filas, ignora claves desconocidas", () => {
    const tpl = {
      html: `{{#ifEquals medio-pago 1}}PAT{{else}}OTRO{{/ifEquals}}|{{#each items}}[{{this.codigo}}]{{/each}}|{{extra}}`,
      variables: [...vars("medio-pago", "items"), { key: "extra", label: "Extra", required: false }],
    };
    expect(renderTemplate(tpl, { "medio-pago": "1", items: [{ codigo: "A" }, { codigo: "B" }], otra: "x" })).toBe("PAT|[A][B]|");
    expect(renderTemplate(tpl, { "medio-pago": "2", items: [{ codigo: "A" }] })).toBe("OTRO|[A]|");
  });

  it("422 si falta un obligatorio (vacío, espacios o lista vacía)", () => {
    const tpl = { html: "{{a}}{{#each l}}x{{/each}}", variables: vars("a", "l") };
    expect(() => renderTemplate(tpl, { a: "  ", l: [{}] })).toThrow(/Faltan datos obligatorios: A/);
    expect(() => renderTemplate(tpl, { a: "x", l: [] })).toThrow(/L/);
  });
});

describe("POST /api/templates/{id}/pdf (Playwright real)", () => {
  afterAll(async () => {
    const g = globalThis as unknown as { browser?: Promise<{ close(): Promise<void> }> };
    await (await g.browser)?.close();
  });

  it("devuelve un PDF en Base64; 422 sin datos obligatorios; 404 si no existe", async () => {
    const created = await list.POST(
      new Request("http://test", {
        method: "POST",
        body: JSON.stringify({ name: "Carta de prueba", html: "<h1>Hola {{nombre}}</h1>", variables: vars("nombre") }),
      }),
    );
    const { id } = await created.json();
    const call = (data: unknown, tid = id) =>
      pdf.POST(new Request("http://test", { method: "POST", body: JSON.stringify({ data }) }), {
        params: Promise.resolve({ id: String(tid) }),
      });

    const ok = await call({ nombre: "Ana" });
    expect(ok.status).toBe(200);
    const out = await ok.json();
    expect(out.filename).toBe("Carta_de_prueba.pdf");
    expect(Buffer.from(out.pdfBase64, "base64").subarray(0, 5).toString()).toBe("%PDF-");

    expect((await call({})).status).toBe(422);
    expect((await call({ nombre: "x" }, 9999)).status).toBe(404);
  }, 60_000);
});
