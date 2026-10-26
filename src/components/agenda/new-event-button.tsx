'use client'

import { Plus } from 'lucide-react'
import { createCalendarEvent } from '@/lib/agenda-actions'
import { ActionForm, Button, Checkbox, Combobox, Field, Input, Modal, ModalClose, Select, SubmitButton, Textarea, type Option } from '@/components/ui'

/** Evento nuevo en uno de los calendarios elegidos, ligado si quieres a un cliente o proyecto. */
export function NewEventButton({ calendars, targets, today, target }: { calendars: Option[]; targets: Option[]; today: string; target?: string }) {
  return (
    <Modal title="Nuevo evento" description="Se crea en Google Calendar. Sin hora, es de día completo; sin hora de fin, dura una hora." size="lg"
      trigger={<Button disabled={!calendars.length}><Plus className="size-5" aria-hidden />Nuevo evento</Button>}>
      <ActionForm action={createCalendarEvent} success="Evento creado" className="grid gap-4 md:grid-cols-2">
        <Field label="Título" htmlFor="ne-title" className="md:col-span-2"><Input id="ne-title" name="summary" placeholder="Reunión de arranque con…" required autoFocus /></Field>
        <Field label="Calendario"><Select name="calendar" aria-label="Calendario" defaultValue={calendars[0]?.value} options={calendars} /></Field>
        <Field label="Cliente o proyecto"><Combobox name="target" aria-label="Cliente o proyecto" defaultValue={target ?? ''} allowCustom={false} placeholder="Sin ligar" searchPlaceholder="Buscar cliente o proyecto…" options={targets} /></Field>
        <Field label="Día" htmlFor="ne-date"><Input id="ne-date" name="date" type="date" defaultValue={today} required /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Desde" htmlFor="ne-from"><Input id="ne-from" name="from" type="time" /></Field>
          <Field label="Hasta" htmlFor="ne-to"><Input id="ne-to" name="to" type="time" /></Field>
        </div>
        <Checkbox name="allDay" label="Todo el día" className="md:col-span-2" />
        <Field label="Lugar o enlace" htmlFor="ne-loc" className="md:col-span-2"><Input id="ne-loc" name="location" placeholder="Oficina, Google Meet…" /></Field>
        <Field label="Notas" htmlFor="ne-desc" className="md:col-span-2"><Textarea id="ne-desc" name="description" rows={3} /></Field>
        <div className="flex justify-end gap-3 md:col-span-2">
          <ModalClose asChild><Button type="button" variant="ghost">Cancelar</Button></ModalClose>
          <SubmitButton pendingText="Creando…">Crear evento</SubmitButton>
        </div>
      </ActionForm>
    </Modal>
  )
}
