import { z } from "zod";

export const VariableType = z.enum(["text", "number", "date"]);

// snake_case: empieza por letra; así `{{key}}` es inequívoco y seguro en un atributo HTML.
export const VariableKey = z.string().regex(/^[a-z][a-z0-9_]{0,49}$/, "Clave inválida (snake_case, máx. 50)");

export const TemplateVariable = z.object({
  key: VariableKey,
  label: z.string().trim().min(1).max(100),
  type: VariableType,
});

export const TemplateInput = z.object({
  name: z.string().trim().min(1).max(150),
  html: z.string().max(500_000),
  variables: z.array(TemplateVariable).max(200).default([]),
});

export const TemplateOut = z.object({
  id: z.number().int(),
  name: z.string(),
  html: z.string(),
  variables: z.array(TemplateVariable),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const TemplateSummary = TemplateOut.omit({ html: true });
export const TemplateList = z.object({ items: z.array(TemplateSummary) });

export const ApiError = z.object({ detail: z.string() });
