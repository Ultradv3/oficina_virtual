# Research: Mejoras premium de UI/UX y escena

**Feature**: `001-premium-ui-scene` · **Fecha**: 2026-10-24 · **Plan**: [plan.md](./plan.md)

Este documento resuelve las incógnitas técnicas del plan y fija las decisiones con su
justificación. No hay `NEEDS CLARIFICATION` pendientes: todas las decisiones se apoyan en el
código instalado (`three` 0.186.1, `@tresjs/core` 5.10.0), en la especificación y en las guías de
threejsresources.

## Estado de partida verificado

- `app/assets/css/main.css` tiene 1.832 líneas y tokens en `:root`, pero **0 `@font-face`**:
  `Inter` y `JetBrains Mono` se declaran y nunca se cargan (caída a Segoe UI/Consolas).
- Solo **3 `transition`**, **1 `:active`**, **0 `:focus-visible`** y 4 `@media` en todo el CSS.
- `.metrics` se oculta por debajo de **1180 px**, justo por encima del objetivo 1024x768.
- La cámara es una `TresOrthographicCamera` fija en `[14, 14, 14]`; el frustum ya se calcula por
  número de agentes, pero sin margen de HUD ni transición de entrada.
- Las etiquetas 3D se dibujan en canvas de **640x160** y las pantallas en **640x400**.
- Los avatares de agente son **iniciales** (`AgentCardList`, `AgentDetailPanel`).
- El estado de conexión se repite en topbar, detalle de agente, lista de agentes y estado vacío.
- `three` 0.186.1 incluye `RenderPipeline` (three/webgpu) y `bloom` (addons TSL); `@tresjs/core`
  5.10 expone `useLoop().render()` para sustituir la función de render.

## R1. Entrega de tipografía

**Decisión**: alojar en `public/fonts/` los dos tipos variables en WOFF2 (Inter Variable y
JetBrains Mono Variable), declararlos con `@font-face` en `main.css`, precargar Inter desde
`app.head.link` en `nuxt.config.ts` y usar `font-display: swap` con una pila de respaldo ajustada
métricamente (`size-adjust`/`ascent-override`).

**Justificación**: cumple «mostrar las tipografías de marca desde el primer render sin saltos de
layout» sin añadir dependencias de runtime; el precargado evita el FOUT en el caso normal y la
pila ajustada mitiga el CLS cuando la fuente llega tarde. Las dos familias son SIL OFL 1.1, así
que se pueden redistribuir incluyendo `OFL.txt`.

**Alternativas consideradas**:

- `@fontsource-variable/*` como dependencia: válido, pero añade paquetes y complica el precargado
  con URLs con hash. Se prefiere vendorizar los WOFF2 (licencia OFL permite redistribución).
- Google Fonts CDN: dependencia externa, privacidad y offline; rechazado por la constitución.
- Pila del sistema: es el estado actual y causa la caída a Segoe UI; rechazado.

**Riesgo**: si el precargado no llega antes del primer paint en frío, `swap` puede mostrar la
fuente de respaldo un instante. Se verificará con caché vacía; si se detecta FOUT, se cambia a
`font-display: optional` y se documenta.

## R2. Sistema de tokens y contraste

**Decisión**: extender `:root` con tokens semánticos y documentarlos en `docs/DESIGN.md`:

- Tipografía: `--font-sans`, `--font-mono`, escala `--text-2xs` (11 px) a `--text-2xl` (40 px).
- Espaciado: `--space-1..6` = 4/8/12/16/24/32 px.
- Radios: `--radius-sm` 8 px, `--radius-md` 10 px, `--radius-lg` 14 px.
- Movimiento: `--ease-out: cubic-bezier(.23,1,.32,1)`, `--ease-in-out`, `--ease-drawer`;
  `--dur-fast` 120 ms, `--dur-base` 180 ms, `--dur-slow` 250 ms.
- Color: conservar la paleta y corregir dos tokens que no cumplen AA:

| Token | Actual | Contraste en `--panel` | Nuevo | Contraste |
| --- | --- | --- | --- | --- |
| `--muted-2` | `#667386` | 3.93:1 (falla) | `#8492a6` | 5.99:1 |
| estado `disconnected` | `#64748b` | 3.98:1 (falla) | `#7d8a9c` | 5.40:1 |

