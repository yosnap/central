'use client'

import {
  DndContext, DragOverlay, KeyboardSensor, PointerSensor, closestCenter, defaultDropAnimationSideEffects, useSensor, useSensors,
  type DragEndEvent, type DragStartEvent, type DropAnimation,
} from '@dnd-kit/core'
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { cn, toast } from '@/components/ui'

type Item = { id: string; label: string; node: ReactNode }

// la copia que se arrastra aterriza en su hueco nuevo; mientras, el hueco se ve atenuado
const drop: DropAnimation = { duration: 200, easing: 'ease-out', sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: '0.35' } } }) }

/**
 * Lista que se ordena arrastrando el asa (o con espacio y flechas sobre ella) y guarda el orden al soltar.
 * Se arrastra una copia flotante (DragOverlay) y el sitio de la tarjeta queda marcado donde va a caer, así al soltar
 * se queda ahí sin volver atrás. Solo el asa arranca el arrastre: los campos de dentro siguen funcionando.
 */
export function SortableList({ items, onReorder }: { items: Item[]; onReorder: (ids: string[]) => Promise<{ error?: string } | void> }) {
  const sig = items.map((i) => i.id).join(',')
  const [state, setState] = useState({ sig, order: items.map((i) => i.id) })
  // si el servidor manda otra lista (servicio nuevo o quitado), se parte de ella
  if (state.sig !== sig) setState({ sig, order: items.map((i) => i.id) })
  const order = state.sig === sig ? state.order : items.map((i) => i.id)
  const [activeId, setActiveId] = useState<string | null>(null)
  const byId = new Map(items.map((i) => [i.id, i]))
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const onDragStart = ({ active }: DragStartEvent) => setActiveId(String(active.id))
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    setActiveId(null)
    if (!over || active.id === over.id) return
    const next = arrayMove(order, order.indexOf(String(active.id)), order.indexOf(String(over.id)))
    setState({ sig, order: next })
    void onReorder(next)
      .catch((e: Error) => ({ error: e.message }))
      .then((r) => { if (r && 'error' in r && r.error) { toast.error(r.error); setState({ sig, order: items.map((i) => i.id) }) } })
  }

  const active = activeId ? byId.get(activeId) : null
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setActiveId(null)}>
      <SortableContext items={order} strategy={verticalListSortingStrategy}>
        <div className="flex flex-col gap-6">
          {order.map((id) => {
            const item = byId.get(id)
            return item ? <Row key={id} item={item} /> : null
          })}
        </div>
      </SortableContext>
      <DragOverlay dropAnimation={drop}>
        {active && (
          <div className="pointer-events-none flex cursor-grabbing items-start gap-2">
            <span className="mt-5 shrink-0 rounded-lg p-1 text-ink"><GripVertical className="size-5" aria-hidden /></span>
            <div className="min-w-0 flex-1 rounded-2xl bg-panel shadow-xl ring-1 ring-accent/30">{active.node}</div>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}

function Row({ item }: { item: Item }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: item.id })
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn('flex items-start gap-2', isDragging && 'opacity-35')}
    >
      <button
        ref={setActivatorNodeRef}
        type="button"
        {...attributes}
        {...listeners}
        aria-label={`Mover ${item.label}`}
        title="Arrastra para ordenar"
        className="mt-5 shrink-0 cursor-grab touch-none rounded-lg p-1 text-muted hover:bg-ground hover:text-ink active:cursor-grabbing"
      >
        <GripVertical className="size-5" aria-hidden />
      </button>
      <div className="min-w-0 flex-1 rounded-2xl bg-panel">{item.node}</div>
    </div>
  )
}
