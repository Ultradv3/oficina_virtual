# Implementation Plan: Mejoras premium de UI/UX y escena

**Branch**: `001-premium-ui-scene` | **Date**: 2026-10-24 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-premium-ui-scene/spec.md`

**Note**: Este plan se genera con `/speckit-plan`; las tareas se derivarán con `/speckit-tasks`.

## Summary

Elevar la percepción visual y la legibilidad de Agent Office sin cambiar su base funcional:
mismos datos, mismos flujos y misma identidad LEGO isométrica. La entrega se divide en cuatro
historias independientes (P1 fundamentos y panel; P2 estados vacío/carga/error; P3 escena como
*product shot*; P4 identidad, storytelling y móvil).

Enfoque técnico investigado en [research.md](./research.md):

- Sistema de tokens y tipografía de marca vendorizada (Inter Variable y JetBrains Mono Variable,
  OFL 1.1, precargadas) con corrección de contraste (`--muted-2` y estado `disconnected`).
- HUD y panel con métricas visibles a 1024x768, conexión como fuente única, iconos de estado,
  pestañas con indicador animado y foco visible global.
- Escena con encuadre ortográfico automático y margen de HUD, entrada *dolly* de 600–900 ms,
  suelo/horizonte con rejilla y viñeta, bloom selectivo con `RenderPipeline` + `bloom` de TSL
  (three r186), etiquetas y pantallas a 2x, y microvariación de materiales acotada por caché.
- Identidad con retratos reales del minifig (RenderTarget + lectura asíncrona, con respaldo SVG),
  reloj real, pizarra/kanban con tareas reales, iluminación reactiva, sonido opcional apagado por
  defecto y cajón del panel en móvil.
- Sin dependencias nuevas y sin tocar `server/`, adaptadores, API, SSE ni SQLite.

## Technical Context

**Language/Version**: TypeScript 5.9 en modo `strict`; Node.js ≥ 22; Nuxt 4.6 (compatibility date
2026-10-24); Vue 3.5.

**Primary Dependencies**: existentes `@tresjs/core` 5.10.0, `@tresjs/cientos` 5.10.0,
`@tresjs/nuxt` 5.8.0, `three` 0.186.1 (`three/webgpu` + TSL) y `better-sqlite3` (sin cambios). No
se prevén dependencias nuevas: las fuentes se vendorizan como assets y la interacción/audio se
implementan con APIs del navegador.

**Storage**: ninguna almacenamiento nuevo. La UI sigue leyendo SQLite a través de la API
existente; solo se usa `sessionStorage` para recordar la preferencia de sonido.

**Testing**: no existe suite automatizada. Puertas: `npm run typecheck` (verde el 2026-10-24) y
`npm run build`; en el entorno DSH con sandbox el build de Nitro falla con `spawn EPERM` por la
restricción de tuberías del sandbox, así que debe validarse en una terminal sin sandbox/CI (no es
un fallo del código). La verificación funcional es el protocolo manual de
[quickstart.md](./quickstart.md).

**Target Platform**: navegadores de escritorio modernos con WebGPU y fallback automático a WebGL2;
1024x768 y 1280x800 como referencia de escritorio; 390x844 para móvil. El despliegue Node/Docker
no cambia.

**Project Type**: aplicación web única: frontend Nuxt en `app/`, backend Nitro en `server/`.
Esta funcionalidad es solo cliente (`app/`, `public/fonts`, `docs/DESIGN.md`, `nuxt.config.ts`).

**Performance Goals**: 60 fps en GPU integrada con 3+ agentes; DPR ≤ 1.75; microinteracciones
≤ 250 ms; entrada de escena 600–900 ms; bloom a media resolución.

**Constraints**: sin cambios en lógica de negocio, adaptadores, API, SSE ni persistencia; identidad
LEGO isométrica y tema oscuro; UI en español (es-ES); contraste AA; movimiento reducido; fuentes
OFL self-hosted.

**Scale/Scope**: escena + 6 vistas (agente, actividad, aprobaciones, auditoría, sesión, composer);
0–10+ agentes; un operador por sesión; 4 historias P1–P4.

## Constitution Check

*GATE: debe pasar antes de la Fase 0; re-evaluado después del diseño de la Fase 1.*

| Principio / restricción | Cómo lo cumple el plan | Estado |
| --- | --- | --- |
| I. Integración real, sin datos simulados | Todo se deriva de `OfficeState`/`AgentDetail`/`TaskDetail` y de identidad determinista; los estados vacíos son honestos; no hay seeds ni mocks. | PASA |
| II. Núcleo estable, adaptadores como frontera | El diff se limita a `app/`, `public/fonts/`, `docs/DESIGN.md`, `nuxt.config.ts` y `specs/`; `server/` y adaptadores no se tocan. | PASA |
| III. Seguridad y control humano | No hay acciones privilegiadas nuevas; auth/rate limit/auditoría intactos; el sonido exige gesto explícito; no se exponen secretos. | PASA |
| IV. Una sola fuente de verdad observable | Se consume el estado y el SSE existentes; se elimina la duplicación del estado de conexión; la pizarra es proyección de solo lectura de tareas reales; no se crean copias divergentes. | PASA |
| V. Presupuesto de rendimiento y accesibilidad | DPR ≤ 1.75, bloom a media resolución como mejora (la capa emisiva/sprites mantiene FR-020 si se apaga), caché de materiales acotada, `prefers-reduced-motion` en CSS y escena, foco visible, AA y etiquetas ≥ 11 px; verificación explícita de fallback WebGL2 y DPR. | PASA con medición obligatoria (V5/V6 de quickstart) |
| Restricciones de stack | Sin dependencias nuevas; fuentes vendorizadas con licencia; TypeScript `strict`; un solo nodo. | PASA |
| Puertas de calidad | `npm run typecheck` verde; `npm run build` a validar fuera del sandbox (EPERM del entorno); protocolo manual; Docker no se modifica. | PASA condicionado a la validación de build |

**Re-evaluación tras Fase 1**: el diseño no añade entidades persistidas ni contratos de API
nuevos; se mantienen las mismas puertas y no aparecen violaciones. La única complejidad relevante
es el pipeline de posprocesado, justificado por FR-020 y mitigado con apagado automático.

## Project Structure

### Documentation (this feature)

```text
specs/001-premium-ui-scene/
├── plan.md                 # este archivo
├── spec.md                 # especificación funcional
├── research.md             # decisiones técnicas (Fase 0)
├── data-model.md           # entidades de UI y reglas (Fase 1)
├── quickstart.md           # protocolo de validación (Fase 1)
├── contracts/
│   └── ui-contract.md      # contrato de UI (tokens, estados, escena, datos)
├── checklists/
│   └── requirements.md     # calidad de la especificación
└── tasks.md                # se crea después con /speckit-tasks
```

### Source Code (repository root)

```text
app/
├── assets/css/main.css            # tokens + estilos (se amplía y ajusta)
├── components/
│   ├── OfficeScene.client.vue     # cámara, encuadre, escena, posprocesado
│   ├── OfficeDesk.vue             # etiqueta/pantalla 2x, minifig, flags de bloom
│   ├── AgentPanel.vue             # pestañas/indicador y cajón móvil
│   ├── AgentDetailPanel.vue       # retrato, sin duplicar conexión
│   ├── AgentCardList.vue          # retrato, sin lista de conexiones duplicada
│   ├── StageState.vue             # (nuevo) vacío/carga/error de la escena
│   ├── PanelState.vue             # (nuevo) vacío/carga/error del panel
│   ├── AgentAvatar.vue            # (nuevo) retrato con respaldo accesible
│   ├── AppIcon.vue                # (nuevo) iconos de estado
│   ├── SoundToggle.vue            # (nuevo) sonido opcional apagado por defecto
│   ├── lego/                      # piezas y entorno (sin cambio de contrato)
│   └── scene/
│       └── ScenePostProcessing.client.vue  # (nuevo) RenderPipeline + bloom
├── composables/
│   ├── useOffice.ts               # se conserva su contrato
│   ├── useMotionPreference.ts     # (nuevo) preferencia del sistema
│   ├── useFocusTrap.ts            # (nuevo) foco en diálogos/cajón
│   ├── useAgentPortraits.ts       # (nuevo) snapshots y caché
│   └── useSoundscape.ts           # (nuevo) audio procedural opcional
├── utils/
│   ├── scene-framing.ts           # (nuevo) cálculo puro de encuadre
│   ├── status.ts                  # + icono/aria-label; tokens corregidos
│   ├── lego-materials.ts          # variantes de desgaste acotadas
│   └── lego.ts                    # identidad del minifig (se reutiliza)
├── pages/index.vue                # HUD, estados y mobile
└── types/office.ts                # sin cambios de contrato de API

