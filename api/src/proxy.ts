import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";

/** CORS: permite que el front (Vite, :5173) llame a la API (:3000). */
export function proxy(req: NextRequest) {
  const origin = req.headers.get("origin");
  const allowed = origin && env.corsOrigins.includes(origin) ? origin : null;
  const cors: Record<string, string> = allowed
    ? {
        "Access-Control-Allow-Origin": allowed,
        "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        Vary: "Origin",
      }
    : {};

  if (req.method === "OPTIONS") return new NextResponse(null, { status: 204, headers: cors });

  const res = NextResponse.next();
  for (const [k, v] of Object.entries(cors)) res.headers.set(k, v);
  return res;
}

export const config = { matcher: "/api/:path*" };