**Justificación**: los valores se midieron con la fórmula de luminancia relativa WCAG sobre los
fondos reales (`--bg`, `--panel`, `--panel-2`, `--panel-3`); el resto de tonos de estado ya
superan 4.5:1. Un sistema único evita la deriva de tamaños y curvas que hoy produce 0.54–0.72 rem
sueltos.

**Alternativas**: Tailwind u otra librería de estilos (dependencia nueva y cambio de stack,
prohibido); CSS-in-JS (dependencia); mantener valores ad hoc (incoherencia actual).

## R3. Movimiento y preferencia reducida

**Decisión**: dos capas coordinadas. CSS: media query global ya existente, ampliada con los tokens
de duración/easing. JS: composable `useMotionPreference` con
`matchMedia('(prefers-reduced-motion: reduce)')`, reactivo y con fallback SSR; las animaciones de
escena (entrada, escalonado, iluminación) consultan la preferencia y saltan al estado final.

**Justificación**: las animaciones de cámara y materiales no se pueden desactivar solo con CSS;
la preferencia del sistema es la fuente correcta y no requiere configuración propia.

**Alternativas**: GSAP (dependencia nueva), animar solo con CSS (imposible para la cámara),
ignorar la preferencia (viola FR-005 y la constitución).

## R4. Bloom selectivo con three r186

**Decisión**: usar el pipeline de nodos nativo de `three/webgpu`:

```ts
// dentro de <TresCanvas>, usando useTresContext() y useLoop()
const renderer = context.renderer.instance       // WebGPURenderer (o su backend WebGL2)
const pipeline = new RenderPipeline(renderer)    // PostProcessing está deprecado desde r183
const scenePass = pass(scene.value, context.camera.activeCamera.value)
scenePass.setMRT(mrt({ output, emissive }))      // pass/mrt/output desde 'three/tsl'
const color = scenePass.getTextureNode('output')
const glow = bloom(scenePass.getTextureNode('emissive'), 0.55, 0.4, 0.18)
pipeline.outputNode = color.add(glow)            // bloom desde 'three/addons/tsl/display/BloomNode.js'

const { render } = useLoop()
render((notify) => { pipeline.render(); notify() })   // sustituye el render de TresJS
```

Hallazgos verificados en el paquete instalado:

- `PostProcessing` está deprecado desde r183; el nombre vigente es `RenderPipeline`
  (`node_modules/three/build/three.webgpu.js`).
- `BloomNode` renderiza su cadena a escala **0.5** por defecto (`_resolutionScale = 0.5`), lo que
  reduce coste sin perder el efecto; el bloom selectivo se consigue con MRT y el canal `emissive`.
- `pass`, `mrt` y `output` existen en `three/tsl`; `bloom` se exporta desde
  `three/addons/tsl/display/BloomNode.js`.
- `useLoop().render(fn)` sustituye la función de render del bucle de TresJS
  (`RenderFunction = (notifySuccess) => void`); al desmontar hay que restaurar
  `renderer.render(scene, camera)` y liberar el pipeline.
- `outputColorTransform` está activo por defecto: el pipeline aplica tone mapping y espacio de
  color del renderer, por lo que no hay doble corrección si se deja el renderer como está.

**Justificación**: es la vía oficial WebGPU/TSL, compatible con el renderer actual y con su
fallback WebGL2; no requiere dependencias.

**Alternativas**: `EffectComposer`/`UnrealBloomPass` (solo WebGL, incompatible con
`WebGPURenderer`); glows por sprites (ya existen para LED/pantallas pero no producen bloom de
pantalla completa); desenfoque CSS superpuesto (no respeta profundidad ni selección).

**Mitigación de rendimiento**: bloom a media resolución, DPR ≤ 1.75; si se miden menos de 55 fps
sostenidos durante 2 s a 1024x768 con 3 agentes, se desactiva el bloom y queda la capa de
emisivos/glow existente, que mantiene FR-020; el fallback WebGL2 también se valida. Ver R11.

## R5. Encuadre automático y entrada de cámara

**Decisión**: extraer el cálculo a una utilidad pura `app/utils/scene-framing.ts`:

