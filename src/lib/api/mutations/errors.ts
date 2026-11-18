/**
 * Errores esperados de las escrituras comunes (web, MCP y API v1). La API los convierte en su código HTTP; la web,
 * en el mensaje del formulario. Lo demás es un fallo interno.
 */
export type MutationCode = 'not_found' | 'conflict' | 'duplicate' | 'status_locked' | 'invalid'

export const MUTATION_STATUS: Record<MutationCode, number> = { not_found: 404, conflict: 409, duplicate: 409, status_locked: 409, invalid: 422 }

export class MutationError extends Error {
  /** `current`: la entidad tal como está ahora, para que quien choca con otro cambio la vuelva a enseñar. */
  constructor(readonly code: MutationCode, message: string, readonly current?: unknown) { super(message) }
}

/** Para las Server Actions: el error esperado pasa a `{ error }` y lo demás sigue su curso. */
export async function formResult<T>(run: Promise<T>): Promise<{ value: T; error?: undefined } | { error: string }> {
  try { return { value: await run } } catch (e) {
    if (e instanceof MutationError) return { error: e.message }
    throw e
  }
}
