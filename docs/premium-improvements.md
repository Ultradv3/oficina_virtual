# Brief: mejoras "premium" de Agent Office

Documento de entrada para Spec Kit. Usarlo en una sesión nueva así:

```text
/speckit-specify Implementar las mejoras premium de UI/UX y escena descritas en docs/premium-improvements.md
```

Después: `/speckit-plan`, `/speckit-tasks`, `/speckit-implement` (y opcional `/speckit-clarify` y `/speckit-analyze`).

## Objetivo

Elevar la percepción visual del producto (oficina isométrica LEGO para supervisar agentes
OpenCode) a nivel "premium": tipografía real, microinteracciones, HUD jerarquizado y la
escena 3D tratada como *product shot*. La base funcional no cambia: mismo stack, mismos
datos, mismos flujos.

## Estado actual (punto de partida)

- Nuxt 4 + Vue 3.5 + TresJS 5.10 + three r186, renderer WebGPU con fallback WebGL2.
- Escena LEGO isométrica con escritorios por agente, minifigs, etiquetas canvas y sombras.
- Panel lateral con tabs (Agente / Actividad / Aprobaciones / Auditoría).
- UI oscura con `app/assets/css/main.css` (1.832 líneas, tokens en `:root`).
- Renderer y optimizaciones base ya aplicadas (node materials, sombras estáticas, cachés).

## Problemas detectados (evidencia)

1. `Inter` y `JetBrains Mono` se declaran en `main.css` pero **no se cargan** (sin `@font-face`
   ni `<link>`); el navegador cae a Segoe UI/Consolas.
2. Solo 3 `transition` y 1 `:active` en todo el CSS; sin `:focus-visible`; tabs y panel cambian
   en seco.
3. HUD superior plano: métricas sin tendencia ni `tabular-nums`, y se ocultan <1180px.
4. Información duplicada: estado de conexión en topbar y en el detalle del agente.
5. Avatar de agente con iniciales en vez de la identidad del minifig 3D.
6. Escena sin contexto: diorama flotando, cámara que no reencuadra con pocos agentes,
   etiquetas canvas de 640x160 px fijas (poco nítidas).
7. Estados loading/empty/error sin diseño (spinner + comando `opencode serve` en el vacío).
8. Microcopy mezclada: descripciones de OpenCode en inglés dentro de UI en español.

## Alcance por fases

### Fase 0 — Fundamentos de diseño
- Tokens: escala tipográfica, espaciado (4/8/12/16/24/32), radios (8/10/14), easings
  (`--ease-out: cubic-bezier(.23,1,.32,1)`, `--ease-in-out`, `--ease-drawer`).
- Cargar Inter Variable + JetBrains Mono self-hosted (`public/fonts` o `@fontsource`), `preload`.
- `:focus-visible` global; contraste AA en textos pequeños (subir `--muted-2`).
- Documentar en `DESIGN.md`.

### Fase 1 — HUD y panel
- Métricas compactas con `tabular-nums` y sparkline/estado live; no ocultarlas en tablet.
- Eliminar duplicados (conexión) y unificar semántica de color/estado (icono + color).
- Tabs con indicador animado compartido; contenido con crossfade + `blur(2px)` 180ms.
- Botones: `scale(.97)` en `:active`, hover sin desplazamiento salvo primario, focus ring.
- Badges mínimo 11px; timestamps relativos + tooltip absoluto.
- Estados empty/loading/error diseñados (skeleton del diorama, CTA de conexión, error accionable).

### Fase 2 — Escena como product shot
- Auto-fit de cámara según número de agentes; margen para HUD.
- Dolly-in de entrada (600-900ms, respetar reduced-motion) y transición suave al seleccionar.
- Suelo/horizonte con rejilla sutil y sombra de contacto; viñeta asimétrica.
- Bloom selectivo en emissives (LEDs/pantallas) con `PostProcessing` de `three/webgpu`.
- Micro-variación de materiales (rugosidad/desgaste); etiquetas a 2x y recorte limpio.

### Fase 3 — Identidad y storytelling
- Avatar = snapshot del minifig 3D por agente (o render del propio modelo).
- Reloj de pared con hora real; pizarra/kanban que refleje tareas reales.
- Iluminación reactiva (cálida/activa vs fría/idle); stagger de escritorios al entrar.
- Sonido sutil opcional (off por defecto).
- Layout móvil con drawer del panel.

## No objetivos

- Cambiar el stack ni añadir frameworks de UI.
- Rehacer la escena a otro estilo visual (se preserva la identidad LEGO/isométrica).
- Tocar la lógica de negocio, adaptadores, SSE o base de datos.
- Añadir autenticación/RBAC.

## Restricciones técnicas

- Todo el cliente vive en `app/`; CSS en `app/assets/css/main.css`; escena en
  `app/components/OfficeScene.client.vue`, `OfficeDesk.vue` y `app/components/lego/*`.
- three debe importarse desde `three/webgpu` (renderer WebGPU; fallback WebGL2 automático).
- No crear dependencias nuevas sin justificar (fuentes self-hosted están permitidas).
- Mantener `nuxt typecheck` y `nuxt build` en verde; verificar a 1280x800 y 1024x768.
- Respetar `prefers-reduced-motion` (CSS y animaciones de escena).

## Criterios de aceptación

1. Tipografía cargada y coherente en toda la UI; números tabulares en métricas/horas.
2. Contraste AA (>=4.5:1) en textos ≤14px.
3. Microinteracciones con curvas propias y duración <=250ms; sin saltos en tabs/panel.
4. Un dato, una fuente de verdad (sin chips duplicados).
5. Estados vacío/carga/error diseñados.
6. Escena encuadrada intencionalmente con 1, 2 y 3+ agentes; bloom sin bajar de 60fps en GPU integrada.
7. Capturas a 1280x800 y 1024x768 sin recortes ni zonas muertas.
8. `nuxt typecheck` y `nuxt build` OK.

## Referencias

- `README.md` (arquitectura y decisiones).
- `app/assets/css/main.css` (tokens actuales y componentes).
- `app/pages/index.vue` (layout, HUD, empty/loading).
- `app/components/OfficeScene.client.vue` (cámara, luces, escena).
- `app/components/OfficeDesk.vue` (etiqueta/pantalla/glow por agente).
- `app/components/AgentDetailPanel.vue` y `app/components/AgentPanel.vue` (panel y tabs).