1. Calcular el rectángulo ocupado por los escritorios activos (`deskPositions`) más un margen
   visual y el diorama mínimo.
2. Ajustar el frustum ortográfico al aspecto del lienzo descontando la zona segura del HUD
   (barra superior y HUD inferior).
3. Animar la entrada como un *dolly* ortográfico: `camera.zoom` de 0.86 a 1 (o escala de frustum
   1.12 → 1) durante 600–900 ms con `--ease-out`; desactivar `OrbitControls` durante la entrada y
   cancelar la animación si el operador interactúa.
4. Con movimiento reducido, aplicar el encuadre final directamente.

**Justificación**: preserva la proyección isométrica y el control de órbita/zoom ya existente;
el cálculo puro se puede validar con casos 0/1/2/3+/10 agentes sin abrir el navegador.

**Alternativas**: cámara en perspectiva (rompe la identidad isométrica); posiciones fijas por
número de agentes (frágil con 10+ y con cambios de viewport); `OrbitControls` con auto-fit
(asume escena completa y no reserva margen de HUD).

## R6. Etiquetas y pantallas a 2x

**Decisión**: duplicar la resolución de los canvas: etiqueta 1280x320 (hoy 640x160) y pantalla
1280x800 (hoy 640x400). Mantener el tamaño físico del sprite/plano; activar anisotropía de hasta 8
y mipmaps; reconstruir solo cuando cambie la clave `nombre|estado`; liberar la textura anterior.

**Justificación**: el doble de densidad es la forma más barata de nitidez sin cambiar el modelo ni
la composición; las texturas ya se regeneran solo ante cambios reales, así que el coste extra es
puntual.

**Alternativas**: etiquetas HTML superpuestas (accesibles, pero pierden oclusión y profundidad y
obligan a proyectar cada frame); `troika-three-text` (dependencia nueva); mantener 640x160 (no
cumple FR-022).

**Riesgo**: los canvas de tamaño no potencia de dos con mipmaps; se verifica en WebGPU y en el
fallback WebGL2; si alguna ruta falla, se desactivan mipmaps y se conserva la anisotropía.

## R7. Microvariación de materiales

**Decisión**: ampliar la caché compartida (`app/utils/lego-materials.ts`) con un nivel de desgaste
cuantizado (0–2) y una textura de ruido de rugosidad compartida (64x64, `RepeatWrapping`). La
variante se deriva de forma determinista del índice/posición del ladrillo; la clave de caché
incluye desgaste y textura, manteniendo el número de materiales acotado.

**Justificación**: evita el aspecto de plástico uniforme sin multiplicar pipelines (hoy la caché
es la clave del rendimiento de la escena) y sin shaders personalizados.

**Alternativas**: un material único por ladrillo (explosión de compilaciones, inaceptable);
ruido procedural en TSL por material (más coste y complejidad); posprocesado de grano (afecta a
toda la imagen, no solo a los materiales).

## R8. Avatares de agente

**Decisión**: snapshot real del minifig con el renderer principal:

1. Etiquetar el grupo del minifig con `userData.agentId` en `OfficeDesk`.
2. Clonar el grupo (comparte geometrías/materiales) en una escena de retrato mínima con cámara
   ortográfica y dos luces.
3. Renderizar a un `RenderTarget` de 128x128 con el renderer existente y leer los píxeles con
   `readRenderTargetPixelsAsync` (existe en r186).
4. Guardar el `data URL` en una caché reactiva por `agentId` + clave de identidad; mostrarlo en
   `AgentCardList` y `AgentDetailPanel`.
5. Si el snapshot falla (contexto perdido, backend sin lectura), usar un retrato SVG isométrico
   generado con `minifigTorso`/`minifigHair`/`minifigVariant` y texto alternativo accesible.

**Justificación**: cumple «avatar derivado del minifig 3D» sin abrir un contexto WebGPU por
avatar (límite de contextos del navegador) y reutiliza la identidad ya existente. La caché evita
repetir la lectura en cada refresco SSE.

**Alternativas**: un `<TresCanvas>` por fila (coste y contextos); iniciales actuales (falla
FR-024); imágenes estáticas (no representan al agente real); render 3D en el servidor (fuera de
alcance y sin GPU).

