# Data Model: Corrección de escritorios y accesorios de pared

**Feature**: `002-desk-wall-corrections` · **Fecha**: 2026-10-24 · **Plan**: [plan.md](./plan.md)

Esta funcionalidad no persiste datos ni cambia entidades de negocio. El modelo describe la
composición geométrica de la escena y sus invariantes verificables; no hay API ni base de datos
nuevas.

## Entidades

### DeskComposition

- **Qué representa**: el puesto completo de un agente y su transformación en la escena.
- **Campos**: `agentId`, `index`, `origin` (posición en la retícula), `surfaceY` (mundo ≈0.89),
  `footprint` (`width` 2.55, `depth` 1.18), `parts`, `labelAnchor`, `selectionRing`.
- **Reglas**: un `DeskComposition` por agente; el origen se mantiene en la retícula existente; la
  huella no invade la de otro escritorio ni las paredes; el conjunto conserva el volumen clicable
  para la selección.

### DeskPart

- **Qué representa**: cada pieza del puesto (mesa, silla, minifigura, monitor, teclado, lámpara,
  taza, papeles).
- **Campos**: `id`, `type`, `anchor` (posición local), `size`, `rotation`, `support` (`desk` |
  `floor`), `contactTolerance` (0.005), `halfExtents`.
- **Reglas**:
  - `support: desk` → la base de la pieza queda a ±0.005 de `surfaceY`.
  - `support: floor` → la base queda a ±0.005 del suelo/alfombra.
  - Las cajas de dos piezas no se interpenetran visiblemente (separación ≥0 en el plano, con la
    tolerancia de contacto).
  - La minifigura no atraviesa mesa, silla ni props; el anillo no queda por debajo de un prop.

### AgentSeat

- **Qué representa**: la relación del agente con su monitor y teclado.
- **Campos**: `agentAnchor`, `facing` (dirección de mirada), `monitorNormal`, `keyboardAnchor`.
- **Reglas**: `facing` mira hacia el monitor; el teclado queda entre el agente y el monitor; el
  agente no se solapa con la silla; la pantalla del monitor queda del mismo lado que el agente.

### WallAccessory

- **Qué representa**: un elemento montado en una pared.
- **Campos**: `id`, `wall` (`back` | `left` | `right`), `center`, `size`, `mountDepth`,
  `contentRef` (reloj/pizarra/rótulo/ventana/mosaico/puerta), `slotId`.
- **Reglas**:
  - La parte trasera queda en el plano de montaje común de su pared.
  - La caja completa queda dentro de los límites de la pared con margen ≥0.15.
  - No se solapa con otro accesorio de la misma pared (separación ≥0.12).
  - El contenido sigue siendo real: hora local, tareas reales o texto del rótulo.
  - Ningún pilar, moldura, etiqueta o escritorio lo tapa en los encuadres de referencia.

### WallSlot

- **Qué representa**: el hueco reservado para un accesorio en una pared.
- **Campos**: `id`, `wall`, `xRange`, `yRange`, `margin`, `accessoryId`.
- **Reglas**: un accesorio por hueco; los rangos no se solapan; el hueco respeta el zócalo y el
  remate superior; la suma de huecos deja una separación mínima entre accesorios.

### LabelAnchor

- **Qué representa**: el anclaje de la etiqueta flotante de nombre/estado del agente.
- **Campos**: `deskId`, `position`, `scale`, `renderOrder`, `depthTest` (false), `bounds`.
- **Reglas**: dentro del escenario en los viewports objetivo; no tapa la pantalla del monitor ni el
  mobiliario de otro escritorio; no se recorta en 1024x768; legible a 1280x800.

### SelectionRing

- **Qué representa**: el resaltado de selección/hover del escritorio.
- **Campos**: `deskId`, `innerRadius`, `outerRadius`, `y`, `opacity`, `renderOrder`.
- **Reglas**: rodea mesa, agente y silla; visible por encima del suelo y por debajo de los props; no
  queda oculto por paredes ni por otro escritorio; respeta el estado de hover/selección.

### SceneViewport

- **Qué representa**: las condiciones de visualización que deben validarse.
- **Campos**: `width`, `height`, `agentCount` (1/2/3+/10), `selectedId`, `hovered`, `reducedMotion`,
  `graphicsMode` (normal/compatibilidad), `glow` (on/off).
- **Reglas**: las correcciones se mantienen en todos los valores; no se permiten recortes ni
  solapamientos nuevos; 60 fps en el caso de 3+ agentes.

## Invariantes de validación

1. **Apoyo**: `|base(part) − supportY| ≤ 0.005` para cada `DeskPart`.
2. **No solapamiento de escritorio**: las huellas de dos `DeskComposition` no se cruzan; los props no
   invaden la huella vecina.
3. **Coherencia de asiento**: `dot(facing, monitorNormal) > 0` y `keyboard` entre agente y monitor.
4. **Pared**: cada `WallAccessory` está dentro de su `WallSlot`; los slots no se solapan; la
   separación entre accesorios es ≥0.12.
5. **Contenido real**: reloj = hora local; pizarra = tareas reales; rótulo = texto actual.
6. **Legibilidad**: etiqueta dentro del escenario y sin recortes en los viewports objetivo.
7. **Selección**: anillo visible y no ocluido en los estados de selección/hover.
8. **Rendimiento**: 60 fps con 3+ agentes; sin trabajo por frame dependiente de props.

## Relaciones

```text
Agent 1 ──── 1 DeskComposition
DeskComposition 1 ── N DeskPart
DeskComposition 1 ── 1 AgentSeat
DeskComposition 1 ── 1 LabelAnchor
DeskComposition 1 ── 1 SelectionRing

Wall 1 ── N WallSlot
WallSlot 1 ── 1 WallAccessory

SceneViewport ── valida ──► DeskComposition / WallAccessory
```

## Transiciones de estado

- **Selección**: `idle → selected` al hacer clic en un escritorio; el anillo se activa y la etiqueta
  sigue visible; `selected → idle` al deseleccionar.
- **Hover**: `idle → hover` al entrar en un escritorio; el resaltado no debe tapar props.
- **Estado del agente**: `available` / `working` / `waiting_approval` / `error` / `disconnected`
  cambia color/animación; las correcciones no pueden ocultar la señal.
- **Densidad**: `agentCount` cambia la retícula; las invariantes se mantienen de 1 a 10+.
- **Viewport**: cambios de tamaño/cámara no alteran las posiciones locales, solo el encuadre.

## Lo que NO cambia

- No hay tablas, columnas, endpoints ni eventos nuevos.
- No se persisten posiciones ni preferencias de layout.
- No se añaden datos de prueba ni estados simulados.
