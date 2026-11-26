import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

// Singleton que sobrevive al HMR de `next dev`
const g = globalThis as unknown as { pool?: Pool };
const pool =
  g.pool ??
  new Pool({ connectionString: process.env.DATABASE_URL ?? "postgres://app:app@localhost:5432/app" });
if (process.env.NODE_ENV !== "production") g.pool = pool;

export const db = drizzle(pool, { schema });
export type DB = typeof db;
