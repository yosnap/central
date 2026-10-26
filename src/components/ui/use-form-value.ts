'use client'

import { useCallback, useRef, useState } from 'react'

/**
 * Valor de un control propio que viaja en un formulario mediante un input oculto.
 * - Si el servidor devuelve otro `defaultValue` (tras guardar), lo adopta.
 * - En el reset del formulario vuelve al `defaultValue` más reciente. Se aplica en un microtask
 *   para quedar por encima de Radix, que restaura el valor del primer montaje.
 */
export function useFormValue(defaultValue: string) {
  const [value, setValue] = useState(defaultValue)
  const [prevDefault, setPrevDefault] = useState(defaultValue)
  if (prevDefault !== defaultValue) {
    setPrevDefault(defaultValue)
    setValue(defaultValue)
  }
  const latest = useRef(defaultValue)
  latest.current = defaultValue
  const el = useRef<HTMLInputElement | null>(null)
  const ref = useCallback((node: HTMLInputElement | null) => {
    el.current = node
    const form = node?.form
    if (!form) return
    const onReset = () => queueMicrotask(() => setValue(latest.current))
    form.addEventListener('reset', onReset)
    return () => form.removeEventListener('reset', onReset)
  }, [])
  return { value, setValue, ref, input: () => el.current }
}
