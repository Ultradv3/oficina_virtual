# Implementation Plan: Corrección de escritorios de agentes y accesorios de pared

**Branch**: `002-desk-wall-corrections` | **Date**: 2026-10-24 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-desk-wall-corrections/spec.md`

## Summary

Corregir la composición física y visual de los escritorios de agente y de los accesorios de pared
sin cambiar datos, flujos ni la identidad LEGO isométrica. La auditoría del código confirma tres
defectos concretos: el reloj de pared invade el rótulo y los pilares de la pared tapan parte del
rótulo/mosaico; la minifigura y la silla están al otro lado del monitor respecto al teclado, con la
pantalla orientada hacia el operador y no hacia el agente; y varios props del escritorio no apoyan
de forma consistente sobre la mesa.

El enfoque técnico es: centralizar las medidas de escritorio y pared en utilidades de layout,
recomponer el puesto (agente y silla al lado del teclado, frente al monitor), asentar cada prop sobre
la superficie real, anclar etiqueta y anillo sin recortes, y montar los accesorios de pared en un
plano común delante de los pilares con huecos reservados para reloj, rótulo, ventana, pizarra,
mosaico y puerta. La validación es visual reproducible (capturas 1280x800, 1024x768 y 390x844) más
las puertas `typecheck` y `build`; no se añaden dependencias.

## Technical Context

**Language/Version**: TypeScript 5.9 en modo `strict`; Node.js ≥22; Nuxt 4.6; Vue 3.5.

**Primary Dependencies**: existentes `@tresjs/core` 5.10.0, `@tresjs/cientos` 5.10.0, `three`
0.186.1 (`three/webgpu`). Sin dependencias nuevas.

**Storage**: N/A. La funcionalidad es puramente de presentación; no toca SQLite ni `sessionStorage`.

**Testing**: no existe suite automatizada. Verificación con `npm run typecheck`, `npm run build` y el
protocolo visual de [quickstart.md](./quickstart.md) mediante capturas y una sesión de navegador
instrumentada (Edge/CDP ya usada en la feature anterior).

**Target Platform**: navegadores de escritorio con WebGPU y fallback WebGL2; 1024x768 y 1280x800
como referencia; 390x844 para móvil.

**Project Type**: aplicación web única (Nuxt + Nitro); esta funcionalidad es solo cliente.

**Performance Goals**: 60 fps en equipo de gama media con 3+ agentes; DPR ≤1.75; sin trabajo nuevo
por frame (geometría estática y materiales compartidos).

**Constraints**: sin cambios en `server/`, API, adaptadores, SSE ni persistencia; preservar identidad
LEGO, tema oscuro y comportamiento de estados; sin dependencias nuevas ni assets externos.

**Scale/Scope**: 1–10+ escritorios, 2 paredes visibles (trasera e izquierda), 6 accesorios de pared y
2 viewports de referencia; alcance limitado a `OfficeDesk.vue`, `OfficeScene.client.vue` y utilidades
de layout.

## Constitution Check

*GATE: debe pasar antes de la Fase 0; se re-evalúa después del diseño de la Fase 1.*

| Principio / restricción | Cómo lo cumple el plan | Estado |
| --- | --- | --- |
| I. Integración real, sin datos simulados | Solo se mueve geometría; reloj y pizarra siguen leyendo hora y tareas reales; no hay datos de demostración. | PASA |
| II. Núcleo estable, adaptadores como frontera | El diff se limita a `app/` y documentación; `server/`, adaptadores y API no se tocan. | PASA |
| III. Seguridad y control humano | No hay acciones ni permisos nuevos; no se exponen secretos ni se ejecuta nada desde el navegador. | PASA |
| IV. Una sola fuente de verdad observable | No se duplica estado; se reutilizan los datos y eventos existentes; solo cambia la presentación. | PASA |
| V. Presupuesto de rendimiento y accesibilidad | Geometría estática, materiales compartidos, 60 fps y DPR ≤1.75; se conservan foco, reduced motion y contraste ya existentes. | PASA con medición (V6 de quickstart) |
| Restricciones de stack | Sin dependencias nuevas; TypeScript strict; un solo nodo. | PASA |
| Puertas de calidad | `typecheck` y `build` verdes; protocolo visual; Docker no se modifica. | PASA |

**Re-evaluación tras Fase 1**: el diseño no añade persistencia, endpoints ni dependencias; las
correcciones son geometría y constantes de layout. Se mantienen las mismas puertas y no aparecen
violaciones. La complejidad añadida (utilidades de layout) está justificada para que las medidas no
vuelvan a dispersarse.

## Project Structure

### Documentation (this feature)

```text
specs/002-desk-wall-corrections/
├── plan.md                 # este archivo
├── spec.md                 # especificación funcional
├── research.md             # decisiones geométricas y de composición
├── data-model.md           # entidades de layout y sus invariantes
├── quickstart.md           # validación visual reproducible
├── contracts/
│   └── scene-layout-contract.md
├── checklists/
│   └── requirements.md
└── tasks.md                # se crea con /speckit-tasks
```

### Source Code (repository root)

```text
app/
├── components/
│   ├── OfficeDesk.vue              # composición del puesto de trabajo
│   └── OfficeScene.client.vue      # paredes y accesorios
├── utils/
│   ├── desk-layout.ts              # (nuevo) medidas y anclajes del escritorio
│   └── wall-layout.ts              # (nuevo) plano de montaje y huecos de pared
└── assets/css/main.css             # sin cambios funcionales; solo estilos si hiciera falta

