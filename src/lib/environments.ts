export const ENVIRONMENTS = [
  { value: 'production', label: 'Producción' },
  { value: 'staging', label: 'Pruebas' },
  { value: 'development', label: 'Local' },
]

export const envLabel = (v: string) => ENVIRONMENTS.find((e) => e.value === v)?.label ?? v
