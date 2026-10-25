# UI Contract: Mejoras premium de UI/UX y escena

**Feature**: `001-premium-ui-scene` · **Fecha**: 2026-10-24 · **Plan**: [plan.md](./plan.md)

Contrato de las interfaces de presentación de la funcionalidad. No hay contratos de API nuevos:
la API, los adaptadores y la base de datos no cambian (FR-034). Este contrato es la referencia
para `/speckit-tasks` y `/speckit-implement`.

**Glosario**: «avatar» es la identidad en la UI, «retrato» el asset renderizado del minifig,
«minifigura» el modelo 3D y «cajón» el panel móvil. Los nombres de componentes
(`AgentAvatar`) conservan su forma técnica.

## 1. Contrato de tokens de diseño

Todo componente consume tokens; no se permiten valores mágicos de color, duración o radio fuera
del sistema documentado en `docs/DESIGN.md`.

| Categoría | Tokens obligatorios |
| --- | --- |
| Tipografía | `--font-sans`, `--font-mono`, `--text-2xs` (11 px), `--text-xs` (12 px), `--text-sm` (13 px), `--text-base` (14 px), `--text-md` (16 px), `--text-lg`, `--text-xl`, `--text-2xl` |
| Espaciado | `--space-1` … `--space-6` = 4/8/12/16/24/32 px |
| Radio | `--radius-sm` 8 px, `--radius-md` 10 px, `--radius-lg` 14 px, `--radius-pill` |
| Movimiento | `--ease-out` (cubic-bezier(.23,1,.32,1)), `--ease-in-out`, `--ease-drawer`, `--dur-fast` 120 ms, `--dur-base` 180 ms, `--dur-slow` 250 ms |
| Foco | `--focus-ring` (2 px, color `--accent`), `--focus-offset` 2 px |
| Color | Paleta actual + correcciones: `--muted-2: #8492a6` (5.99:1), estado `disconnected: #7d8a9c` (5.40:1) |

**Criterio de cumplimiento**: un test visual/UX revisa que ningún componente nuevo declare
colores, duraciones o radios literales fuera de `:root`; las excepciones deben ser geométricas de
escena 3D y justificarse en el código.

## 2. Contrato de estado

`STATUS_META` es la única fuente de presentación de estado. Se amplía con `icon` y `ariaLabel`;
el resto de la UI no duplica etiquetas ni colores.

| Estado | Etiqueta | Tono | Icono | aria-label |
| --- | --- | --- | --- | --- |
| `available` | Disponible | `#4ade80` | check | «Disponible, sin trabajo activo» |
| `working` | Trabajando | `#60a5fa` | activity | «Trabajando en una tarea» |
| `waiting_approval` | Espera aprobación | `#fbbf24` | hand | «Esperando aprobación humana» |
| `error` | Error | `#f87171` | alert | «Error en la última tarea» |
| `disconnected` | Desconectado | `#7d8a9c` | plug-off | «Sin conexión con el adaptador» |

Reglas: icono + color + etiqueta siempre visibles; contraste AA; badges de 11 px mínimo; el texto
de estado es español; las etiquetas 3D y los badges de panel muestran el mismo estado.

## 3. Contrato de estados de vista

Cada vista DEBE cubrir los tres estados además de `ready`. No se permite un spinner aislado ni un
mensaje sin acción.

| Vista | Vacío | Carga | Error |
| --- | --- | --- | --- |
| Escena (`stage`) | Diálogo de oficina vacía + comando de arranque + botón de conexión | Esqueleto del diorama/HUD, sin salto al terminar | Causa + reintento + acceso al estado de conexión |
| Lista de agentes | «Todavía no hay agentes disponibles» + conexión | Esqueleto de filas | Causa + reintento |
| Detalle de agente | «Selecciona un agente para ver su estado» | Esqueleto del detalle | Causa del fallo de detalle + reintento |
| Actividad | «Sin actividad todavía» | Esqueleto de líneas | Causa del stream + reintento de conexión |
| Aprobaciones | «No hay solicitudes pendientes» | Esqueleto de tarjetas | Causa + reintento |
| Auditoría | «Sin acciones registradas» | Esqueleto de filas | Causa + reintento |
| Sesión de tarea | «El historial remoto aún no tiene mensajes» | Esqueleto del historial | Historial no disponible con reintento |

