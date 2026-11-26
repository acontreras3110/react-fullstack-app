import { desc } from "drizzle-orm";
import { db } from "@/db";
import { templates } from "@/db/schema";
import { body, handler, json } from "@/lib/http";
import { TemplateInput } from "@/lib/schemas";
import { buildDataMapping, prepareTemplate, withDataMapping } from "@/lib/template";

export const dynamic = "force-dynamic";

/**
 * Listado SIN `html` (puede ser grande) pero CON `dataMapping`: se lee el html solo para
 * calcularlo en el servidor y no se envía.
 */
export const GET = handler(async () => {
  const items = await db
    .select({
      id: templates.id,
      name: templates.name,
      html: templates.html,
      variables: templates.variables,
      createdAt: templates.createdAt,
      updatedAt: templates.updatedAt,
    })
    .from(templates)
    .orderBy(desc(templates.updatedAt), desc(templates.id));
  return json({ items: items.map(({ html, ...rest }) => ({ ...rest, dataMapping: buildDataMapping(html) })) });
});

export const POST = handler(async (req: Request) => {
  const { name, html, variables } = await body(req, TemplateInput);
  const prepared = prepareTemplate(html, variables);
  const [t] = await db.insert(templates).values({ name, ...prepared }).returning();
  return json(withDataMapping(t!), 201);
});
