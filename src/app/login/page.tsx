import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { SESSION_COOKIE, checkPassword, signSession } from '@/lib/auth'
import { Field, Input, Notice, SubmitButton } from '@/components/ui'

async function login(form: FormData) {
  'use server'
  const pw = String(form.get('password') ?? '')
  if (!checkPassword(pw)) redirect('/login?error=1')
  const c = await cookies()
  c.set(SESSION_COOKIE, signSession(), { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 30 * 86400 })
  redirect('/')
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams
  return (
    <div className="grid min-h-[80vh] place-items-center">
      <form action={login} className="flex w-full max-w-md flex-col gap-6 rounded-3xl border border-line bg-panel p-10 shadow-sm">
        <div className="flex items-center gap-4">
          <span className="grid size-14 place-items-center rounded-2xl bg-accent text-2xl font-bold text-on-accent">C</span>
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Central</h1>
            <p className="text-base text-muted">Entra con tu contraseña</p>
          </div>
        </div>
        <Field label="Contraseña" htmlFor="password">
          <Input id="password" name="password" type="password" autoFocus required autoComplete="current-password" />
        </Field>
        {error && <Notice tone="bad" title="Contraseña incorrecta" />}
        <SubmitButton size="lg" pendingText="Entrando…">Entrar</SubmitButton>
      </form>
    </div>
  )
}
