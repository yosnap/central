import { prisma } from '@/lib/prisma'
import { removeLogo, saveBrand } from '@/lib/brand-actions'
import { ActionForm, Card, ConfirmAction, Field, Input, SubmitButton, Textarea } from '@/components/ui'
import { DEFAULT_PRICING_GUIDE } from '@/lib/quote-ai'
import { LogoPicker } from './logo-picker'

/** Datos fiscales y de marca que salen en cada presupuesto y en su PDF. */
export async function BrandCard() {
  const b = await prisma.brandSettings.findUnique({ where: { id: 'default' }, omit: { logoData: true } })
  const hasLogo = !!b?.logoType
  const v = (k: keyof NonNullable<typeof b>) => (b?.[k] == null ? '' : String(b[k]))
  return (
    <Card title="Marca para presupuestos" className="xl:col-span-2" note="Sale en la cabecera y el pie de cada presupuesto y de su PDF."
      action={hasLogo && <ConfirmAction action={removeLogo} title="Quitar el logo" description="Los presupuestos y el PDF saldrán sin logo hasta que subas otro." confirmLabel="Quitar logo" success="Logo quitado">Quitar logo</ConfirmAction>}>
      <ActionForm action={saveBrand} success="Marca guardada" className="grid gap-4 md:grid-cols-2">
        <div className="md:col-span-2"><LogoPicker hasLogo={hasLogo} version={String(b?.logoType ? Date.now() : 0)} /></div>
        <Field label="Color principal" htmlFor="b-c1" hint="Títulos, tablas y esquinas del PDF y el Word. Se sacan del logo al subirlo.">
          <Input id="b-c1" name="primaryColor" type="color" defaultValue={b?.primaryColor ?? '#1d4ed8'} className="h-12 w-28 cursor-pointer p-1" />
        </Field>
        <Field label="Color secundario" htmlFor="b-c2" hint="Detalles: caja del cliente, viñetas y esquina interior.">
          <Input id="b-c2" name="secondaryColor" type="color" defaultValue={b?.secondaryColor ?? '#0f1b2d'} className="h-12 w-28 cursor-pointer p-1" />
        </Field>
        <Field label="Nombre comercial" htmlFor="b-name"><Input id="b-name" name="businessName" defaultValue={b?.businessName ?? 'iServisat'} required /></Field>
        <Field label="Titular (persona o razón social)" htmlFor="b-owner"><Input id="b-owner" name="ownerName" defaultValue={v('ownerName')} /></Field>
        <Field label="NIF / CIF" htmlFor="b-tax"><Input id="b-tax" name="taxId" defaultValue={v('taxId')} /></Field>
        <Field label="IVA por defecto (%)" htmlFor="b-vat"><Input id="b-vat" name="defaultVat" inputMode="decimal" defaultValue={b ? v('defaultVat') : '21'} required /></Field>
        <Field label="Correo" htmlFor="b-email"><Input id="b-email" name="email" type="email" defaultValue={v('email')} /></Field>
        <Field label="Teléfono" htmlFor="b-phone"><Input id="b-phone" name="phone" defaultValue={v('phone')} /></Field>
        <Field label="Web" htmlFor="b-web"><Input id="b-web" name="website" defaultValue={v('website')} placeholder="iservisat.com" /></Field>
        <Field label="IBAN (para el pago)" htmlFor="b-iban"><Input id="b-iban" name="iban" defaultValue={v('iban')} placeholder="ES00 0000 0000 0000 0000 0000" /></Field>
        <Field label="Dirección" htmlFor="b-address" className="md:col-span-2"><Textarea id="b-address" name="address" rows={2} defaultValue={v('address')} /></Field>
        <Field label="Pie de los presupuestos" htmlFor="b-footer" className="md:col-span-2" hint="Condiciones, forma de pago, protección de datos…"><Textarea id="b-footer" name="quoteFooter" rows={3} defaultValue={v('quoteFooter')} /></Field>
        <Field label="Criterios de precio para el asistente" htmlFor="b-pricing" className="md:col-span-2"
          hint="Cómo cobras y referencias de precios anteriores. El asistente de presupuestos los sigue al proponer; además ve tus últimos presupuestos de Central.">
          <Textarea id="b-pricing" name="pricingGuide" rows={10} defaultValue={b?.pricingGuide ?? DEFAULT_PRICING_GUIDE} />
        </Field>
        <SubmitButton className="justify-self-start">Guardar marca</SubmitButton>
      </ActionForm>
    </Card>
  )
}
