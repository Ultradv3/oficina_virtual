---
description: "Task list for feature 001-premium-ui-scene"
---

# Tasks: Mejoras premium de UI/UX y escena

**Input**: Design documents from `/specs/001-premium-ui-scene/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/ui-contract.md](./contracts/ui-contract.md),
[quickstart.md](./quickstart.md)

**Tests**: no se generan tareas de test automatizado porque la especificación no los solicita y el
proyecto no tiene suite. La verificación es manual y reproducible mediante
[quickstart.md](./quickstart.md) (V1–V9).

**Organization**: tareas agrupadas por historia de usuario para implementar y validar cada una de
forma independiente.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: puede ejecutarse en paralelo (archivos distintos, sin dependencia de tareas incompletas)
- **[Story]**: `[US1]`…`[US4]` en las fases de historia; sin etiqueta en setup, foundational y polish
- Cada descripción incluye la ruta exacta del archivo a tocar

## Path Conventions

Proyecto único Nuxt: cliente en `app/`, assets públicos en `public/`, documentación en `docs/`,
especificaciones en `specs/001-premium-ui-scene/`. `server/` no se modifica en esta funcionalidad.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: preparar assets y evidencia base antes de implementar.

- [ ] T001 Capturar evidencia base de la UI actual a 1280x800, 1024x768 y 390x844 en
  `verify-before-1280.png`, `verify-before-1024.png` y `verify-before-390.png` siguiendo
  `specs/001-premium-ui-scene/quickstart.md`
- [ ] T002 Vendorizar las fuentes variables en `public/fonts/` (`InterVariable.woff2`,
  `JetBrainsMonoVariable.woff2`) con sus `OFL.txt`; verificar duplicar la licencia OFL-1.1 antes de
  añadir los archivos y no modificar `package.json`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: infraestructura de presentación que comparten todas las historias.

**⚠️ CRITICAL**: ninguna historia puede empezar hasta completar esta fase.

- [ ] T003 Implementar el sistema de tokens en `app/assets/css/main.css` (`:root`): escala
  tipográfica (`--text-2xs` 11 px … `--text-2xl`), espaciado `--space-1..6` = 4/8/12/16/24/32 px,
  radios 8/10/14 px, easings (`cubic-bezier(.23,1,.32,1)`), duraciones 120/180/250 ms, foco y
  color; corregir `--muted-2` a `#8492a6` (5.99:1 sobre `--panel`) y `disconnected` a `#7d8a9c`
  (5.40:1) según `contracts/ui-contract.md` §1
- [ ] T004 [P] Ampliar `app/utils/status.ts` con `icon` y `ariaLabel` por estado según
  `contracts/ui-contract.md` §2 y crear `app/components/AppIcon.vue` con los cinco iconos
  (check, activity, hand, alert, plug-off); conservar `label`, `color`, `soft` y `description`
- [ ] T005 [P] Crear `app/composables/useMotionPreference.ts` con
  `matchMedia('(prefers-reduced-motion: reduce)')`, reactivo, seguro en SSR, listener limpiado al
  desmontar
- [ ] T006 [P] Crear `app/composables/useFocusTrap.ts`: lista de focusables, ciclo Tab/Shift+Tab,
  cierre con Escape, devolución del foco al disparador y API `activate/deactivate`

**Checkpoint**: tokens, iconos y preferencias listos; las historias pueden empezar.

---

## Phase 3: User Story 1 - Panel operativo legible y premium (Priority: P1) 🎯 MVP

**Goal**: tipografía real, contraste AA, HUD visible a 1024x768, estado único, pestañas fluidas,
botones y badges coherentes y navegación por teclado.

**Independent Test**: con 2 agentes reales, revisar V1–V3 de
[quickstart.md](./quickstart.md) a 1024x768 y 1280x800; no depende de la escena ni del móvil.

