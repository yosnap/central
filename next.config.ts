import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'standalone',
  // ssh2 trae módulos nativos opcionales que no se empaquetan; react-pdf se ejecuta tal cual en el servidor
  serverExternalPackages: ['pg', 'ssh2', '@react-pdf/renderer', 'sharp'],
  // el logo de la marca (1 MB) y los documentos para el asistente de presupuestos (20 MB) viajan en formularios
  experimental: { serverActions: { bodySizeLimit: '25mb' } },
}

export default nextConfig
