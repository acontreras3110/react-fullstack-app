import { eq } from "drizzle-orm";
import { db } from "@/db";
import { templates } from "@/db/schema";
import { body, handler, HttpError, json, noContent, parseId } from "@/lib/http";
import { TemplateInput } from "@/lib/schemas";
import { prepareTemplate } from "@/lib/template";

type Ctx = { params: Promise<{ id: string }> };
const notFound = () => new HttpError(404, "Plantilla no encontrada");

export const GET = handler(async (_req: Request, { params }: Ctx) => {
  const id = parseId((await params).id);
  const t = await db.query.templates.findFirst({ where: eq(templates.id, id) });
  if (!t) throw notFound();
  return json(t);
});

/** PUT = reemplazo completo: html y variables siempre viajan juntos (deben ser coherentes). */
export const PUT = handler(async (req: Request, { params }: Ctx) => {
  const id = parseId((await params).id);
  const { name, html, variables } = await body(req, TemplateInput);
  const prepared = prepareTemplate(html, variables);
  const [t] = await db.update(templates).set({ name, ...prepared }).where(eq(templates.id, id)).returning();
  if (!t) throw notFound();
  return json(t);
});

export const DELETE = handler(async (_req: Request, { params }: Ctx) => {
  const id = parseId((await params).id);
  const deleted = await db.delete(templates).where(eq(templates.id, id)).returning({ id: templates.id });
  if (!deleted.length) throw notFound();
  return noContent();
});