- [ ] T007 [US1] Añadir `@font-face` de Inter Variable y JetBrains Mono Variable en
  `app/assets/css/main.css` (`font-display: swap`, pilas ajustadas) y precargar Inter en
  `nuxt.config.ts` (`app.head.link` con `rel="preload" as="font" crossorigin`); FR-001
- [ ] T008 [US1] Ajustar `.metrics` en `app/assets/css/main.css` para que sigan visibles a
  1024x768 (sustituir el `display: none` de `<1180px` por compactación) y mantener
  `font-variant-numeric: tabular-nums`; FR-006/SC-003
- [ ] T009 [US1] Eliminar el estado de conexión duplicado de `app/components/AgentDetailPanel.vue`
  y `app/components/AgentCardList.vue`, dejando la topbar de `app/pages/index.vue` como fuente
  única; la causa del error puede mostrarse como explicación contextual dentro del estado vacío,
  sin repetir el chip de estado; FR-007/SC-004
- [ ] T010 [US1] Actualizar `app/components/StatusBadge.vue`, `app/components/AgentCardList.vue`,
  `app/components/AgentDetailPanel.vue` y `app/assets/css/main.css` para mostrar icono + color +
  etiqueta con `AppIcon`, badges de 11 px mínimo y los tokens corregidos; FR-008/FR-011
- [ ] T011 [US1] Implementar en `app/components/AgentPanel.vue` un indicador de pestañas único
  medido con `ResizeObserver` (posición y ancho de la pestaña activa) y la transición de contenido
  con desenfoque ≤180 ms en `app/assets/css/main.css`; FR-009/SC-008
- [ ] T012 [US1] Ajustar en `app/assets/css/main.css` los estados de botón: hover, active con
  `scale(.97)`, foco visible y deshabilitado, conservando la jerarquía de `.btn--primary`;
  FR-010/SC-002
- [ ] T013 [US1] Añadir a `app/utils/status.ts` el formato absoluto y el `datetime` ISO, e
  integrar timestamps relativos con valor absoluto accesible en `app/components/AgentCardList.vue`,
  `app/components/AgentDetailPanel.vue`, `app/components/EventFeed.vue`,
  `app/components/ApprovalsPanel.vue` y `app/components/AuditPanel.vue`; FR-011
- [ ] T014 [US1] Añadir `:focus-visible` global y revisar la navegación por teclado en
  `app/assets/css/main.css`, `app/components/TaskComposer.vue` y `app/components/TaskDrawer.vue`
  con el composable de T006; FR-003/FR-031
- [ ] T015 [P] [US1] Documentar en `docs/DESIGN.md` los tokens, la escala tipográfica, el contraste
  y las reglas de movimiento definidos en T003/T007; FR-002
- [ ] T016 [US1] Ejecutar la validación V1–V3 de `specs/001-premium-ui-scene/quickstart.md`,
  incluida la auditoría de duraciones ≤250 ms (SC-008) y las 3 cargas en frío (SC-007); corregir
  desviaciones y guardar `verify-hud-1280.png` y `verify-hud-1024.png`; SC-001/SC-002/SC-003/
  SC-004/SC-007/SC-008

**Checkpoint**: US1 completa y demostrable de forma independiente (MVP).

---

## Phase 4: User Story 2 - Primer contacto y recuperación con estados diseñados (Priority: P2)

**Goal**: estados vacío, carga y error diseñados en escena, panel, listas, actividad, aprobaciones,
auditoría y sesión; reintento con progreso y microcopy en español.

**Independent Test**: detener el servidor, recargar y provocar un error; verificar V4 de
[quickstart.md](./quickstart.md) sin depender de la escena nueva ni del móvil.

- [ ] T017 [P] [US2] Crear `app/components/StageState.vue` con variantes `empty`, `loading`
  (esqueleto del diorama/HUD) y `error` (causa + reintento), incluido el comando de arranque y el
  CTA de conexión; contrato §3 de `contracts/ui-contract.md`
- [ ] T018 [P] [US2] Crear `app/components/PanelState.vue` reutilizable con variantes
  `empty`, `loading` y `error`, título, mensaje y acción opcional; contrato §3