docs/DESIGN.md                     # (nuevo) sistema de diseño documentado
public/fonts/                      # (nuevo) WOFF2 variables + OFL.txt
nuxt.config.ts                     # preload de fuentes e idioma
server/                            # SIN CAMBIOS
```

**Structure Decision**: proyecto único Nuxt con cliente en `app/` y Nitro en `server/`. La
funcionalidad es exclusivamente de presentación: no se añaden rutas, endpoints, tablas ni
adaptadores. Los únicos artefactos fuera de `app/` son assets de fuentes, la documentación de
diseño y el precargado en `nuxt.config.ts`.

## Phase 0: Research

Decisiones resueltas en [research.md](./research.md), sin `NEEDS CLARIFICATION`:

1. **Tipografía**: WOFF2 variables vendorizados + `@font-face` + precarga + respaldo ajustado.
2. **Tokens y contraste**: escala, espaciado, radios, easings y duraciones; `--muted-2` a
   `#8492a6` (5.99:1) y `disconnected` a `#7d8a9c` (5.40:1).
3. **Movimiento**: tokens + `matchMedia` reactivo; escena salta al estado final con movimiento
   reducido.
4. **Bloom**: `RenderPipeline` (r186; `PostProcessing` deprecado), MRT `emissive`, `bloom` de
   `three/addons/tsl/display/BloomNode.js`, media resolución y sustitución de la función de render
   vía `useLoop().render()`.