## R9. Accesibilidad e interacción

**Decisión**:

- `:focus-visible` global con anillo de 2 px y `outline-offset` sobre tokens.
- Composable `useFocusTrap` (lista de focusables, ciclo con Tab/Shift+Tab, Escape, devolución del
  foco al disparador) aplicado a `TaskComposer`, `TaskDrawer` y al cajón móvil.
- Indicador de pestañas como elemento único medido con `ResizeObserver` sobre la pestaña activa.
- Iconos de estado en SVG en línea mapeados desde `STATUS_META` (icono + color + etiqueta, nunca
  solo color); badges a 11 px mínimo; timestamps relativos con `<time datetime>` y valor absoluto
  en `title`/`aria-label`.
- Toasts ya usan `aria-live="polite"`; se conserva.

**Justificación**: cubre FR-003, FR-004, FR-008, FR-011, FR-031 y SC-001/SC-002 sin dependencias.

**Alternativas**: `<dialog>` nativo (estilos y teleport con fricción, comportamiento irregular);
`focus-trap` (dependencia nueva); confiar solo en el navegador (no hay trampa de foco ni Escape
consistente).

## R10. Sonido ambiental opcional

**Decisión**: `useSoundscape` con WebAudio creado tras un gesto explícito (toggle en la barra
superior); colchón procedural (2 osciladores desafinados + paso bajo + ganancia muy baja, con
ruido filtrado opcional); fundido de 300 ms; estado en `sessionStorage`
(`agent-office-sound`), apagado por defecto; se detiene al ocultar la pestaña o desmontar.

**Justificación**: cero assets, cero dependencias y sin autoplay; cumple FR-029 y respeta las
políticas de los navegadores.

**Alternativas**: archivo de audio (licencia y peso); librería de audio (dependencia);
reproducción automática (prohibida por la especificación y por las políticas del navegador).

## R11. Estrategia de verificación

**Decisión**: no se introduce una suite de tests en esta funcionalidad (la constitución exige
planificar y justificar su introducción). La verificación se compone de:

- Puertas automáticas del proyecto: `npm run typecheck` (verde el 2026-10-24) y `npm run build`.
  En el entorno DSH con sandbox, Nitro/esbuild aborta con `spawn EPERM` (restricción de tuberías
  del sandbox, no un fallo de código); el build se valida en terminal sin sandbox o en CI.
- Verificación explícita del fallback WebGL2 y del límite de DPR ≤ 1.75 en V5/V6.
- Protocolo manual reproducible en [quickstart.md](./quickstart.md) con capturas
  `verify-*.png` (ignoradas por git) a 1280x800, 1024x768 y 390x844.
- Medición de FPS con el monitor de rendimiento del navegador y comparación bloom on/off.
- Auditoría de contraste de tokens con la fórmula WCAG (los valores ya están calculados en R2).
- Revisión de diff: `server/`, `server/adapters`, API y base de datos no deben cambiar.

**Justificación**: el valor de esta funcionalidad es visual y de interacción; un framework de
tests E2E añadiría descarga de navegadores y mantenimiento sin cubrir el encuadre o el bloom.
Las utilidades puras (`scene-framing`, contraste) quedan aisladas para poder testearlas cuando el
proyecto decida incorporar una suite.

**Alternativas**: Playwright (nueva dependencia de desarrollo y navegadores); Vitest (poca
cobertura real para este tipo de cambio); solo revisión visual sin protocolo (no reproducible).

## Fuentes

- Código instalado: `node_modules/three/build/three.webgpu.js` (RenderPipeline),
  `node_modules/three/examples/jsm/tsl/display/BloomNode.js` (bloom/MRT),
  `node_modules/@tresjs/core` (useLoop, render modes).
- Guías: [Camera](https://threejsresources.com/guides/camera),
  [UI y HUD](https://threejsresources.com/guides/ui-hud),
  [Texturas](https://threejsresources.com/guides/textures),
  [Text](https://threejsresources.com/guides/text),
  [WebGPU](https://threejsresources.com/webgpu/three-js),
  [Sombras](https://threejsresources.com/guides/shadows).
- [spec.md](./spec.md) y [constitución](../../.specify/memory/constitution.md).