- [ ] T019 [P] [US2] Implementar el reintento con progreso y bloqueo de doble envío en
  `app/composables/useOffice.ts` (`busy`/`retry`), consumido por los estados de T020–T022;
  FR-014/FR-031
- [ ] T020 [US2] Integrar `app/components/StageState.vue` en `app/pages/index.vue` para los estados
  de la escena, sin inventar agentes y manteniendo la reconexión real; FR-012/FR-013; depende de
  T017 y T019
- [ ] T021 [P] [US2] Integrar `app/components/PanelState.vue` en
  `app/components/AgentDetailPanel.vue` y `app/components/AgentCardList.vue`; FR-015; depende de
  T018 y T019
- [ ] T022 [P] [US2] Integrar `app/components/PanelState.vue` en `app/components/AgentPanel.vue`,
  `app/components/ApprovalsPanel.vue`, `app/components/AuditPanel.vue` y
  `app/components/TaskDrawer.vue`; FR-015; depende de T018 y T019
- [ ] T023 [US2] Distinguir el texto propio del contenido del proveedor en
  `app/components/AgentDetailPanel.vue`, `app/components/TaskDrawer.vue` y
  `app/assets/css/main.css`, y revisar que toda la microcopy propia esté en es-ES; FR-016
- [ ] T024 [US2] Ejecutar la validación V4 de `specs/001-premium-ui-scene/quickstart.md` y guardar
  capturas de vacío, carga y error; SC-009

**Checkpoint**: US1 y US2 funcionan de forma independiente.

---

## Phase 5: User Story 3 - Escena isométrica encuadrada como product shot (Priority: P3)

**Goal**: encuadre automático con margen de HUD, entrada dolly, suelo/viñeta, bloom selectivo,
etiquetas 2x y microvariación de materiales.

**Independent Test**: abrir con 0, 1, 2 y 3+ agentes a 1280x800 y 1024x768; ejecutar V5–V6 de
[quickstart.md](./quickstart.md) y comparar bloom on/off.

- [ ] T025 [P] [US3] Crear `app/utils/scene-framing.ts` con el cálculo puro del encuadre
  ortográfico: bounds ocupados por los escritorios, bounds del diorama, zona segura del HUD
  (top/bottom), `targetFrustum`, `targetZoom` y clamping a 0.8–2.3; cubrir 0/1/2/3+/10 agentes;
  FR-017
- [ ] T026 [P] [US3] Crear `app/components/scene/ScenePostProcessing.client.vue` con
  `RenderPipeline` de `three/webgpu`, `pass`/`mrt`/`output` de `three/tsl`, `bloom` de
  `three/addons/tsl/display/BloomNode.js`, MRT `emissive`, media resolución, `useLoop().render()`,
  restauración de `renderer.render` al desmontar y apagado controlado si el pipeline no puede
  crearse o no sostiene el umbral; FR-020/FR-023
- [ ] T027 [US3] Integrar `app/utils/scene-framing.ts` y la entrada dolly de 600–900 ms en
  `app/components/OfficeScene.client.vue`: frustum reactivo al tamaño real del contenedor, margen
  de HUD, transición suave al seleccionar escritorio, cancelación al interactuar y salto directo
  con movimiento reducido (T005); FR-017/FR-018
- [ ] T028 [P] [US3] Añadir contexto de suelo/horizonte con rejilla sutil y viñeta asimétrica en
  `app/components/OfficeScene.client.vue` y `app/assets/css/main.css` (`.stage::after`), sin
  romper el suelo actual ni las sombras de contacto; FR-019
- [ ] T029 [P] [US3] Duplicar la resolución de etiqueta y pantalla en `app/components/OfficeDesk.vue`
  (1280x320 y 1280x800), ajustar anisotropía ≤8, mipmaps y reconstrucción por clave
  `nombre|estado`; FR-022