5. **Cámara**: utilidad pura de encuadre ortográfico con zona segura de HUD y dolly de entrada
   cancelable.
6. **Etiquetas/pantallas**: canvas a 2x, anisotropía 8, reconstrucción por clave.
7. **Materiales**: variantes de desgaste cuantizadas + textura de ruido compartida.
8. **Avatares**: snapshot del minifig clonado en RenderTarget 128x128 con lectura asíncrona,
   caché y respaldo SVG.
9. **Accesibilidad**: foco visible, trampa de foco, indicador de pestañas medido, iconos de estado.
10. **Sonido**: WebAudio procedural tras gesto, apagado por defecto, `sessionStorage`.
11. **Verificación**: typecheck/build + protocolo manual; sin suite nueva en esta feature.

## Phase 1: Design

- **Entidades de UI y reglas**: [data-model.md](./data-model.md) (tokens, identidad visual,
  presentación de estado, estados de vista, encuadre, preferencias y pizarra).
- **Contrato de UI**: [contracts/ui-contract.md](./contracts/ui-contract.md) (tokens, estado,
  estados de vista, props de escena, preferencias, accesibilidad y límites de datos).
- **Validación**: [quickstart.md](./quickstart.md) (V1–V9, evidencia y solución de problemas).
- **Contratos externos**: sin cambios. La API existente se consume tal cual; no se generan
  contratos HTTP nuevos porque la funcionalidad no modifica el backend.

## Implementation Slices

| Slice | Historias | Entregable |
| --- | --- | --- |
| 1. Fundamentos y panel | US1 (P1) | Tokens, fuentes, contraste, HUD, pestañas, botones, badges, timestamps, iconos y foco. |
| 2. Estados | US2 (P2) | `StageState`/`PanelState`, esqueletos, error con reintento y conexión única. |
| 3. Escena | US3 (P3) | Encuadre, entrada, suelo/viñeta, bloom, etiquetas 2x y materiales. |
| 4. Identidad y móvil | US4 (P4) | Retratos, reloj, pizarra real, luz reactiva, escalonado, sonido y cajón. |

Orden recomendado: 1 → 2 → 3 → 4. La escena (3) depende de los tokens y del encuadre; el bloom es
independiente y puede apagarse sin bloquear el resto.

## Riesgos y mitigaciones

| Riesgo | Impacto | Mitigación |
| --- | --- | --- |
| Build bloqueado por `spawn EPERM` del sandbox | No se puede cerrar la puerta de build en DSH | Ejecutar `npm run build` en terminal sin sandbox/CI y registrar el resultado; typecheck ya es verde. |
| Coste de bloom en GPU integrada | Caída por debajo de 60 fps | Bloom a media resolución, DPR ≤ 1.75; apagado automático si se miden menos de 55 fps sostenidos durante 2 s a 1024x768 con 3 agentes; la capa emisiva/sprites mantiene FR-020. |
| Sustitución del render de TresJS | Escena en negro o doble render | `useLoop().render()` + `pipeline.render()` y restauración de `renderer.render` al desmontar; probar resize, SSE, desmontaje y fallback WebGL2 forzado. |
| Licencia/CLS de fuentes | Bloqueo legal o salto visual | Vendorizar con `OFL.txt`, precargar, pila de respaldo ajustada y verificación con caché vacía. |
| Lectura de retratos en WebGPU | Avatar vacío o error de contexto | Lectura asíncrona con caché y respaldo SVG con `alt`; nunca bloquear el panel. |
| Animación de cámara contra OrbitControls | Salto o conflicto de zoom | Desactivar controles durante la entrada, cancelar al interactuar y limitar el zoom al rango existente. |
| Sin suite automatizada | Regresiones visuales | Protocolo manual reproducible + utilidades puras aisladas; la suite se planificará aparte. |

## Complexity Tracking

Sin violaciones constitucionales que justificar. La única complejidad técnica añadida es el
pipeline de posprocesado (FR-020), que se ejecuta a media resolución y tiene una ruta de apagado;
la alternativa WebGL (`EffectComposer`/`UnrealBloomPass`) se descartó por incompatibilidad con
`WebGPURenderer`.
