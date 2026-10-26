export type Option = { value: string; label: string; hint?: string }

/** Atajo para pasar de un mapa de etiquetas (`KIND_LABEL`…) a opciones de `Select` o `Combobox`. */
export const toOptions = (labels: Record<string, string>): Option[] => Object.entries(labels).map(([value, label]) => ({ value, label }))