Reglas: el vacío nunca inventa datos; el error nunca oculta la causa; el reintento muestra
progreso y no permite dobles envíos; el texto es español (es-ES) y el contenido del proveedor se
distingue visualmente del texto propio.

Entre 641 y 980 px el panel permanece apilado bajo la escena (comportamiento actual); el cajón
superpuesto se activa a ≤640 px.

## 4. Contrato de componentes de escena

```text
<OfficeScene
  :agents="OfficeAgent[]"        // datos reales de OfficeState
  :tasks="TaskSummary[]"         // proyección de tareas para la pizarra
  :selected-id="string | null"
  @select="(agentId: string) => void"
/>

<AgentDesk
  :agent="OfficeAgent"
  :index="number"
  :selected="boolean"
  :position="[number, number, number]"
  @select="(agentId: string) => void"
/>

<AgentAvatar
  :agent-id="string"
  :name="string"
  :portrait-url="string | null"
  :alt="string"
/>
```

Reglas:

- La escena no consulta la API ni muta estado de negocio; solo recibe props y emite `select`.
- `tasks` es la única fuente de la pizarra (máximo 6 tareas, las más recientes); si está vacío, la
  pizarra muestra su estado vacío.
- `AgentAvatar` usa el retrato cacheado; sin retrato cae al retrato de respaldo con `alt` no vacío.
- El componente de posprocesado es interno de la escena; si el pipeline falla o se miden menos de
  55 fps sostenidos durante 2 s a 1024x768 con 3 agentes, la escena sigue renderizando sin bloom
  (la capa emisiva/sprites mantiene FR-020) y el HUD no se bloquea.

## 5. Contrato de preferencias

| Preferencia | Origen | Por defecto | Persistencia | UI |
| --- | --- | --- | --- | --- |
| Movimiento reducido | Sistema operativo | `false` | — (se lee en vivo) | Sin control propio; se aplica solo |
| Sonido ambiental | Operador | Desactivado | `sessionStorage['agent-office-sound']` | Botón con `aria-pressed` en la barra superior |

Reglas: el sonido solo arranca tras un gesto explícito; al desactivarlo se detiene y se recuerda
la elección durante la sesión; con movimiento reducido no hay dolly, escalonado ni animaciones no
esenciales.

## 6. Contrato de accesibilidad

- Todos los controles interactivos muestran `:focus-visible` con `--focus-ring`.
- Diálogos, cajón móvil y composer atrapan el foco, cierran con Escape y devuelven el foco al
  disparador.
- Los toasts usan `aria-live="polite"`; los cambios de estado críticos no dependen solo del color.
- Todo control de icono tiene `aria-label`; las imágenes/retratos tienen texto alternativo.
- La UI funciona con teclado y a 200 % de zoom sin perder controles esenciales.
- Contraste mínimo 4.5:1 en textos ≤ 14 px (tokens corregidos y revisión de nuevos estilos).

## 7. Contrato de datos y límites

- La UI consume exclusivamente los endpoints existentes (`/api/state`, `/api/agents/:id`,
  `/api/tasks/:id`, `/api/events`, `/api/audit`) y sus tipos de `app/types/office.ts`.
- No se añaden endpoints, columnas, tablas ni eventos; las acciones existentes (crear, cancelar,
  aprobar, reconectar) no cambian de contrato.
- `server/`, los adaptadores y la base SQLite quedan fuera del diff de esta funcionalidad.
- El contenido mostrado se rastrea a `OfficeState`/`AgentDetail`/`TaskDetail` o a funciones
  deterministas de identidad; no hay datos simulados.
