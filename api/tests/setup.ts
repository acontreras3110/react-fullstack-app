import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { vi } from "vitest";
import * as schema from "@/db/schema";

// Postgres real en memoria (WASM) con las mismas migraciones que producción
const client = new PGlite();
const testDb = drizzle(client, { schema });
await migrate(testDb, { migrationsFolder: "./drizzle" });

vi.mock("@/db", () => ({ db: testDb }));
