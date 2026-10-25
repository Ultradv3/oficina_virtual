# Sistema de diseño de Agent Office

Referencia de tokens, tipografía, color, movimiento y accesibilidad de la interfaz. Toda la UI
consume estos valores desde `:root` en `app/assets/css/main.css`; no se permiten colores,
duraciones o radios literales en componentes nuevos salvo geometría propia de la escena 3D.

## Tipografía

- **UI**: `Inter Variable` (WOFF2 self-hosted en `public/fonts/InterVariable.woff2`, OFL-1.1),
  precargada y con `font-display: swap`.
- **Código**: `JetBrains Mono Variable` (`public/fonts/JetBrainsMonoVariable.woff2`, OFL-1.1).
- **Escala**: `--text-2xs` 11 px, `--text-xs` 12 px, `--text-sm` 13 px, `--text-base` 14 px,
  `--text-md` 16 px, `--text-lg` 20 px, `--text-xl` 28 px, `--text-2xl` 40 px.
- **Regla**: los badges y etiquetas de estado no bajan de 11 px; las métricas usan
  `font-variant-numeric: tabular-nums`.

## Color y contraste

Paleta oscura existente, con dos correcciones para cumplir AA (≥4.5:1 en texto ≤14 px):

| Token | Valor | Contraste sobre `--panel` |
| --- | --- | --- |
| `--muted-2` | `#8492a6` | 5.99:1 (antes `#667386`, 3.93:1) |
| estado `disconnected` | `#7d8a9c` | 5.40:1 (antes `#64748b`, 3.98:1) |

El resto de tonos (`--muted`, `--success`, `--warn`, `--danger`, estados de trabajo) ya superan
4.5:1. El estado nunca se comunica solo con color: siempre icono/forma + color + etiqueta.

## Espaciado y radios

- `--space-1..6` = 4, 8, 12, 16, 24, 32 px.
- `--radius-sm` 8 px, `--radius-md` 10 px, `--radius-lg` 14 px, `--radius-pill`.

## Movimiento

- `--ease-out: cubic-bezier(.23, 1, .32, 1)`, `--ease-in-out`, `--ease-drawer`.
- `--dur-fast` 120 ms, `--dur-base` 180 ms, `--dur-slow` 250 ms.
- Las microinteracciones de UI no superan 250 ms y no bloquean la interacción.
- La entrada de escena es la única excepción: dolly de 600–900 ms.
- Con `prefers-reduced-motion: reduce` no hay dolly, escalonado ni animaciones no esenciales; la
  cámara aparece directamente encuadrada y las transiciones se reducen a 0.01 ms.

## Accesibilidad

- `:focus-visible` global con `--focus-ring` (2 px) y `--focus-offset` (2 px).
- Diálogos y cajón atrapan el foco, cierran con Escape y devuelven el foco al disparador.
- Controles de icono con `aria-label`; retratos con texto alternativo no vacío; toasts con
  `aria-live="polite"`.
- Objetivos de verificación: 1024x768 y 1280x800 sin recortes; 390x844 sin scroll horizontal;
  zoom 200 % con controles esenciales alcanzables.

## Escena

- `three` se importa de `three/webgpu`; un único camino de código para WebGPU y el fallback WebGL2.
- DPR máximo 1.75; bloom a media resolución como mejora, con apagado automático si no se sostienen
  55 fps durante 2 s a 1024x768 con 3 agentes (la capa emisiva/sprites mantiene el resplandor).
- Etiquetas y pantallas a 2x (1280x320 y 1280x800), texturas reconstruidas solo por cambio de
  nombre/estado.
- Materiales compartidos por caché con variantes de desgaste acotadas (0–2) y ruido de rugosidad
  común.

### Composición de escritorios y paredes

- Superficie de mesa en `y = 0.89` (local al escritorio). Los props que apoyan en ella se calculan
  con `seatOnDesk(height)` de `app/utils/desk-layout.ts`; tolerancia de contacto ±0.005.
- El agente se sienta/coloca del lado del teclado (`z > 0`), frente a la cámara (grupo del escritorio girado `π`), con la
  silla centrada bajo él y el asiento mirando al escritorio. La pantalla mira hacia `+z`, de modo que
  agente y cámara comparten su cara frontal.
- El retrato del agente se hornea con giro neutro y se centra por la caja envolvente de la minifig,
  independiente del giro de la escena.
- La etiqueta va sobre el escritorio (`y = 2.32`) y el anillo de selección (1.78–1.95) cubre mesa,
  agente y silla.
- Pared trasera: cara interior `z = -5.78`; los accesorios se montan en `z = -5.66` y las molduras
  quedan detrás (`frente ≤ -5.74`). Huecos: ventana `x = -1.30` (4.50), reloj `x = 1.95` (1.32),
  rótulo `x = 5.10` (4.50), mosaico `x = -5.60` (3.50), con separación ≥0.12 y margen ≥0.15.
- Pared izquierda: pizarra y puerta en `x = -8.70`; el reloj y la pizarra conservan su contenido
  real (hora y tareas) sin cambios de datos.
- Cámara de órbita libre: `SceneCameraControls` habilita rotación, paneo y zoom con límites de
  elevación; el botón **Restablecer** vuelve a `[14, 14, 14]`, target `[0, 1, 0]` y zoom inicial.
- Iluminación por hora: `SceneLighting` recibe `timeOfDay` (0–24) y calcula sol, luna, ambiente,
  hemisférica, fill y rim; el reloj de pared usa la misma hora. El control de escena permite fijar
  una hora o volver a la real.
- Entorno exterior: `OfficeSurroundings` añade acera, terraza, escalones, barandilla, farolas,
  macetas y silueta de ciudad; las farolas/ventanas se encienden al anochecer.

