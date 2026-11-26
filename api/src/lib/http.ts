import { NextResponse } from "next/server";
import { z, ZodError } from "zod";

export class HttpError extends Error {
  constructor(public status: number, message: string, public extra?: unknown) {
    super(message);
  }
}

export const json = <T>(body: T, status = 200) => NextResponse.json(body, { status });
export const noContent = () => new NextResponse(null, { status: 204 });

/** Parsea y valida; lanza 422 con el detalle de zod. */
export function parse<S extends z.ZodType>(schema: S, data: unknown): z.output<S> {
  const r = schema.safeParse(data);
  if (!r.success) throw new HttpError(422, "Datos inválidos", z.flattenError(r.error));
  return r.data;
}

export async function body<S extends z.ZodType>(req: Request, schema: S): Promise<z.output<S>> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw new HttpError(400, "JSON inválido");
  }
  return parse(schema, raw);
}

export function query<S extends z.ZodType>(req: Request, schema: S): z.output<S> {
  return parse(schema, Object.fromEntries(new URL(req.url).searchParams));
}

export function parseId(raw: string): number {
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1) throw new HttpError(404, "No encontrado");
  return n;
}

/** Envuelve un handler: traduce errores a { detail } con el status correcto. */
export function handler<Args extends unknown[]>(fn: (...args: Args) => Promise<Response>) {
  return async (...args: Args): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (e) {
      if (e instanceof HttpError) {
        return NextResponse.json({ detail: e.message, errors: e.extra }, { status: e.status });
      }
      if (e instanceof ZodError) return NextResponse.json({ detail: "Datos inválidos" }, { status: 422 });
      console.error(e);
      return NextResponse.json({ detail: "Error interno" }, { status: 500 });
    }
  };
}
