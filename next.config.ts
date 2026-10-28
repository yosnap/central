import type { NextConfig } from 'next'
import pkg from './package.json'

const nextConfig: NextConfig = {
  output: 'standalone',
  // la versión de package.json (la del CHANGELOG.md) se muestra en la navegación
  env: { NEXT_PUBLIC_APP_VERSION: pkg.version },
  // ssh2 trae módulos nativos opcionales que no se empaquetan; react-pdf se ejecuta tal cual en el servidor
  serverExternalPackages: ['pg', 'ssh2', '@react-pdf/renderer', 'sharp'],
  // el logo de la marca (1 MB) y los documentos para el asistente de presupuestos (20 MB) viajan en formularios
  experimental: { serverActions: { bodySizeLimit: '25mb' } },
}

export default nextConfig