- [ ] T030 [US3] Añadir microvariación de materiales en `app/utils/lego-materials.ts`: niveles
  de desgaste 0–2 y textura de ruido de rugosidad compartida, con clave de caché acotada; usar la
  variante en `app/components/OfficeScene.client.vue` y `app/components/OfficeDesk.vue`; FR-021
- [ ] T031 [US3] Marcar los contribuyentes de bloom (LEDs, lámpara, pantallas) y excluir HUD,
  etiquetas y sprites de glow en `app/components/OfficeDesk.vue` y
  `app/components/scene/ScenePostProcessing.client.vue`; FR-020
- [ ] T032 [US3] Añadir el umbral de rendimiento y apagado automático del bloom en
  `app/components/scene/ScenePostProcessing.client.vue` y `app/components/OfficeScene.client.vue`:
  apagar si se miden menos de 55 fps sostenidos durante 2 s a 1024x768 con 3 agentes, conservando
  el resplandor emisivo/sprites; documentar en `docs/DESIGN.md`; FR-020/FR-023/SC-006
- [ ] T033 [US3] Ejecutar V5–V6 de `specs/001-premium-ui-scene/quickstart.md`: medir FPS con 0, 1,
  2 y 3+ agentes, comprobar DPR ≤1.75, forzar WebGL2 y guardar `verify-scene-*.png`,
  `verify-bloom-on.png` y `verify-bloom-off.png`; SC-005/SC-006/SC-008

**Checkpoint**: US3 completa; la escena se demuestra como product shot.

---

## Phase 6: User Story 4 - Identidad del agente, storytelling y uso móvil (Priority: P4)

**Goal**: retratos reales del minifig, reloj real, pizarra con tareas reales, luz reactiva,
escalonado, sonido opcional y cajón móvil accesible.

**Independent Test**: comparar avatares con las minifiguras, comprobar reloj/pizarra/luz y abrir a
390x844; ejecutar V7–V8 de [quickstart.md](./quickstart.md).

- [ ] T034 [P] [US4] Crear `app/composables/useAgentPortraits.ts`: clonar el grupo del minifig,
  renderizar a `RenderTarget` 128x128 con cámara ortográfica y luces, leer con
  `readRenderTargetPixelsAsync`, cachear por `agentId` + `identityKey` y liberar recursos
- [ ] T035 [P] [US4] Crear `app/components/AgentAvatar.vue` con retrato cacheado, respaldo SVG
  isométrico generado con `minifigTorso`/`minifigHair`/`minifigVariant` y `alt` no vacío; FR-024
- [ ] T036 [US4] Etiquetar el grupo del minifig con `userData.agentId` en
  `app/components/OfficeDesk.vue` y conectar `useAgentPortraits` con `app/components/OfficeScene.client.vue`
  para exponer los retratos; FR-024
- [ ] T037 [US4] Sustituir las iniciales por `app/components/AgentAvatar.vue` en
  `app/components/AgentCardList.vue` y `app/components/AgentDetailPanel.vue`; FR-024
- [ ] T038 [US4] Añadir el reloj de pared con hora local real es-ES en
  `app/components/OfficeScene.client.vue`, con textura actualizada por minuto y limpieza al
  desmontar; FR-025
- [ ] T039 [US4] Implementar la pizarra/kanban con las tareas reales en
  `app/components/OfficeScene.client.vue` y pasar `tasks` desde `app/pages/index.vue`, incluyendo
  el estado vacío de la pizarra y un máximo de 6 tareas visibles (las más recientes); FR-026
- [ ] T040 [US4] Implementar la iluminación reactiva al estado agregado (activo cálido /
  inactivo frío) en `app/components/OfficeScene.client.vue`, con transición suave y salto directo
  con movimiento reducido; FR-027
- [ ] T041 [US4] Añadir el escalonado de escritorios al entrar en
  `app/components/OfficeScene.client.vue` y `app/components/OfficeDesk.vue`, coordinado con la
  entrada de US3 y desactivado con movimiento reducido; FR-028
