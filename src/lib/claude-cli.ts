/**
 * Ejecuta Claude Code del Mac (`claude -p`) para el asistente de presupuestos y devuelve su salida JSON.
 * Sin base de datos ni Next: lo usan el asistente en modo local y el trabajador del Mac con Central en producción.
 *
 * Seguridad: el comando y sus opciones se fijan aquí (solo la herramienta Read, sin MCP, modo restringido, modelo y
 * esquema de salida fijos). De fuera solo llega texto (instrucciones y mensaje) y un id de sesión validado, así que
 * nadie que controle la petición puede darle a Claude Code más herramientas ni otras opciones.
 */
import { execFile } from 'node:child_process'

export type CliResult = { is_error?: boolean; result?: string; session_id?: string; structured_output?: { message?: string; proposal?: unknown } }
/** Una vuelta del asistente: instrucciones, mensaje desde cero y, si hay conversación previa, su sesión y mensaje. */
export type AssistantRun = { system: string; fresh: string; resume?: { sessionId: string; prompt: string } }

const TIMEOUT_MS = 8 * 60 * 1000
const MODEL = 'opus'
const SESSION = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const str = { type: 'string' }
const strs = { type: 'array', items: str }
/** Lo que Claude Code tiene que devolver (salida estructurada validada por la propia CLI). */
const SCHEMA = {
  type: 'object',
  required: ['message'],
  properties: {
    message: { type: 'string', description: 'Respuesta para Paulo en Markdown: análisis, criterios del precio, riesgos y dudas.' },
    proposal: {
      type: 'object',
      description: 'Presupuesto completo propuesto. Omitir solo si de verdad no hay información para proponer nada.',
      required: ['title', 'scope', 'items', 'payments', 'schedule', 'includes', 'excludes', 'assumptions'],
      properties: {
        title: str,
        scope: { type: 'string', description: 'Objeto y alcance: qué se hace, para qué y con qué tecnología. Párrafos.' },
        items: {
          type: 'array',
          items: {
            type: 'object', required: ['name', 'details', 'price'],
            properties: {
              name: { type: 'string', description: 'Nombre de la fase, hito o paquete' },
              details: { type: 'string', description: 'Qué incluye, en una o dos frases' },
              price: { type: 'number', description: 'Precio en euros sin IVA; si es variable, el mínimo' },
              priceMax: { type: 'number', description: 'Solo si el precio es variable: el máximo' },
              quantity: { type: 'number', description: 'Solo para paquetes recurrentes (p. ej. 12 meses de mantenimiento)' },
              unit: { type: 'string', description: 'Solo con quantity: mes, año, unidad…' },
            },
          },
        },
        payments: { type: 'array', description: 'Forma de pago: hitos de facturación que suman 100 %', items: { type: 'object', required: ['name', 'percent'], properties: { name: str, percent: { type: 'number' } } } },
        schedule: { type: 'array', description: 'Cronograma', items: { type: 'object', required: ['when', 'what'], properties: { when: str, what: str } } },
        includes: strs, excludes: strs, assumptions: strs,
        thirdPartyCosts: { type: 'string', description: 'Costes de terceros a cargo del cliente' },
        notes: { type: 'string', description: 'Notas finales y condiciones' },
      },
    },
  },
}

function args(system: string, prompt: string, sessionId?: string) {
  if (sessionId && !SESSION.test(sessionId)) throw new Error('Id de sesión no válido')
  return ['-p', '--output-format', 'json', '--json-schema', JSON.stringify(SCHEMA), '--model', MODEL,
    '--restricted', '--strict-mcp-config', '--mcp-config', '{"mcpServers":{}}', '--tools', 'Read',
    '--append-system-prompt', system, ...(sessionId ? ['--resume', sessionId] : []), '--', prompt]
}

function runClaude(argv: string[], cwd: string): Promise<CliResult> {
  return new Promise((resolve, reject) => {
    execFile('claude', argv, { cwd, timeout: TIMEOUT_MS, maxBuffer: 32 * 1024 * 1024, env: { ...process.env, PATH: `${process.env.HOME}/.local/bin:${process.env.PATH}` } }, (err, stdout) => {
      try { return resolve(JSON.parse(stdout) as CliResult) } catch { /* no es JSON */ }
      reject(err?.message.includes('ENOENT') ? new Error('No encuentro Claude Code en el Mac (comando «claude»)') : new Error(err ? `Claude Code ha fallado: ${err.message.slice(0, 300)}` : 'Claude Code no ha devuelto una respuesta válida'))
    })
  })
}

/** Sigue la conversación si hay sesión; si la sesión ya no existe o falla, empieza de cero. */
export async function runAssistant(run: AssistantRun, cwd: string) {
  if (!run.resume) return runClaude(args(run.system, run.fresh), cwd)
  const r = await runClaude(args(run.system, run.resume.prompt, run.resume.sessionId), cwd).catch(() => null)
  return r && !r.is_error ? r : runClaude(args(run.system, run.fresh), cwd)
}
