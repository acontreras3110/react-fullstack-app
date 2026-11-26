import { buildOpenApi } from "@/lib/openapi";

export const GET = () => Response.json(buildOpenApi());
