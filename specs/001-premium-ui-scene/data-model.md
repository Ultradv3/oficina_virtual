# Data Model: Mejoras premium de UI/UX y escena

**Feature**: `001-premium-ui-scene` · **Fecha**: 2026-10-24 · **Plan**: [plan.md](./plan.md)

Esta funcionalidad es de presentación: **no cambia el esquema de SQLite, los adaptadores ni la
API**. Las entidades de abajo son estructuras de UI derivadas de datos existentes y de tokens de
diseño; no se persisten salvo la preferencia de sonido en `sessionStorage`.

## Fuentes de datos existentes (sin cambios)

| Fuente | Tipo actual | Uso en la feature |
| --- | --- | --- |
| `OfficeState` | `app/types/office.ts` | agentes, conexiones, tareas, aprobaciones, eventos, contadores |
| `AgentDetail` | `app/types/office.ts` | detalle, sesiones, eventos y aprobaciones de un agente |
| `TaskDetail` | `app/types/office.ts` | sesión remota, mensajes e historial |
| `AuditEntry` | `app/types/office.ts` | auditoría |
| `STATUS_META` | `app/utils/status.ts` | etiqueta, color, descripción por estado (se amplía con icono) |

## Entidades

### DesignToken

- **Qué representa**: un valor visual reutilizable y documentado.
- **Campos**: `name` (p. ej. `--space-3`), `category` (`color` | `type` | `space` | `radius` |
  `ease` | `duration`), `value`, `usage`, `contrast` (solo color: ratio y fondo de referencia).
- **Reglas**: solo existen tokens documentados en `docs/DESIGN.md`; los colores de texto deben
  superar 4.5:1; las duraciones no superan 250 ms salvo la entrada de escena.
- **Relaciones**: consumido por todos los componentes; es el contrato de coherencia visual.

### FontAsset

- **Qué representa**: un archivo de tipografía de marca listo para precargar.
- **Campos**: `family`, `file` (`/fonts/...woff2`), `weightRange`, `style`, `license` (`OFL-1.1`),
  `preload`, `fallbackStack`.
- **Reglas**: licencia OFL verificada y `OFL.txt` incluido; `preload` solo para el peso que se usa
  en el primer render; la pila de respaldo ajusta métricas para evitar CLS.

### AgentVisualIdentity

- **Qué representa**: la identidad visual de un agente, derivada de su nombre y estado.
- **Campos**: `agentId`, `name`, `torsoColor`, `hairColor`, `variant` (0–3), `statusTone`,
  `portrait` (`snapshot` | `fallback`), `portraitUrl`, `altText`, `identityKey` (name + variant).
- **Reglas**: determinista a partir del nombre (mismas funciones que el minifig); el retrato se
  cachea por `agentId` + `identityKey`; si el snapshot falla se usa el retrato de respaldo y
  siempre existe `altText`; nunca se muestran iniciales como identidad principal.
- **Relaciones**: 1:1 con `OfficeAgent`.

### StatusPresentation

- **Qué representa**: la presentación única de un estado operativo.
- **Campos**: `status` (`available` | `working` | `waiting_approval` | `error` |
  `disconnected`), `label`, `toneColor`, `softColor`, `icon`, `description`, `ariaLabel`.
- **Reglas**: icono + color + etiqueta siempre juntos; el color nunca es el único canal; etiqueta
  en español; contraste ≥ 4.5:1 en textos pequeños (se corrigen `muted-2` y `disconnected`).
- **Relaciones**: referenciado por badges de agente, lista, detalle y etiquetas 3D.

### ViewState

- **Qué representa**: el estado de una vista concreta y su salida.
- **Campos**: `viewId` (`stage` | `agentList` | `agentDetail` | `activity` | `approvals` |
  `audit` | `taskSession`), `state` (`loading` | `empty` | `error` | `ready`),
  `title`, `message`, `cause`, `action` (`label`, `kind`), `retryable`.
- **Reglas**: todas las vistas principales definen `loading`, `empty` y `error`; el vacío nunca
  inventa datos; el error incluye causa y reintento; el reintento muestra progreso y evita dobles
  envíos; los textos propios son español (es-ES).
- **Transiciones**:
  `loading → ready | empty | error`, `error → loading` (reintento),
  `empty → loading` (reconexión), `ready → error` (fallo de lectura), `ready → ready` (SSE).

### SceneFraming

- **Qué representa**: el encuadre calculado de la escena para un viewport y número de agentes.
- **Campos**: `viewport` (`width`, `height`), `safeArea` (`top`, `bottom`, `left`, `right`),
  `agentCount`, `occupancy` (`minX`, `maxX`, `minZ`, `maxZ`), `dioramaBounds`, `target`
  (`halfWidth`, `halfHeight`, `zoom`, `targetX`, `targetZ`), `entrance` (`fromZoom`, `toZoom`,
  `durationMs`, `state`: `idle` | `entering` | `settled`).
- **Reglas**: sin recortes para 1, 2, 3+ y 10 agentes; margen reservado para el HUD; zoom dentro
  de los límites del control de órbita; entrada de 600–900 ms o instantánea con movimiento
  reducido; la interacción del operador cancela la entrada.
- **Relaciones**: derivado de `OfficeAgent[]` + tamaño del lienzo + zona segura del HUD.

### MotionPreference

- **Qué representa**: la preferencia de movimiento del sistema.
- **Campos**: `reduceMotion` (boolean), `source` (`system`).
- **Reglas**: reactiva a cambios del sistema; con `true`, no hay dolly, escalonado ni
  animaciones no esenciales; las transiciones de UI se reducen a 0.01 ms.

### SoundPreference

- **Qué representa**: preferencia de sonido ambiental de la sesión.
- **Campos**: `enabled` (boolean, por defecto `false`), `storageKey`
  (`agent-office-sound`), `startedByGesture` (boolean).
- **Reglas**: desactivado por defecto; solo se activa tras un gesto explícito; recuerda la
  preferencia durante la sesión; nunca se reproduce automáticamente.

### TaskBoardItem

- **Qué representa**: una tarea o sesión proyectada en la pizarra/kanban de la escena.
- **Campos**: `taskId`, `title`, `status`, `agentId`, `agentName`, `updatedAt`.
- **Reglas**: proyección de solo lectura de tareas reales; máximo 6 tareas visibles (las más
  recientes); cuando no hay tareas la pizarra muestra su estado vacío (sin contenido inventado).
- **Relaciones**: N tareas → 1 agente; se deriva de `OfficeState.tasks`.

## Diagrama de relaciones

```text
OfficeAgent 1 ──── 1 AgentVisualIdentity
     │
     ├── 1 ──── N TaskBoardItem (proyección de OfficeState.tasks)
     └── N ──── 1 StatusPresentation (por estado)

Viewport + SafeArea + OfficeAgent[] ───► SceneFraming
SystemPreferences ───► MotionPreference
SessionStorage ──────► SoundPreference
DesignToken[] ───────► CSS (main.css) + docs/DESIGN.md
```

## Reglas de validación transversales

- **Datos reales**: ningún campo de estas entidades se rellena con valores simulados; todo
  proviene de `OfficeState`/`AgentDetail` o de funciones deterministas de identidad.
- **Accesibilidad**: ningún color es el único canal de estado; foco visible; foco atrapado en
  diálogos y cajón; contraste AA; badges ≥ 11 px.
- **Rendimiento**: los retratos se cachean; las texturas 2x solo se reconstruyen cuando cambia la
  clave de nombre/estado; el número de materiales de ladrillo queda acotado por la caché.
- **Sin persistencia nueva**: no se añaden tablas, columnas ni endpoints.
