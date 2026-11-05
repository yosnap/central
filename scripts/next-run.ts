#!/usr/bin/env bun
// Lanza `next build` / `next start` para instalaciones manuales (bun run build / bun run start).
// En Windows, `bun --bun next build` falla (Bun no resuelve bien el build de Next ahí);
// en Mac/Linux se mantiene `--bun`, igual que el Dockerfile de producción. Ver docs/DECISIONES.md.
import { spawnSync } from 'node:child_process'

const [mode, ...rest] = process.argv.slice(2)
const args = process.platform === 'win32' ? ['next', mode, ...rest] : ['bun', '--bun', 'next', mode, ...rest]
const [cmd, ...cmdArgs] = args
const r = spawnSync(cmd, cmdArgs, { stdio: 'inherit', shell: true })
process.exit(r.status ?? 1)
