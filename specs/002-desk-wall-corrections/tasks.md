# Tasks: Corrección de escritorios de agentes y accesorios de pared

**Input**: Design documents from `/specs/002-desk-wall-corrections/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/scene-layout-contract.md](./contracts/scene-layout-contract.md),
[quickstart.md](./quickstart.md)

**Tests**: no se solicitan tests automatizados. La validación es visual y reproducible según
`quickstart.md`, con `typecheck` y `build` como puertas de calidad. No se añade ningún framework de
tests.

**Organización**: tareas agrupadas por historia de usuario para permitir implementación y validación
independientes. Las rutas siguen la estructura real del proyecto (`app/`).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: puede ejecutarse en paralelo (archivo distinto, sin dependencias pendientes)
- **[Story]**: historia de usuario a la que pertenece (US1, US2, US3)
- Se incluye la ruta exacta de cada archivo en la descripción

## Path Conventions

- Aplicación Nuxt única: `app/components/`, `app/utils/`, `docs/`, `specs/`.
- No se tocan `server/`, `data/`, `package.json` ni `package-lock.json`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: congelar la evidencia del estado actual antes de mover geometría.

- [X] T001 Capturar evidencia base de escritorios y paredes a 1280x800, 1024x768 y 390x844, guardando `verify-002-before-1280.png`, `verify-002-before-1024.png` y `verify-002-before-mobile.png` según `specs/002-desk-wall-corrections/quickstart.md`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: centralizar las medidas que compartirán ambas historias.

**⚠️ CRITICAL**: ninguna historia puede empezar hasta completar esta fase.

- [X] T002 [P] Crear `app/utils/desk-layout.ts` con `DESK_SURFACE_Y = 0.89`, `DESK_GROUP_Y = 0.02`, huella `2.55 × 1.18`, giro del grupo `π`, agente local `[0, 0.08, 0.95]` con giro `π`, silla local `[0, 0, 1.20]` con giro `π`, monitor `[-0.68, 0.90, -0.28]` con giro local `0.18 - π`, teclado `[0.15, 0.91, 0.30]`, taza `[-1.02, 0.89, 0.30]`, lámpara `[-1.02, 0.89, -0.40]`, papeles, etiqueta y anillo, más el helper `seatOnDesk(height)` con tolerancia de contacto ±0.005
- [X] T003 [P] Crear `app/utils/wall-layout.ts` con caras interiores (`back z = -5.78`, `left x = -8.78`), planos de montaje (`back z = -5.66`, `left x = -8.70`), frente de molduras `≤ -5.74` y huecos de ventana (`x = -1.30`, 4.50 de ancho), reloj (`x = 1.95`, `y = 2.30`, 1.32), rótulo (`x = 5.10`, 4.50), mosaico (`x = -5.60`, 3.50), pizarra y puerta, con margen de pared ≥0.15 y separación entre accesorios ≥0.12

**Checkpoint**: medidas centralizadas; US1 y US2 pueden ejecutarse en paralelo.

---

## Phase 3: User Story 1 - Escritorios coherentes y habitables (Priority: P1) 🎯 MVP

**Goal**: que cada puesto se lea como un lugar de trabajo real: agente frente al monitor y al
teclado, silla alineada, props apoyados, etiqueta y anillo visibles.

**Independent Test**: con 2 agentes reales, revisar cada escritorio a 1280x800 y 1024x768 y comprobar
la relación agente–teclado–monitor–silla, el apoyo de props y el resaltado. No depende de las
correcciones de pared ni de la densidad de 10 agentes.

### Implementation for User Story 1

- [X] T004 [US1] Recomponer el puesto en `app/components/OfficeDesk.vue`: girar el grupo del escritorio `π`, con agente local `[0, 0.08, 0.95]` y giro `π`, y silla local `[0, 0, 1.20]` con giro `π`, mantener monitor en `[-0.68, 0.90, -0.28]` con pantalla hacia `+z` y teclado en `[0.15, 0.91, 0.30]`, de modo que el teclado quede entre el agente y el monitor y la cámara conserve la vista de la pantalla y el perfil del minifig
- [X] T005 [US1] Reasentar teclado, lámpara, taza, papeles y base del monitor en `app/components/OfficeDesk.vue` usando `seatOnDesk(height)` de `app/utils/desk-layout.ts`, eliminando la flotación/penetración visible con tolerancia ±0.005
- [X] T006 [US1] Ajustar etiqueta y anillo en `app/components/OfficeDesk.vue`: etiqueta en `[0, 2.32, -0.05]` con escala `[2.55, 0.64, 1]`, y anillo interior 1.6 / exterior 1.76 en `y = 0.032` que cubra mesa, agente y silla sin quedar oculto por props
- [X] T007 [US1] Verificar y ajustar el volumen clicable, `select`, hover y resaltado de `app/components/OfficeDesk.vue` tras mover al agente y la silla, sin reducir la superficie de selección del escritorio
- [X] T008 [US1] Ejecutar la validación V1 de `specs/002-desk-wall-corrections/quickstart.md` con 2 agentes a 1280x800 y 1024x768, corregir desviaciones y guardar `verify-desk-1280.png` y `verify-desk-1024.png`

**Checkpoint**: US1 completa y demostrable de forma independiente.

---

## Phase 4: User Story 2 - Accesorios de pared alineados y sin solapamientos (Priority: P2)

**Goal**: paredes ordenadas, con todos los accesorios completos, montados al mismo plano y sin
oclusión de pilares; reloj, pizarra y rótulo con contenido real.

**Independent Test**: a 1280x800 y 1024x768, comprobar que reloj y rótulo no se tocan, que ventana,
rótulo, reloj y mosaico están completos y que pizarra/puerta no se recortan. No depende de la
posición interna de los props del escritorio.

### Implementation for User Story 2

- [X] T009 [US2] Retrasar pilares y junquillos de la pared trasera en `app/components/OfficeScene.client.vue` hasta que su frente quede en `z ≤ -5.74`, y fijar el plano de montaje de accesorios en `z = -5.66` según `app/utils/wall-layout.ts`
- [X] T010 [US2] Recolocar ventana, reloj, rótulo y mosaico en `app/components/OfficeScene.client.vue` usando los huecos de `app/utils/wall-layout.ts`: ventana `x = -1.30`, reloj `x = 1.95` y `y = 2.30`, rótulo `x = 5.10`, mosaico `x = -5.60`; ajustar pizarra y puerta al plano `x = -8.70`
- [X] T011 [US2] Añadir o ajustar los soportes/frentes de los accesorios en `app/components/OfficeScene.client.vue` para que contacten visualmente con la pared, no floten y no produzcan artefactos de profundidad con molduras o junquillos
- [X] T012 [US2] Verificar que el reloj sigue leyendo la hora local, la pizarra las tareas reales y el rótulo su texto actual en `app/components/OfficeScene.client.vue` y en la sesión de runtime, sin introducir contenido simulado
- [X] T013 [US2] Ejecutar la validación V2 de `specs/002-desk-wall-corrections/quickstart.md` a 1280x800 y 1024x768, corregir desviaciones y guardar `verify-wall-back.png` y `verify-wall-left.png`

**Checkpoint**: US2 completa; reloj/rótulo separados y accesorios sin oclusión.

---

## Phase 5: User Story 3 - Composición estable en todos los encuadres y estados (Priority: P3)

**Goal**: las correcciones de US1 y US2 se mantienen con 1/2/3+/10 agentes, selección, hover, zoom,
pan, móvil y modos gráficos.

**Independent Test**: abrir la escena con 1, 2, 3+ y 10 agentes a 1280x800, 1024x768 y 390x844;
seleccionar escritorios, hacer zoom/pan y comprobar que no aparecen recortes ni solapamientos nuevos.

### Implementation for User Story 3

- [X] T014 [US3] Validar 1, 2, 3+ y 10 agentes en `app/components/OfficeDesk.vue` y `app/components/OfficeScene.client.vue`; ajustar anclajes, tamaños de etiqueta o separación si aparece cualquier solapamiento o recorte
- [X] T015 [P] [US3] Verificar selección, hover, zoom y pan en `app/components/OfficeDesk.vue`, incluyendo la visibilidad del anillo y que la etiqueta no tape la pantalla ni otro escritorio
- [X] T016 [P] [US3] Verificar a 390x844, con modo de compatibilidad gráfica y con resplandor apagado, que las correcciones de pared y escritorio se mantienen en `app/components/OfficeScene.client.vue`
- [X] T017 [US3] Registrar la evidencia de densidades en `specs/002-desk-wall-corrections/tasks.md` (`verify-density-1.png`, `verify-density-2.png`, `verify-density-10.png`) y cerrar US3 con las desviaciones corregidas

**Checkpoint**: las tres historias funcionan juntas en todos los encuadres.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: documentar, medir y dejar el repositorio limpio.

- [X] T018 [P] Documentar en `docs/DESIGN.md` las convenciones de composición de escena: superficie de mesa, relación agente–monitor–teclado, plano de montaje de pared, huecos de accesorios y tolerancias
- [X] T019 Ejecutar `npm run typecheck` y corregir cualquier error introducido en `app/utils/desk-layout.ts`, `app/utils/wall-layout.ts`, `app/components/OfficeDesk.vue` o `app/components/OfficeScene.client.vue`
- [X] T020 Ejecutar `npm run build` y corregir cualquier error de compilación o de bundle en `app/components/OfficeDesk.vue`, `app/components/OfficeScene.client.vue`, `app/utils/desk-layout.ts` o `app/utils/wall-layout.ts`
- [X] T021 [P] Comprobar que el diff no toca backend ni datos con `git diff --stat -- server data package.json package-lock.json`, y limpiar constantes sin uso, comentarios obsoletos y formato en `app/utils/`
- [X] T022 Ejecutar el protocolo completo V1–V7 de `specs/002-desk-wall-corrections/quickstart.md`, guardar capturas finales y anotar en `specs/002-desk-wall-corrections/tasks.md` el estado y cualquier desviación aceptada

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (T001)**: sin dependencias; debe completarse antes de tocar geometría.
- **Foundational (T002–T003)**: depende de T001; bloquea US1 y US2.
- **US1 (T004–T008)**: depende de T002; puede ejecutarse en paralelo con US2.
- **US2 (T009–T013)**: depende de T003; puede ejecutarse en paralelo con US1.
- **US3 (T014–T017)**: depende de US1 y US2 completas.
- **Polish (T018–T022)**: depende de US3; T019 → T020 → T022.

### Task Dependencies

```text
T001
 ├─► T002 ─► T004 ─► T005 ─► T006 ─► T007 ─► T008 ─┐
 └─► T003 ─► T009 ─► T010 ─► T011 ─► T012 ─► T013 ─┤
                                                    ▼
                                              T014 ─► T015 ─┐
                                                    └─► T016 ─┤
                                                              ▼
                                                        T017 ─► T018
                                                              ├─► T019 ─► T020
                                                              ├─► T021
                                                              └─► T022
