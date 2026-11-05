/** Lo que falta en la protección de un servidor como issue de GitHub en Markdown, listo para pegar o pasar a un agente. */
type Check = { key: string; ok: boolean | null; detail: string | null; fix: string | null }

export function protectionIssueMarkdown(server: { name: string; host: string; sshPort: number; adminUser: string | null }, checks: Check[]) {
  const failing = checks.filter((c) => c.ok === false)
  const unknown = checks.filter((c) => c.ok === null)
  const ssh = `ssh ${server.sshPort === 22 ? '' : `-p ${server.sshPort} `}${server.adminUser ?? 'root'}@${server.host}`
  return [
    `# Seguridad: bastionar el servidor ${server.name}`,
    '',
    `Central marca ${failing.length} ${failing.length === 1 ? 'comprobación de protección pendiente' : 'comprobaciones de protección pendientes'} de ${checks.length} en **${server.name}** (\`${ssh}\`).`,
    '',
    '## Qué arreglar',
    '',
    ...failing.flatMap((c) => [`- [ ] **${c.detail ?? c.key}**`, ...(c.fix ? ['', '  ```', `  ${c.fix}`, '  ```', ''] : [])]),
    ...(unknown.length ? ['', '## Sin dato', '', ...unknown.map((c) => `- ${c.detail ?? c.key}: no se pudo mirar (suele necesitar la lectura de root de infobar)`)] : []),
    '',
    '## Cómo hacerlo sin dejarte fuera',
    '',
    '1. Antes de tocar sshd, comprueba que entras con clave (no con contraseña) y deja una sesión abierta mientras pruebas otra nueva.',
    '2. Valida cada cambio de sshd con `sudo sshd -t` antes de recargar.',
    '3. Docker publica puertos saltándose ufw: ciérralos con `remote/cerrar-puerto-docker.sh` (repositorio de Central) o en el cortafuegos del proveedor.',
    '4. Al terminar, en Central, «Leer ahora» en la ficha del servidor: las comprobaciones pasan a verde solas.',
    '',
  ].join('\n')
}
