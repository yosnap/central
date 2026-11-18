/**
 * Envoltorio de las rutas /api/v1: comprueba la clave y el permiso, valida la entrada y responde JSON sin caché.
 * Los fallos internos devuelven un 500 genérico; el registro solo lleva la ruta y el mensaje, nunca cabeceras.
 */
import { z } from 'zod'
import { apiError, requireApiKey, type ApiCaller } from './auth'
import type { ApiScope } from './keys'

type Auth = typeof requireApiKey
type Handler<P> = (req: Request, ctx: { params: P; caller: ApiCaller }) => Promise<Response>

/** Error de entrada con su respuesta 400 (o la que se indique). */
export class ApiInputError extends Error {
  constructor(message: string, readonly status = 400) { super(message) }
}

export function json(data: unknown, init: ResponseInit = {}): Response {
  return Response.json(data, { ...init, headers: { 'cache-control': 'no-store', ...init.headers } })
}

export function apiRoute<P = Record<string, never>>(scope: ApiScope | null, handler: Handler<P>, auth: Auth = requireApiKey) {
  return async (req: Request, ctx: { params: Promise<P> }): Promise<Response> => {
    try {
      const a = await auth(req, scope)
      if (!a.ok) return a.response
      return await handler(req, { params: await ctx.params, caller: a.caller })
    } catch (e) {
      if (e instanceof z.ZodError) return apiError(400, 'invalid', { detail: e.issues.map((i) => `${i.path.join('.') || 'cuerpo'}: ${i.message}`).join('; ') })
      if (e instanceof ApiInputError) return apiError(e.status, 'invalid', { detail: e.message })
      console.error(`[api] ${req.method} ${new URL(req.url).pathname}: ${e instanceof Error ? e.message : 'error'}`)
      return apiError(500, 'internal')
    }
  }
}

/** Parámetros de la URL validados con Zod (lanza ZodError → 400). */
export function query<T extends z.ZodType>(req: Request, schema: T): z.infer<T> {
  return schema.parse(Object.fromEntries(new URL(req.url).searchParams))
}

/** Cuerpo JSON validado con Zod. */
export async function body<T extends z.ZodType>(req: Request, schema: T): Promise<z.infer<T>> {
  let raw: unknown
  try { raw = await req.json() } catch { throw new ApiInputError('El cuerpo no es JSON válido') }
  return schema.parse(raw)
}

export const notFound = () => apiError(404, 'not_found')