- [ ] T042 [US4] Crear `app/composables/useSoundscape.ts` (WebAudio procedural tras gesto, fundido
  de 300 ms, parada al ocultar/desmontar) y `app/components/SoundToggle.vue`; integrar el toggle
  con `aria-pressed` en `app/pages/index.vue`, apagado por defecto y persistido en
  `sessionStorage['agent-office-sound']`; FR-029
- [ ] T043 [US4] Implementar el cajón del panel a ≤640 px en `app/components/AgentPanel.vue`,
  `app/pages/index.vue` y `app/assets/css/main.css` con `useFocusTrap` (T006), cierre con Escape y
  sin scroll horizontal; entre 641 y 980 px el panel permanece apilado bajo la escena;
  FR-030/FR-031/FR-032
- [ ] T044 [US4] Ejecutar V7–V8 de `specs/001-premium-ui-scene/quickstart.md` y guardar
  `verify-mobile-390.png` además de las capturas de avatar, reloj y pizarra; incluir la prueba
  cronometrada de SC-011 (<20 s) y la comprobación tablet (panel apilado entre 641 y 980 px);
  SC-010/SC-011

**Checkpoint**: las cuatro historias funcionan de forma independiente y conjunta.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: accesibilidad final, rendimiento, documentación y cierre de puertas.

- [ ] T045 [P] Auditoría final de accesibilidad en `app/` y `app/assets/css/main.css`: contraste AA,
  foco visible, ARIA de iconos/retratos, trampa de foco en diálogos y cajón; corregir hallazgos
- [ ] T046 [P] Pasada de rendimiento y limpieza en `app/components/OfficeScene.client.vue`,
  `app/components/OfficeDesk.vue` y `app/composables/useAgentPortraits.ts`: liberar texturas y
  materiales propios, evitar asignaciones por frame y acotar cachés
- [ ] T047 [P] Sincronizar documentación: completar `docs/DESIGN.md` y añadir en `README.md` la
  sección de UI premium (tipografía, sonido, bloom y verificación); FR-002
- [ ] T048 Verificar los límites del cambio: `git diff --stat -- server data .specify/templates
  package.json package-lock.json` debe estar vacío y `npm run typecheck` debe terminar en verde;
  FR-034
- [ ] T049 Ejecutar el protocolo completo V1–V9 de
  `specs/001-premium-ui-scene/quickstart.md` y registrar evidencias, FPS y contraste
- [ ] T050 Ejecutar `npm run build` en una terminal sin sandbox o en CI (en DSH el sandbox aborta
  Nitro con `spawn EPERM`) y registrar el resultado; SC-012
- [ ] T051 Revisar `specs/001-premium-ui-scene/checklists/requirements.md` y
  `specs/001-premium-ui-scene/contracts/ui-contract.md` contra lo implementado, incluida la
  verificación de FR-035 (identidad LEGO isométrica y tema oscuro, sin tema claro conmutable);
  documentar cualquier desviación con su justificación

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sin dependencias; puede empezar de inmediato.
- **Foundational (Phase 2)**: depende de Setup; BLOQUEA todas las historias.
- **User Stories (Phases 3–6)**: dependen de Foundational. En la práctica se recomienda el orden
  P1 → P2 → P3 → P4 porque comparten archivos de escena/HUD; US2 puede trabajarse en paralelo con
  US1 si se respetan los archivos, y US4 depende de la escena de US3 para reloj/pizarra/luz.
- **Polish (Phase 7)**: depende de las historias que se quieran entregar.

### User Story Dependencies

- **US1 (P1)**: tras Foundational; sin dependencias de otras historias. MVP.
- **US2 (P2)**: tras Foundational; integra con la topbar de US1 pero es validable por separado
  deteniendo el servidor.
- **US3 (P3)**: tras Foundational; no depende de US2. Comparte `OfficeScene.client.vue` con US4,
  por lo que US3 debe cerrarse antes de las tareas de escena de US4.
