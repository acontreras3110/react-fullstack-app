import { z } from "zod";
import * as S from "./schemas";
import { RenderInput } from "./render";

const schemas = {
  TemplateVariable: S.TemplateVariable,
  TemplateInput: S.TemplateInput,
  TemplateOut: S.TemplateOut,
  TemplateSummary: S.TemplateSummary,
  TemplateList: S.TemplateList,
  ApiError: S.ApiError,
  RenderInput,
  PdfOut: S.PdfOut,
};
type Name = keyof typeof schemas;

const ref = (n: Name) => ({ $ref: `#/components/schemas/${n}` });
const content = (n: Name) => ({ "application/json": { schema: ref(n) } });
const err = { description: "Error", content: content("ApiError") };
const idParam = { name: "id", in: "path", required: true, schema: { type: "integer" } };
const ok = (n: Name) => ({ description: "OK", content: content(n) });

export function buildOpenApi() {
  return {
    openapi: "3.1.0",
    info: { title: "Templates API", version: "0.1.0" },
    components: {
      schemas: Object.fromEntries(
        Object.entries(schemas).map(([k, s]) => [k, z.toJSONSchema(s, { io: k === "TemplateInput" ? "input" : "output" })]),
      ),
    },
    paths: {
      "/api/templates": {
        get: { tags: ["templates"], summary: "Listar plantillas", responses: { "200": ok("TemplateList") } },
        post: {
          tags: ["templates"], summary: "Crear plantilla",
          requestBody: { required: true, content: content("TemplateInput") },
          responses: { "201": ok("TemplateOut"), "422": err },
        },
      },
      "/api/templates/{id}": {
        parameters: [idParam],
        get: { tags: ["templates"], summary: "Obtener plantilla", responses: { "200": ok("TemplateOut"), "404": err } },
        put: {
          tags: ["templates"], summary: "Reemplazar plantilla",
          requestBody: { required: true, content: content("TemplateInput") },
          responses: { "200": ok("TemplateOut"), "404": err, "422": err },
        },
        delete: { tags: ["templates"], summary: "Eliminar plantilla", responses: { "204": { description: "Sin contenido" }, "404": err } },
      },
      "/api/templates/{id}/pdf": {
        parameters: [idParam],
        post: {
          tags: ["templates"], summary: "Generar PDF (Base64) con los datos del formulario",
          requestBody: { required: true, content: content("RenderInput") },
          responses: { "200": ok("PdfOut"), "404": err, "422": err, "504": err },
        },
      },
    },
  };
}
