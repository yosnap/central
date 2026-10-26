import { Plus, Sparkles } from 'lucide-react'
import { addSuggestedDomain } from '@/lib/project-actions'
import { ActionForm, SubmitButton } from '@/components/ui'

/** Dominios leídos de la configuración del proyecto que aún no son servicios. Nada se guarda sin confirmar. */
export function SuggestedDomains({ projectId, domains, existingUrls }: { projectId: string; domains: string[]; existingUrls: string[] }) {
  const known = new Set(existingUrls.map((u) => { try { return new URL(u).hostname } catch { return u } }))
  const pending = domains.filter((d) => !known.has(d))
  if (!pending.length) return null
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-accent/30 bg-accent-soft px-5 py-4">
      <Sparkles className="size-5 text-accent-strong" aria-hidden />
      <span className="font-medium text-accent-strong">Dominios detectados en la configuración:</span>
      {pending.map((d) => (
        <ActionForm key={d} action={addSuggestedDomain} success={`${d} añadido como servicio`}>
          <input type="hidden" name="id" value={projectId} />
          <input type="hidden" name="domain" value={d} />
          <SubmitButton variant="secondary" size="sm"><Plus className="size-4" aria-hidden />{d}</SubmitButton>
        </ActionForm>
      ))}
    </div>
  )
}