- **US4 (P4)**: sus tareas de escena (reloj, pizarra, luz, escalonado, retratos) dependen de US3;
  sonido y cajón móvil solo dependen de Foundational.

### Within Each User Story

- Utilidades y composables antes de consumirlos en componentes.
- El reintento (`useOffice`) se implementa antes de integrar los estados que lo consumen.
- Componentes base antes de su integración en páginas.
- Implementación antes de la tarea de validación de la historia.
- Cerrar y validar una historia antes de pasar a la siguiente prioridad.

### Parallel Opportunities

- T004, T005 y T006 (archivos distintos) pueden ir en paralelo tras T003.
- US1 es mayormente secuencial porque comparte `app/assets/css/main.css` y los mismos componentes;
  T015 (documentación) puede ejecutarse en paralelo con la implementación de estilos.
- US2: T017, T018 y T019 pueden ir en paralelo; tras ellos, T021 y T022 tocan archivos distintos.
- US3: T025 (utilidad nueva), T026 (componente nuevo), T028 (OfficeScene y main.css) y T029
  (OfficeDesk) tocan archivos distintos entre sí; T030 comparte OfficeScene/OfficeDesk y va después.
- US4: T034 y T035 son nuevos y paralelizables; T038–T041 comparten `OfficeScene.client.vue` y
  T042 comparte `app/pages/index.vue` con T039, así que se ejecutan en orden.
- Polish: T045, T046 y T047 son archivos distintos y paralelizables.

---

## Parallel Example: User Story 1

```bash
# Documentación en paralelo con la implementación de estilos:
Task: "Documentar tokens en docs/DESIGN.md (T015)"

# El resto de US1 comparte main.css y los mismos componentes: ejecutar T007→T014 en orden.
```

## Parallel Example: User Story 3

```bash
# Nuevos módulos de escena:
Task: "Crear app/utils/scene-framing.ts (T025)"
Task: "Crear app/components/scene/ScenePostProcessing.client.vue (T026)"

# Estilos de escena en archivos distintos:
Task: "Rejilla/viñeta en OfficeScene y main.css (T028)"
Task: "Etiquetas 2x en OfficeDesk.vue (T029)"

# T030 (materiales) comparte OfficeScene/OfficeDesk con T028/T029: ejecutar después.
```

## Parallel Example: User Story 4

```bash
Task: "Crear app/composables/useAgentPortraits.ts (T034)"
Task: "Crear app/components/AgentAvatar.vue (T035)"
# T042 comparte app/pages/index.vue con T039: ejecutar después de las tareas de escena.
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Completar Phase 1 y Phase 2.
2. Completar Phase 3 (US1).
3. **PARAR y VALIDAR**: V1–V3 de quickstart con capturas.
4. Demostrar el panel premium sin depender de la escena nueva.

### Incremental Delivery

1. Setup + Foundational → base lista.
2. US1 → validar V1–V3 → demo (MVP).
3. US2 → validar V4 → demo de estados y recuperación.
4. US3 → validar V5–V6 → demo de escena/product shot.
5. US4 → validar V7–V8 → demo de identidad y móvil.
6. Polish → V1–V9, typecheck, build fuera del sandbox y documentación.

### Parallel Team Strategy

Con más de una persona:

1. Una persona cierra Setup/Foundational.
2. Después: A = US1, B = US2; al terminar US1, C puede empezar US3.
3. US4 solo cuando US3 cierre las tareas de escena compartidas; sonido/cajón pueden adelantarse.

---

## Notes

- `[P]` solo aplica a tareas con archivos distintos y sin dependencia de una tarea incompleta.
- No hay tareas de test automatizado: la verificación es el protocolo manual de quickstart.
- El build requiere terminal sin sandbox/CI por el `spawn EPERM` de Nitro en DSH.
- Evitar conflictos de archivo en `app/assets/css/main.css` y `app/components/OfficeScene.client.vue`:
  las tareas que los tocan van en orden, no en paralelo.
- Confirmar cada historia con sus criterios de aceptación antes de avanzar.
