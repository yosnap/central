/**
 * Envoltorio de las rutas /api/v1: comprueba la clave y el permiso, valida la entrada y responde JSON sin caché.
 * Los fallos internos devuelven un 500 genérico; el registro solo lleva la ruta y el mensaje, nunca cabeceras.
 */
import { z } from 'zod'
import { apiError, requireApiKey, type ApiCaller } from './auth'
import type { ApiScope } from './keys'
import { MUTATION_STATUS, MutationError } from './mutations/errors'
import { scrubDeep } from './scrub'

type Auth = typeof requireApiKey
type Handler<P> = (req: Request, ctx: { params: P; caller: ApiCaller }) => Promise<Response>

/** Error de entrada con su respuesta 400 (o la que se indique). */
export class ApiInputError extends Error {
  constructor(message: string, readonly status = 400) { super(message) }
}

/** Respuesta JSON sin caché y sin IPs literales (`scrubDeep`), sea cual sea la ruta. */
export function json(data: unknown, init: ResponseInit = {}): Response {
  return Response.json(scrubDeep(data, { paths: false }), { ...init, headers: { 'cache-control': 'no-store', ...init.headers } })
}

export function apiRoute<P = Record<string, never>>(scope: ApiScope | readonly ApiScope[] | null, handler: Handler<P>, auth: Auth = requireApiKey) {
  return async (req: Request, ctx: { params: Promise<P> }): Promise<Response> => {
    try {
      const a = await auth(req, scope)
      if (!a.ok) return a.response
      return await handler(req, { params: await ctx.params, caller: a.caller })
    } catch (e) {
      if (e instanceof z.ZodError) return apiError(400, 'invalid', { detail: e.issues.map((i) => `${i.path.join('.') || 'cuerpo'}: ${i.message}`).join('; ') })
      if (e instanceof ApiInputError) return apiError(e.status, 'invalid', { detail: e.message })
      if (e instanceof MutationError) {
        return json({ error: e.code, detail: e.message, ...(e.current === undefined ? {} : { current: e.current }) }, { status: MUTATION_STATUS[e.code] })
      }
      console.error(`[api] ${req.method} ${new URL(req.url).pathname}: ${e instanceof Error ? e.message : 'error'}`)
      return apiError(500, 'internal')
    }
  }
}

/** Parámetros de la URL validados con Zod (lanza ZodError → 400). */
export function query<T extends z.ZodType>(req: Request, schema: T): z.infer<T> {
  return schema.parse(Object.fromEntries(new URL(req.url).searchParams))
}

/** Tope del cuerpo de una petición (un borrador grande cabe de sobra). */
export const MAX_BODY_BYTES = 256 * 1024

/** JSON del cuerpo, con tope de tamaño (400 si se pasa, aunque no declare `content-length`, o si no es JSON). */
async function readJson(req: Request): Promise<unknown> {
  const tooBig = () => new ApiInputError(`El cuerpo pasa de ${MAX_BODY_BYTES / 1024} KiB`)
  if (Number(req.headers.get('content-length') ?? 0) > MAX_BODY_BYTES) throw tooBig()
  const chunks: Uint8Array[] = []
  let size = 0
  if (req.body) {
    const reader = req.body.getReader()
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > MAX_BODY_BYTES) { await reader.cancel().catch(() => {}); throw tooBig() }
      chunks.push(value)
    }
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')) } catch { throw new ApiInputError('El cuerpo no es JSON válido') }
}

/** Cuerpo JSON validado con Zod (400 si no cumple el esquema). */
export async function body<T extends z.ZodType>(req: Request, schema: T): Promise<z.infer<T>> {
  return schema.parse(await readJson(req))
}

/**
 * Cuerpo de una escritura: 400 si no es JSON o se pasa de tamaño; 422 si es JSON pero no cumple el esquema (campos
 * desconocidos, tipos, topes), con el detalle de cada campo.
 */
export async function writeBody<T extends z.ZodType>(req: Request, schema: T): Promise<z.infer<T>> {
  const r = schema.safeParse(await readJson(req))
  if (!r.success) throw new ApiInputError(r.error.issues.map((i) => `${i.path.join('.') || 'cuerpo'}: ${i.message}`).join('; '), 422)
  return r.data
}

/** Quién escribe, para el registro de cambios. */
export const actorOf = (caller: ApiCaller) => ({ keyId: caller.id, keyName: caller.name })

export const notFound = () => apiError(404, 'not_found')