```

### Parallel Opportunities

- **T002 y T003**: dos utilidades nuevas y distintas.
- **US1 y US2**: `OfficeDesk.vue` + `desk-layout.ts` frente a `OfficeScene.client.vue` +
  `wall-layout.ts`; no comparten archivos.
- **T015 y T016**: validación de interacción en escritorio frente a móvil/compatibilidad en escena.
- **T018 y T021**: documentación frente a limpieza de diff/constantes.

### Parallel Example: User Story 1 y User Story 2

```text
Desarrollador A: T004 → T005 → T006 → T007 → T008 (OfficeDesk)
Desarrollador B: T009 → T010 → T011 → T012 → T013 (OfficeScene)
Después:        T014 → T015/T016 → T017
```

### Parallel Example: Polish

```text
T018 (docs/DESIGN.md)  ─┐
T021 (diff/limpieza)   ─┤ en paralelo tras T017
T019 → T020 → T022     ─┘
```

---

## Implementation Strategy

### MVP First (User Story 1)

1. Completar T001, T002 y T003 (base de medidas).
2. Implementar T004–T008 (US1) y validar con 2 agentes a 1280/1024.
3. Demostrar el MVP: puestos coherentes, props apoyados, etiqueta y anillo visibles.
4. Continuar con US2 (paredes) y US3 (estabilidad).

### Incremental Delivery

1. **US1**: corrección de escritorios → validar y capturar.
2. **US2**: corrección de paredes → validar reloj/rótulo/mosaico/pizarra/puerta.
3. **US3**: densidades, interacción y modos gráficos → cierre.
4. **Polish**: documentación, puertas de calidad y evidencia final.

### Notes

- Las tareas de validación (T008, T013, T014, T017, T022) incluyen corregir desviaciones, no solo
  capturar.
- No hay tests automatizados solicitados; la puerta es el protocolo visual más `typecheck` y `build`.
- Evitar tocar `server/`, `data/`, `package.json` o `package-lock.json`.
- Mantener el contenido real de reloj, pizarra y rótulo; no sustituirlo por imágenes estáticas.
- Las capturas son evidencia local (gitignored); no forman parte del entregable versionado.

---

## Implementation Status (2026-10-24)

- **Tareas**: 22/22 completadas.
- **Escritorios**: agente sentado/centrado sobre la silla (`y = 0.08`, `z = 0.95`), giro del grupo `π`; agente local `π` frente a cámara; silla local `π` bajo el agente (`z = 1.20`, respaldo neutro); teclado, taza, lámpara, papeles, monitor y cuaderno apoyados en la superficie `y = 0.89`; etiqueta y anillo (1.78–1.95) cubriendo mesa, agente y silla.
- **Paredes**: plano de montaje trasero en `z = -5.66`; pilares/junquillos retrasados (`frente ≤ -5.74`); reloj separado del rótulo (`x = 1.95`); ventana, rótulo, mosaico, pizarra y puerta completos y sin oclusión.
- **Evidencia**: `verify-002-before-*` y `verify-002-final-1280.png`, `verify-002-final-1024.png`, `verify-002-final-mobile-closed.png`, `verify-002-final-mobile-open.png`; densidades en `verify-density-{one,two,ten-final}.png`.
- **Rendimiento**: WebGPU con bloom activo, 60+ fps (67–84 según la sesión), DPR ≤1.75, sin excepciones; fallback WebGL2 verificado con capturas headless.
- **Puertas**: `npm run typecheck` y `npm run build` verdes (39.8 s, 19.2 MB).
- **Retrato del agente**: `AgentPortraitBaker` resetea el giro del clon y centra la minifigura por su caja envolvente; el avatar mira a cámara y queda centrado en el círculo.
- **Ajuste transversal**: en `app/assets/css/main.css` se corrigió el desbordamiento horizontal a 390x844 (topbar y leyenda), necesario para el criterio de móvil de US3.
- **Nota**: `git diff` muestra cambios ajenos en `server/` (subtasks) que ya estaban en el árbol y no forman parte de esta feature; no se modificaron.