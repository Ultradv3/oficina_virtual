# Quickstart: validación de mejoras premium de UI/UX y escena

**Feature**: `001-premium-ui-scene` · **Fecha**: 2026-10-24 · **Plan**: [plan.md](./plan.md)

Guía reproducible para demostrar que la funcionalidad funciona de extremo a extremo. No incluye
implementación: eso vive en `tasks.md` y en el código. Los datos de validación son siempre reales
(servidor OpenCode); no se usan mocks ni seeds.

## Requisitos

- Node.js 22 o superior y npm 10 o superior.
- Servidor OpenCode accesible en `http://127.0.0.1:4096` (`opencode serve --port 4096`).
- Un `.env` local basado en `.env.example`; si se usa token, abrir la UI con `?token=...`.
- Navegador con WebGPU (Chrome/Edge actuales). El fallback WebGL2 se valida desactivando WebGPU o
  en un navegador sin soporte.
- Altavoces/auriculares solo para la prueba de sonido (opcional).

## Puesta en marcha

```powershell
npm install
Copy-Item .env.example .env      # ajustar token/modelo si aplica
opencode serve --port 4096       # en otra terminal

npm run dev                      # http://localhost:3000
```

## Puertas automáticas

```powershell
npm run typecheck
npm run build
```

Resultado esperado: ambas terminan sin errores. Si el cambio tocara Docker (no es el caso), se
añadiría `docker build`. La verificación con token de producción solo es obligatoria si se toca
API/auth (fuera de alcance).

## Escenarios de validación

### V1. Tipografía de marca y tokens

1. Abrir la UI con caché vacía (DevTools → Network → Disable cache) y recargar tres veces,
   anotando el resultado de cada carga.
2. En DevTools → Elements → Computed, comprobar que el texto usa `Inter` y el código
   `JetBrains Mono` (no Segoe UI/Consolas).
3. Revisar que no hay salto de layout perceptible (CLS) al cargar.

**Esperado**: fuentes de marca renderizadas en las 3 cargas, sin FOUT visible persistente, con la
pila de respaldo legible (SC-007). **Evidencia**: captura y anotación del panel Computed/Network.

### V2. HUD y panel a 1024x768 y 1280x800

1. Redimensionar la ventana a 1280x800 y a 1024x768 (o usar el modo responsive de DevTools).
2. Comprobar métricas visibles, cifras tabulares, sin recortes.
3. Verificar que el estado de conexión aparece una sola vez en pantalla.
4. Cambiar de pestaña: indicador animado, transición suave ≤ 180 ms, sin salto.
5. Recorrer la interfaz solo con teclado: foco visible en todos los controles.
6. Auditar duraciones de microinteracciones (hover/active, pestañas, toasts, cajón): todas ≤ 250 ms
   y sin bloquear la interacción.

**Esperado**: SC-001, SC-002, SC-003, SC-004 y SC-008; FR-006…FR-011 cumplidos.
**Evidencia**: capturas `verify-hud-1280.png` y `verify-hud-1024.png`.

### V3. Contraste

```powershell
node -e "const L=h=>{const c=[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)/255).map(v=>v<=0.03928?v/12.92:((v+0.055)/1.055)**2.4);return 0.2126*c[0]+0.7152*c[1]+0.0722*c[2]};const R=(a,b)=>{const x=L(a),y=L(b);return ((Math.max(x,y)+0.05)/(Math.min(x,y)+0.05)).toFixed(2)};const f={muted2:'#8492a6',muted:'#8b97a9',success:'#4ade80',working:'#60a5fa',warn:'#fbbf24',danger:'#f87171',disconnected:'#7d8a9c'};for(const b of ['#0c1118','#141d29'])console.log('fondo '+b,Object.entries(f).map(([n,v])=>n+'='+R(v,b)).join(' '))"
```

**Esperado**: todos los ratios ≥ 4.5 sobre `--panel`; revisar también sobre `--panel-3` (fondo de
botones/hover). Cualquier texto nuevo debe pasar la misma comprobación.

### V4. Estados vacío, carga y error

1. Detener `opencode serve` y recargar: estado vacío diseñado con explicación, comando de arranque
   y botón de conexión; sin agentes inventados.
2. Con throttling «Slow 3G» en DevTools, recargar: esqueleto de carga sin salto al terminar.
3. Provocar un error (puerto incorrecto o token inválido): causa + reintento; el reintento muestra
   progreso y no duplica peticiones.
4. Repetir la revisión en panel de agente, actividad, aprobaciones, auditoría y sesión de tarea.

**Esperado**: SC-009 y FR-012…FR-016. **Evidencia**: capturas de cada estado.

### V5. Escena: encuadre, entrada y rendimiento

1. Con 0, 1, 2 y 3+ agentes, comprobar encuadre intencional, sin recortes, con margen de HUD, a
   1280x800 y 1024x768.
2. Recargar: dolly-in de 600–900 ms y escalonado de escritorios; seleccionar un escritorio y
   comprobar la transición suave.
3. Activar movimiento reducido en el sistema (o DevTools → Rendering → Emulate CSS media
   `prefers-reduced-motion: reduce`): la cámara aparece encuadrada sin dolly ni escalonado.