docs/DESIGN.md                      # añadir sección de composición de escena
specs/002-desk-wall-corrections/    # artefactos de la feature
server/                             # SIN CAMBIOS
```

**Structure Decision**: proyecto único Nuxt; la corrección se implementa en los dos componentes de
escena existentes más dos utilidades de layout. No se añaden rutas, endpoints, tablas ni
adaptadores. Las utilidades permiten que las medidas (altura de mesa, huella, plano de pared, huecos)
tengan una única fuente y se puedan revisar sin duplicar números.

## Phase 0: Research

Decisiones resueltas en [research.md](./research.md), sin `NEEDS CLARIFICATION`:

1. **Recomposición del escritorio**: mover agente y silla al lado del teclado (+z), girar al agente
   tres cuartos (`-3π/4`) hacia el monitor y mantener la pantalla orientada a +z, de modo que agente
   y cámara compartan el lado frontal de la pantalla (composición sobre el hombro) y se conserve el
   perfil del minifig. Alternativas descartadas: girar el monitor 180° (el operador perdería la
   pantalla) y dejar el agente detrás (relación física incoherente).
2. **Asiento de props**: derivar la altura de la superficie de la mesa (mundo ≈0.89) y recolocar
   teclado, lámpara, taza, papeles y base del monitor con una tolerancia de contacto de ±0.005.
3. **Etiqueta y anillo**: mantener la etiqueta sobre el escritorio, comprobar límites frente a
   monitor/otros escritorios y ampliar el anillo para cubrir también la silla y al agente sin quedar
   oculto por props.
4. **Plano de montaje de pared**: unificar la profundidad de montaje delante de los pilares
   (`z ≈ -5.66`), retrasar molduras y pilares por detrás (`frente ≤ -5.74`) y reservar huecos
   horizontales con margen; mover el reloj a un hueco libre entre ventana y rótulo.
5. **Contenido**: conservar texturas y lógica de reloj/pizarra/rótulo; no se regeneran contenidos ni
   se añaden datos.
6. **Rendimiento**: cambios estáticos de posición y tamaño; sin nuevas texturas por frame ni
   materiales por escritorio; se mantiene la caché compartida.
7. **Validación**: capturas a 1280x800, 1024x768 y 390x844 con 1/2/3+/10 agentes, más `typecheck` y
   `build`; sin framework de tests nuevo.

## Phase 1: Design

- **Entidades e invariantes**: [data-model.md](./data-model.md) define `DeskComposition`,
  `DeskPart`, `WallAccessory`, `WallSlot`, `LabelAnchor`, `SelectionRing` y `SceneViewport`, con sus
  reglas de apoyo, separación y visibilidad.
- **Contrato de layout**: [contracts/scene-layout-contract.md](./contracts/scene-layout-contract.md)
  fija las props públicas de `OfficeDesk`/`OfficeScene`, la convención de planos de pared, los huecos
  reservados y los invariantes verificables de composición.
- **Validación**: [quickstart.md](./quickstart.md) con V1–V7 (escritorios, paredes, densidades,
  interacción, contenido, rendimiento y regresión).
- **Contratos externos**: no aplica; no hay API ni interfaces de sistema nuevas.

## Implementation Slices

| Slice | Historia | Entregable |
| --- | --- | --- |
| 1. Medidas y escritorio | US1 (P1) | `desk-layout.ts`, recomposición agente/silla/monitor/teclado, asiento de props, etiqueta y anillo. |
| 2. Paredes | US2 (P2) | `wall-layout.ts`, plano de montaje, huecos y recolocación de reloj/rótulo/mosaico/ventana/pizarra/puerta. |
| 3. Estabilidad | US3 (P3) | Verificación y ajustes con 1/2/3+/10 agentes, viewports, selección, zoom y estados. |

Orden: 1 → 2 → 3. La pared depende de que el escritorio tenga una huella estable; la validación de
densidades cierra ambas.

## Riesgos y mitigaciones

| Riesgo | Impacto | Mitigación |
| --- | --- | --- |
| El agente de espaldas a cámara pierde expresividad | Menos atractivo visual | Composición sobre el hombro con giro parcial y encuadre que conserve la pantalla visible. |
| Los pilares siguen tapando accesorios | Defecto visible | Plano de montaje común por delante del pilar y validación de capturas en varios ángulos. |
| Solapamiento de etiquetas con 10 agentes | Etiquetas ilegibles | Anclaje y tamaño revisados; comprobación visual en densidad máxima. |
| Cambios de posición rompen la selección raycast | Interacción | Mantener el volumen clicable del escritorio y el anillo; probar selección con clics reales. |
| Sin suite visual automatizada | Regresiones estéticas | Protocolo reproducible de capturas y revisión heurística; `typecheck` y `build` como puertas. |
| El reloj/pizarra pierden contenido real | Incumple datos reales | No tocar las texturas ni su lógica de actualización; verificar hora y tareas en runtime. |

## Complexity Tracking

Sin violaciones constitucionales. La única complejidad añadida son dos módulos de constantes de
layout (`desk-layout`, `wall-layout`), que reducen el riesgo de volver a dispersar medidas y no
introducen dependencias ni trabajo por frame.
