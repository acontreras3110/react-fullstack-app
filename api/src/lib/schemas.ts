import { z } from "zod";

// Empieza por letra; letras, números, "_" y "-" (válido en Handlebars y seguro en un
// atributo HTML). Se aceptan guiones/mayúsculas para coincidir con los datos de origen.
export const VariableKey = z
  .string()
  .regex(/^[A-Za-z][A-Za-z0-9_-]{0,49}$/, "Clave inválida (letras, números, _ o -; máx. 50)");

export const TemplateVariable = z.object({
  key: VariableKey,
  label: z.string().trim().min(1).max(100),
  required: z.boolean().default(true),
});

export const TemplateInput = z.object({
  name: z.string().trim().min(1).max(150),
  html: z.string().max(500_000),
  variables: z.array(TemplateVariable).max(200).default([]),
});

// Molde de datos: { clave: "", lista: [{ campo: "" }] }. Recursivo (a.b -> { a: { b: "" } }).
export const DataMapping = z.record(z.string(), z.any()).meta({
  description: "Molde de datos para rellenar la plantilla: cada variable con \"\" y cada lista con un elemento de ejemplo",
  example: { asegurado: "", "tipo-poliza": "", coberturas: [{ codigo: "", descripcion: "" }] },
});

export const TemplateOut = z.object({
  id: z.number().int(),
  name: z.string(),
  html: z.string(),
  variables: z.array(TemplateVariable),
  dataMapping: DataMapping,
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const TemplateSummary = TemplateOut.omit({ html: true });
export const TemplateList = z.object({ items: z.array(TemplateSummary) });

export const PdfOut = z.object({ filename: z.string(), pdfBase64: z.string() });

export const ApiError = z.object({ detail: z.string() });
