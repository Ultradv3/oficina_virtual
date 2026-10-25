# Research: Corrección de escritorios de agentes y accesorios de pared

**Feature**: `002-desk-wall-corrections` · **Fecha**: 2026-10-24 · **Plan**: [plan.md](./plan.md)

Decisiones geométricas y de composición para corregir los defectos detectados. No hay
`NEEDS CLARIFICATION`: todas las decisiones se apoyan en la auditoría del código actual
(`OfficeDesk.vue`, `OfficeScene.client.vue`) y en las capturas a 1280x800, 1024x768 y 390x844.

## Estado de partida medido

- La mesa del escritorio tiene su superficie a **y ≈ 0.89** en coordenadas de mundo (grupo del
  escritorio en `y = 0.02`, tablero local centrado en `0.8` con `0.14` de grosor).
- El monitor está en `z = -0.28`, con la pantalla mirando hacia **+z**; la minifigura está en
  `z = -0.72` y mira hacia **+z**, y el teclado en `z = +0.3`. El agente queda detrás del monitor,
  la pantalla le da la espalda y el teclado está al otro lado del monitor.
- La silla está en `z = -1.02`, detrás de la minifigura y lejos del teclado.
- Asiento de props respecto a la superficie (valores de mundo): teclado embebido ≈0.01, lámpara
  embebida ≈0.035, taza flotando ≈0.03, monitor flotando ≈0.02, papeles flotando ≈0.008.
- Pared trasera: cara interior en `z ≈ -5.78`; los pilares llegan hasta `z ≈ -5.55`, por delante del
  rótulo (`z = -5.74`, frente ≈ -5.61) y del mosaico (`z = -5.76`, frente ≈ -5.715), por lo que los
  tapan parcialmente.
- El reloj está en `x = 2.35` con ancho `1.32` (rango ≈1.69–3.01) y el rótulo en `x = 5.1` con ancho
  `4.5` (rango ≈2.85–7.35): **se solapan ≈0.16**.
- Los accesorios de pared no comparten plano de montaje: ventana y reloj en `z = -5.72`, rótulo en
  `-5.74`, mosaico en `-5.76`.

## R1. Recomposición del puesto de trabajo

**Decisión**: mover la minifigura y la silla al lado del teclado (`z > 0`), girar al agente tres
cuartos (`-3π/4`) para que mire al monitor y al teclado y para que la cámara vea su perfil, y
conservar la pantalla orientada hacia `+z`. La composición resultante es "sobre el hombro": el
agente queda del lado del teclado, frente a la pantalla, y el operador sigue viendo la pantalla y el
estado desde el ángulo isométrico.

**Justificación**: es la disposición planar en la que agente y cámara pueden ver la misma cara del
monitor; mantiene el estado visible (requisito del producto), convierte la relación
agente–teclado–pantalla en físicamente coherente y conserva el perfil del minifig para no perder
del todo su expresividad.

**Alternativas consideradas**:

- Girar el monitor 180° para que mire al agente actual: el operador vería la parte trasera y se
  perdería el estado de la pantalla; rechazado.
- Mantener al agente detrás y limitarse a mover el teclado: persiste la incoherencia física;
  rechazado.
- Inclinar el monitor en diagonal para contentar a ambos: mejora parcial, pero sigue habiendo un
  lado privilegiado y complica la lectura del estado; se descarta como solución principal.

## R2. Asiento de props sobre la mesa

**Decisión**: calcular la altura de cada prop a partir de la superficie real (`y = 0.89`) y de su
propia altura, con una tolerancia de contacto de ±0.005. Teclado, lámpara, taza, papeles y base del
monitor se recolocan con esa regla; la silla se apoya en el suelo y el agente en el suelo/alfombra.

**Justificación**: elimina la flotación y la penetración visibles sin cambiar la geometría de las
piezas ni los materiales. Una función de ayuda (`seatOnDesk`) evita repetir cálculos y facilita la
auditoría.

**Alternativas**: subir o bajar todo el escritorio (rompe el resto de la composición); aceptar
tolerancias mayores (se sigue viendo el defecto); mover props a mano sin una regla (vuelve a
dispersarse).

## R3. Etiqueta y anillo de selección

**Decisión**: mantener el ancla de la etiqueta sobre el escritorio, revisar que su caja no invada la
pantalla, el agente ni otro escritorio, y ampliar el anillo para cubrir la nueva posición del agente
y la silla, manteniéndolo por debajo de los props y con `depthWrite` desactivado.

