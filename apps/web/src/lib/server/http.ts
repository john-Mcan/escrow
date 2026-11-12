import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";

/** Error controlado: su mensaje se muestra al usuario tal cual. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
    readonly headers?: Record<string, string>,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function json<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, {
    ...init,
    headers: { "Cache-Control": "no-store", ...init?.headers },
  });
}

export async function parseJsonBody<Schema extends z.ZodType>(request: Request, schema: Schema): Promise<z.output<Schema>> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new ApiError(400, "invalid_json", "El cuerpo de la solicitud no es JSON válido");
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new ApiError(422, "validation_error", "Revisa los datos enviados", z.flattenError(parsed.error));
  }
  return parsed.data;
}

/** Envuelve un Route Handler: convierte ApiError en respuestas JSON y oculta errores internos. */
export function withErrorHandling<Args extends unknown[]>(handler: (...args: Args) => Promise<Response>) {
  return async (...args: Args): Promise<Response> => {
    try {
      return await handler(...args);
    } catch (error) {
      if (error instanceof ApiError) {
        return json(
          { error: { code: error.code, message: error.message, details: error.details } },
          { status: error.status, headers: error.headers },
        );
      }
      console.error("[api] error no controlado", error);
      return json({ error: { code: "internal_error", message: "Ocurrió un error inesperado. Intenta de nuevo." } }, { status: 500 });
    }
  };
}

type DbResult = { data: unknown; error: { message: string } | null };

function dbFailure(context: string, message: string): never {
  console.error(`[db] ${context}:`, message);
  throw new ApiError(500, "database_error", "No pudimos procesar la solicitud. Intenta de nuevo.");
}

/** Resultado obligatorio: lanza ApiError 500 si la consulta falló o no devolvió datos. */
export function assertDb<R extends DbResult>(result: R, context: string): NonNullable<R["data"]> {
  if (result.error) dbFailure(context, result.error.message);
  if (result.data === null || result.data === undefined) dbFailure(context, "la consulta no devolvió datos");
  return result.data as NonNullable<R["data"]>;
}

/** Resultado opcional (p. ej. `maybeSingle`): null significa "no existe". */
export function assertDbMaybe<R extends DbResult>(result: R, context: string): R["data"] | null {
  if (result.error) dbFailure(context, result.error.message);
  return result.data ?? null;
}

/** Escrituras sin `select()`: solo importa que no haya error. */
export function assertDbOk(result: { error: { message: string } | null }, context: string): void {
  if (result.error) dbFailure(context, result.error.message);
}
