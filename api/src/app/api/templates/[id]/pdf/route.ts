import { eq } from "drizzle-orm";
import { db } from "@/db";
import { templates } from "@/db/schema";
import { body, handler, HttpError, json, parseId } from "@/lib/http";
import { htmlToPdf } from "@/lib/pdf";
import { RenderInput, renderTemplate } from "@/lib/render";

export const dynamic = "force-dynamic";
export const runtime = "nodejs"; // Playwright necesita Node (no Edge)

type Ctx = { params: Promise<{ id: string }> };

/** POST /api/templates/{id}/pdf  { data } -> { filename, pdfBase64 } */
export const POST = handler(async (req: Request, { params }: Ctx) => {
  const id = parseId((await params).id);
  const { data } = await body(req, RenderInput);
  const t = await db.query.templates.findFirst({ where: eq(templates.id, id) });
  if (!t) throw new HttpError(404, "Plantilla no encontrada");

  const html = renderTemplate(t, data);
  const pdf = await htmlToPdf(html);
  const filename = `${t.name.replace(/[^\p{L}\p{N}_-]+/gu, "_").slice(0, 80) || "documento"}.pdf`;
  return json({ filename, pdfBase64: pdf.toString("base64") });
});
