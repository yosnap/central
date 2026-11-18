import pkg from '../../../../../package.json'
import { isRemote } from '@/lib/worker'
import { apiRoute, json } from '@/lib/api/route'

export const dynamic = 'force-dynamic'

/** Comprueba la clave: versión de Central, permisos de la clave y dónde corre (servidor o Mac). Vale con cualquier permiso. */
export const GET = apiRoute(null, async (_req, { caller }) =>
  json({ version: pkg.version, api: 'v1', scopes: caller.scopes, runtime: isRemote() ? 'production' : 'local' }))
