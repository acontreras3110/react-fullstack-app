import { integer, jsonb, pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";

/**
 * Comodín de la plantilla: `{{key}}` en el documento. Sin tipo: el valor que llegue se
 * inserta tal cual (como texto escapado). `required` decide si el formulario lo exige.
 */
export type TemplateVariable = { key: string; label: string; required: boolean };

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });

export const templates = pgTable("templates", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  name: varchar({ length: 150 }).notNull(),
  // HTML del editor (TipTap), YA saneado. Los comodines van como
  // <span data-variable="key">{{key}}</span>
  html: text().notNull(),
  // Solo las variables que de verdad aparecen en `html`, en orden de definición.
  variables: jsonb().$type<TemplateVariable[]>().notNull().default([]),
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow().$onUpdate(() => new Date()),
});

export type Template = typeof templates.$inferSelect;
