import { desc } from "drizzle-orm";
import { db } from "@/db";
import { templates } from "@/db/schema";
import { body, handler, json } from "@/lib/http";
import { TemplateInput } from "@/lib/schemas";
import { prepareTemplate } from "@/lib/template";

export const dynamic = "force-dynamic";

/** Listado sin `html` (puede ser grande): solo lo necesario para elegir plantilla. */
export const GET = handler(async () => {
  const items = await db
    .select({
      id: templates.id,
      name: templates.name,
      variables: templates.variables,
      createdAt: templates.createdAt,
      updatedAt: templates.updatedAt,
    })
    .from(templates)
    .orderBy(desc(templates.updatedAt), desc(templates.id));
  return json({ items });
});

export const POST = handler(async (req: Request) => {
  const { name, html, variables } = await body(req, TemplateInput);
  const prepared = prepareTemplate(html, variables);
  const [t] = await db.insert(templates).values({ name, ...prepared }).returning();
  return json(t, 201);
});
