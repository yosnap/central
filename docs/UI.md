# Interfaz de Central

Central se usa en pantallas grandes y durante muchas horas: espacio de trabajo amplio, letra grande, alto contraste y controles modernos. Toda pantalla se construye con los componentes de `src/components/ui/` (importados desde `@/components/ui`). El catálogo vivo está en `/componentes`.

## Fundamentos

- **Escala**: la base es de 18 px (`html { font-size: 112.5% }` en `src/app/globals.css`), así que todo lo que usa `rem` crece a la vez. El texto corriente va en `text-base`; `text-sm` solo para ayudas y metadatos. No usar `text-xs`.
- **Espacio**: el contenido ocupa el ancho de la ventana hasta 2000 px, con barra lateral fija de 18 rem en escritorio. Las rejillas suben de columnas en `xl` y `2xl`.
- **Color**: paleta azul con tokens en `@theme` (`accent`, `accent-strong`, `accent-soft`, `on-accent`, `ok`, `warn`, `bad` y sus fondos `*-soft`, `ink`, `muted`, `line`, `panel`, `ground`) y modo oscuro automático. No escribir colores sueltos; usar los tokens.
- **Controles**: altura mínima de 48 px (`h-12`), esquinas `rounded-xl`, foco visible con anillo azul.
- **Avisos**: se distinguen por fondo, icono y borde completo. Nunca una franja lateral (`border-l-4` o similar).
- **Iconos**: `lucide-react`. Sin emoticonos en la interfaz.

## Qué componente usar

| Necesidad | Componente | En lugar de |
| --- | --- | --- |
| Formulario de Server Action | `ActionForm` + `SubmitButton` | `<form action>` con `<button>` |
| Confirmar el resultado | toast automático de `ActionForm` (`success="…"`) o `toast` | `alert()` |
| Acción destructiva | `ConfirmAction` (modal) | `confirm()` |
| Lista cerrada de opciones | `Select` (+ `toOptions(LABELS)`) | `<select>` |
| Lista larga o texto libre con sugerencias | `Combobox` (`allowCustom` para texto libre) | `<datalist>`, `<select>` largos |
| Sí/no dentro de un formulario | `Checkbox` | `<input type="checkbox">` |
| Activar/desactivar una opción | `Switch` | `<input type="checkbox">` |
| Ventana encima de la página | `Modal` | `window.open`, páginas sueltas |
| Acciones secundarias de un elemento | `Menu` + `MenuItem` | botones sueltos en fila |
| Ayuda breve | `Tooltip` | atributo `title` |
| Aviso en la página | `Notice` | párrafos con colores |
| Etiqueta de estado | `Pill` | spans con clases |
| Campo con etiqueta | `Field` + `Input` / `Textarea` | `<label>` + `<input>` a mano |
| Cambiar un dato suelto de una ficha | `InlineField` (lápiz, Guardar/Cancelar, Esc; la acción recibe `fields` y `value`) | formularios enteros para editar un campo |
| Lista vacía | `Empty` | párrafos «Sin datos» |
| Estructura | `PageTitle`, `Card`, `Stat`, `Table`, `Button`, `ButtonLink` | |

Prohibido en `src/app`: `<select>`, `<datalist>`, casillas nativas, `alert()`, `confirm()` y `prompt()`.

## Cómo funcionan con las Server Actions

- Una acción puede devolver `{ error: 'texto' }` para que el toast diga qué falla (en producción Next oculta el mensaje de lo que se lanza).

- `Select` y `Combobox` llevan un input oculto con el `name`, así que el `FormData` y la validación con Zod no cambian. Admiten `required` y vuelven a su valor inicial cuando el formulario se resetea.
- `Checkbox` y `Switch` envían su `value` (por defecto `"true"`) solo si están marcados, igual que la casilla nativa.
- `ActionForm` muestra un toast de éxito con `success` y uno de error genérico si la acción falla; deja pasar las redirecciones de Next.
- Los filtros de listados usan `next/form` con `Select submitOnChange` para aplicar el filtro al elegir.

## Librerías

Radix UI (select, checkbox, switch, dialog, dropdown-menu, popover, tooltip), `cmdk` para el combobox, `sonner` para los toasts y `lucide-react` para los iconos. El estilo es propio, con Tailwind 4.
