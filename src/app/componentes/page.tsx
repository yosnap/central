import { Plus } from 'lucide-react'
import { requireSession } from '@/lib/session'
import {
  ActionForm, Button, Card, InlineField, Checkbox, Combobox, ConfirmAction, Empty, Field, Input, Modal, ModalClose, Notice, PageTitle, Pill, Select, Stat, SubmitButton, Switch, Table, Textarea,
} from '@/components/ui'
import { MenuDemo, ToastDemo } from './interactive-demo'

export const dynamic = 'force-dynamic'

async function demoAction() {
  'use server'
  await requireSession()
  await new Promise((r) => setTimeout(r, 700))
}

const OPTIONS = [{ value: 'production', label: 'Producción' }, { value: 'staging', label: 'Pruebas' }, { value: 'development', label: 'Desarrollo', hint: 'Solo en local' }]

export default async function ComponentsPage() {
  await requireSession()
  return (
    <>
      <PageTitle title="Componentes" sub="Catálogo de la interfaz de Central. Toda pantalla nueva se construye con estas piezas." />
      <div className="grid gap-6 xl:grid-cols-2">
        <Card title="Botones" note="Primario para la acción principal, secundario para el resto y peligro para lo que borra.">
          <div className="flex flex-wrap items-center gap-3">
            <Button>Primario</Button>
            <Button variant="secondary">Secundario</Button>
            <Button variant="ghost">Discreto</Button>
            <Button variant="danger">Peligro</Button>
            <Button variant="danger-ghost">Quitar</Button>
            <Button disabled>Desactivado</Button>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button size="sm">Pequeño</Button>
            <Button>Mediano</Button>
            <Button size="lg"><Plus className="size-5" aria-hidden />Grande</Button>
          </div>
        </Card>

        <Card title="Avisos (toast)" note="Confirman lo que acaba de pasar sin interrumpir. Los formularios con ActionForm los lanzan solos.">
          <ToastDemo />
        </Card>

        <Card title="Campos de formulario" className="xl:col-span-2">
          <ActionForm action={demoAction} success="Formulario de prueba enviado" className="grid gap-5 md:grid-cols-2 2xl:grid-cols-3">
            <Field label="Texto" htmlFor="demo-text" hint="Con ayuda debajo del campo."><Input id="demo-text" name="text" placeholder="Escribe algo" /></Field>
            <Field label="Select" htmlFor="demo-select"><Select id="demo-select" name="env" defaultValue="production" options={OPTIONS} /></Field>
            <Field label="Combobox con buscador" htmlFor="demo-combo" hint="Elige de la lista o escribe uno nuevo."><Combobox id="demo-combo" name="hosting" allowCustom options={['Easypanel · Hetzner', 'Vercel', 'Netlify', 'Google Cloud', 'Supabase']} /></Field>
            <Field label="Área de texto" htmlFor="demo-area" className="md:col-span-2"><Textarea id="demo-area" name="notes" placeholder="Notas largas…" /></Field>
            <div className="flex flex-col gap-4">
              <Checkbox name="a" defaultChecked label="Casilla marcada" description="Con texto de apoyo." />
              <Checkbox name="b" label="Casilla sin marcar" />
              <Switch name="c" defaultChecked label="Interruptor" description="Para activar o desactivar algo." />
            </div>
            <div className="md:col-span-2 2xl:col-span-3"><SubmitButton pendingText="Enviando…">Enviar de prueba</SubmitButton></div>
          </ActionForm>
        </Card>

        <Card title="Modales" note="Para confirmar acciones o editar sin salir de la página. Nunca alert() ni confirm().">
          <div className="flex flex-wrap gap-3">
            <Modal
              title="Editar servicio"
              description="Ejemplo de modal con formulario."
              trigger={<Button variant="secondary">Abrir modal</Button>}
              footer={<><ModalClose asChild><Button variant="secondary">Cancelar</Button></ModalClose><ModalClose asChild><Button>Guardar</Button></ModalClose></>}
            >
              <div className="flex flex-col gap-4">
                <Field label="Nombre" htmlFor="m-name"><Input id="m-name" defaultValue="web" /></Field>
                <Field label="Entorno" htmlFor="m-env"><Select id="m-env" defaultValue="staging" options={OPTIONS} /></Field>
              </div>
            </Modal>
            <ConfirmAction action={demoAction} title="Quitar este elemento" description="Es solo una prueba: no se borra nada." confirmLabel="Quitar" success="Elemento quitado" variant="danger" size="md">Confirmar borrado</ConfirmAction>
          </div>
        </Card>

        <Card title="Menú y ayudas" note="Menú desplegable de acciones y tooltip accesible con teclado.">
          <MenuDemo />
        </Card>

        <Card title="Avisos en bloque" className="xl:col-span-2">
          <div className="grid gap-4 lg:grid-cols-2">
            <Notice tone="info" title="Información">Se distinguen por fondo, icono y borde completo.</Notice>
            <Notice tone="ok" title="Todo correcto">La sincronización terminó sin errores.</Notice>
            <Notice tone="warn" title="Falta información">Este proyecto no tiene hosting.</Notice>
            <Notice tone="bad" title="Error">No se pudo conectar con sn4p.dev.</Notice>
          </div>
        </Card>

        <Card title="Etiquetas y cifras">
          <div className="mb-5 flex flex-wrap gap-2">
            <Pill tone="ok">Activo</Pill><Pill tone="accent">Mantenimiento</Pill><Pill tone="warn">Dormido</Pill><Pill tone="bad">Caída</Pill><Pill>Archivado</Pill>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Stat label="Proyectos activos" value={34} />
            <Stat label="Webs caídas" value={0} tone="ok" />
          </div>
        </Card>

        <Card title="Edición en el sitio" note="Para cambiar un dato suelto de una ficha sin abrir un formulario: lápiz, Guardar o Cancelar (Esc).">
          <div className="grid gap-5 md:grid-cols-2">
            <InlineField action={demoAction} label="Nombre" value="Easypanel iServisat" />
            <InlineField action={demoAction} label="Entorno" value="production" kind="select" options={OPTIONS} />
          </div>
        </Card>

        <Card title="Tabla y estado vacío">
          <Table head={['Proyecto', 'Estado', 'Versión']}>
            <tr><td className="font-semibold">Central</td><td><Pill tone="ok">Activo</Pill></td><td className="num">0.3.0</td></tr>
            <tr><td className="font-semibold">sn4p.dev</td><td><Pill tone="accent">Mantenimiento</Pill></td><td className="num">2.1.4</td></tr>
          </Table>
          <div className="mt-5"><Empty title="Sin resultados">Así se ve una lista vacía.</Empty></div>
        </Card>
      </div>
    </>
  )
}
