# Presupuesto de rendimiento y calidad adaptativa

## Objetivo

La escena apunta a **55 fps sostenidos** en `1024x768` con **3 agentes**. El
presupuesto no es un número decorativo: `ScenePerformance` mide FPS reales y
mueve la escena entre tres perfiles.

| Nivel | DPR máximo | Sombras | Bloom | Uso |
|---|---:|---|---|---|
| Alta | 1.75 | Sí | Sí | Equipo con margen; aspecto completo |
| Media | 1.25 | Sí | Sí | Baja la resolución de render antes que el aspecto |
| Baja | 1.0 | No | No | Prioriza interacción y batería |

## Regla de transición

- Ventana de medición: **500 ms**; calentamiento inicial: **1.5 s**.
- Por debajo de **55 fps** durante **2 s** baja un nivel.
- Por encima de **58 fps** durante **8 s** sube un nivel (histéresis).
- Entre 55 y 58 fps no cambia (zona muerta).
- NUNCA baja de `low` ni sube de `high`.
- Con la pestaña oculta se reinicia la muestra: el navegador limita RAF.

El algoritmo puro vive en `app/utils/perf-budget.ts` y está cubierto por
`tests/unit/perf-budget.test.ts`. El controlador de render es
`app/components/scene/ScenePerformance.client.vue`.

## Qué se aplica en caliente

- `renderer.setPixelRatio(min(devicePixelRatio, perfil.dpr))`.
- `renderer.shadowMap.enabled`.
- Bloom: se apaga en `low` mediante el prop `enabled` de
  `ScenePostProcessing`; `self-managed-fps="false"` evita dos políticas de FPS
  compitiendo.

`antialias` se decide al crear el canvas y no se cambia en caliente.

## Cómo verificarlo

- DOM: `.office-scene` expone `data-quality` (`high|medium|low`) y `data-fps`.
- HUD: chip `Calidad … · … fps` en la esquina inferior.
- Tests: `npm run test:unit` valida transiciones; `npm run test:e2e` comprueba
  que el presupuesto se expone y que los FPS se publican.
- Manual: abrir DevTools → Rendering → CPU throttling 6×; en unos segundos el
  chip debe pasar de Alta a Media/Baja y el bloom desaparecer. Al retirar el
  throttling, la recuperación es deliberadamente lenta (8 s) para evitar
  oscilaciones.

## Fuera del alcance actual

- Instancing/merge de mallas estáticas del entorno.
- Presupuesto de draw calls y memoria GPU.
- WebGL2 sin bloom: la calidad adaptativa de DPR/sombras sigue funcionando.
- Persistencia de un nivel manual elegido por el usuario.