**Justificación**: la etiqueta y el anillo son la señal de selección principal; con el agente en el
lado frontal, el anillo debe cubrir esa nueva huella para no quedar cortado.

**Alternativas**: reducir la etiqueta (pierde legibilidad); anclar la etiqueta a la pared (se aleja
del escritorio); dejar el anillo actual (puede no rodear al agente).

## R4. Plano de montaje y huecos de pared

**Decisión**: definir un plano de montaje común para los accesorios de la pared trasera
(`z ≈ -5.66`, por delante de las molduras), retrasar pilares y junquillos hasta quedar por detrás
del plano de montaje (`frente ≤ -5.74`) y reservar huecos horizontales con margen:

- ventana: centro ≈ -1.3, ancho 4.5;
- reloj: centro ≈ 1.95, ancho 1.32 (entre ventana y rótulo);
- rótulo: centro ≈ 5.1, ancho 4.5;
- mosaico: sin cambios de contenido, con su hueco libre.
- pizarra y puerta: mantener su montaje en la pared izquierda.

Los accesorios comparten profundidad de montaje y las molduras dejan de estar por delante.

**Justificación**: resuelve a la vez el solapamiento reloj–rótulo y la oclusión de rótulo/mosaico por
los pilares, manteniendo el relieve de la pared donde no hay accesorios.

**Alternativas**: mover accesorios hacia delante (quedan despegados de la pared); eliminar los
pilares (pierde detalle); reducir el rótulo/mosaico (pierde presencia).

## R5. Alineación vertical y jerarquía

**Decisión**: alinear el centro del reloj con el del rótulo (`y ≈ 2.3`) y mantener ventana/mosaico en
sus alturas actuales, con márgenes superior e inferior dentro de la pared. La jerarquía visual queda:
ventana y rótulo como piezas grandes, pizarra/mosaico como secundarias, reloj como detalle.

**Justificación**: una línea de centros común entre reloj y rótulo refuerza el orden sin convertir
la pared en una cuadrícula rígida.

**Alternativas**: alinear todos los centros a la misma altura (la ventana quedaría forzada y podría
chocar con el zócalo); dejar alturas actuales (el reloj sigue compitiendo con el rótulo).

## R6. Contenido y datos

**Decisión**: no tocar las texturas ni la lógica de reloj, pizarra y rótulo; solo se mueven sus
soportes y grupos. El reloj sigue leyendo la hora local, la pizarra las tareas reales y el rótulo el
texto actual.

**Justificación**: cumple el principio de datos reales y evita introducir contenido simulado o
regresiones en la feature anterior.

**Alternativas**: regenerar las texturas con nuevas posiciones (más riesgo y sin necesidad);
sustituir por imágenes estáticas (rompe el requisito de datos reales).

## R7. Rendimiento

**Decisión**: los cambios son estáticos (posiciones, tamaños y constantes); no se añaden materiales
por escritorio, texturas por frame ni cálculos por frame. Se conservan la caché de materiales, los
materiales compartidos y el presupuesto de DPR.

**Justificación**: la corrección no debe afectar los 60 fps ni el consumo de GPU; mover geometría no
cambia el número de draws de forma apreciable.

**Alternativas**: regenerar la escena (coste alto); usar postprocesado para "arreglar" defectos
(no resuelve la geometría y añade coste).

## R8. Validación

**Decisión**: protocolo visual reproducible con capturas a 1280x800, 1024x768 y 390x844 con 1, 2,
3+ y 10 agentes, comprobación de reloj/pizarra, selección/hover/zoom, fallback gráfico, FPS y
`typecheck`/`build`. Se reutiliza la sesión de navegador instrumentada (Edge/CDP) de la feature
anterior; no se añade un framework de tests.

**Justificación**: el valor es visual y geométrico; una suite E2E añadiría dependencias y no mediría
mejor el solapamiento o el asiento de props. Las constantes de layout quedan aisladas para poder
testearlas cuando el proyecto incorpore una suite.

**Alternativas**: Playwright (dependencia nueva y navegadores); tests unitarios de geometría (útiles
a futuro, pero no cubren la percepción visual); revisión manual sin protocolo (no reproducible).

## Fuentes

- Código actual: `app/components/OfficeDesk.vue`, `app/components/OfficeScene.client.vue`.
- Capturas de la escena a 1280x800, 1024x768 y 390x844.
- [spec.md](./spec.md), [plan.md](./plan.md) y
  [constitución](../../.specify/memory/constitution.md).