4. Medir FPS con el monitor de rendimiento (DevTools → Rendering → Frame Rendering Stats) en
   reposo y con 0, 1, 2 y 3+ agentes; anotar los valores.
5. Comprobar en DevTools que el DPR efectivo no supera 1.75.
6. Capturar la escena como prueba visual.

**Esperado**: SC-005, SC-006, SC-008; FR-017…FR-023. **Evidencia**: `verify-scene-*.png`, anotación
de FPS y del DPR.

### V6. Etiquetas, bloom y materiales

1. Acercar la cámara y comprobar etiquetas de nombre/estado nítidas (sin pixelado) a 1024x768.
2. Observar LEDs, lámpara/pantallas con resplandor selectivo; el HUD y las etiquetas no deben
   «bloom».
3. Comparar el rendimiento con el bloom activo y desactivado; si se miden menos de 55 fps
   sostenidos durante 2 s a 1024x768 con 3 agentes, aplicar la mitigación prevista (bloom a media
   resolución o desactivado); sin bloom, la capa emisiva/sprites debe mantener el resplandor.
4. Forzar el backend WebGL2 (desactivar WebGPU en el navegador o usar uno sin soporte), recargar y
   comprobar que la escena funciona y que el bloom se apaga de forma controlada sin errores.
5. Revisar los materiales del diorama: microvariación de rugosidad/desgaste sin manchas ni
   parches evidentes.

**Esperado**: FR-020…FR-022 y SC-006. **Evidencia**: captura comparativa `verify-bloom-on.png` /
`verify-bloom-off.png` y nota del fallback WebGL2.

### V7. Identidad, reloj, pizarra y sonido

1. Comparar el avatar de cada agente en lista/detalle con su minifigura de la escena; no deben
   aparecer iniciales como identidad principal.
2. Comprobar la hora del reloj de pared con la hora local real y su actualización.
3. Crear una tarea real y verificar que la pizarra/kanban refleja su estado; con 0 tareas muestra
   el estado vacío.
4. Observar la iluminación con agentes trabajando y con todos inactivos.
5. Comprobar que el sonido está apagado por defecto y que solo suena tras activarlo; recargar y
   verificar que la preferencia se recuerda en la sesión.
6. Cronometrar SC-011: con 3+ agentes y una aprobación pendiente, identificar el agente y abrir su
   sesión; debe completarse en menos de 20 s sin ayuda.

**Esperado**: FR-024…FR-029 y SC-011. **Evidencia**: capturas de avatar/pizarra/reloj, nota de
sonido y tiempo de la prueba cronometrada.

### V8. Móvil y accesibilidad

1. En DevTools, 390x844: abrir/cerrar el cajón del panel; sin desplazamiento horizontal; el HUD y
   la escena siguen visibles.
2. A 768x1024 (tablet) comprobar que el panel sigue apilado bajo la escena; el cajón superpuesto
   aparece a ≤640 px.
3. Abrir un diálogo (composer) y el cajón: Tab queda atrapado, Escape cierra y el foco vuelve al
   disparador.
4. Probar con zoom del navegador al 200 %: controles esenciales alcanzables.

**Esperado**: FR-030…FR-032 y SC-010. **Evidencia**: `verify-mobile-390.png` y captura tablet.

### V9. No regresión funcional

1. Crear una tarea, verla completarse por SSE, cancelar otra y responder una aprobación.
2. Reconectar tras detener/arrancar el servidor OpenCode.
3. Revisar que `server/`, los adaptadores, la base de datos y las dependencias no cambiaron:

```powershell
git status --short
git diff --stat -- server data .specify/templates package.json package-lock.json
```

**Esperado**: los flujos reales siguen funcionando y el diff se limita a `app/`, `public/fonts/`,
`docs/DESIGN.md`, `nuxt.config.ts` y `specs/001-premium-ui-scene/`.

## Evidencia y criterios de cierre

- Capturas en `verify-*.png` (ignoradas por git) a 1280x800, 1024x768 y 390x844.
- Resultados de `npm run typecheck` y `npm run build` registrados en la tarea.
- FPS medidos (bloom on/off) y contraste de tokens.
- Checklist de la spec y contrato UI revisados; ninguna desviación sin justificar.

## Solución de problemas

- **La fuente no carga**: revisar `public/fonts`, la ruta de `@font-face` y el precargado; limpiar
  caché y verificar que el archivo responde 200.
- **No hay bloom**: comprobar que el navegador usa `WebGPURenderer` (o su backend WebGL2), que el
  pipeline se creó y que `BloomNode` se importa desde `three/addons/tsl/display/BloomNode.js`.
- **FPS bajo**: medir con bloom apagado; bajar DPR a 1.5 si el equipo es limitado (sin superar
  1.75) y priorizar la fluidez frente al efecto.
- **La cámara no encuadra**: revisar el cálculo con 0/1/2/3+/10 agentes y el tamaño real del
  contenedor (no del viewport) y la zona segura del HUD.
- **El avatar no aparece**: comprobar la lectura del `RenderTarget`; si el backend no la soporta,
  el respaldo SVG con texto alternativo debe mostrarse sin errores.
