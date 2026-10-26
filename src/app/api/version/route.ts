import { NextResponse } from 'next/server'
import pkg from '../../../../package.json'

// Versión desplegada de Central. Pública: solo devuelve el número de versión.
export function GET() {
  return NextResponse.json({ version: pkg.version })
}
