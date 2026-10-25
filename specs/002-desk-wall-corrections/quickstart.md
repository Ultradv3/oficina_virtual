# Quickstart: validación de escritorios y accesorios de pared

**Feature**: `002-desk-wall-corrections` · **Fecha**: 2026-10-24 · **Plan**: [plan.md](./plan.md)

Guía reproducible para comprobar que las correcciones visuales funcionan de extremo a extremo. Usa
datos reales de OpenCode; no hay mocks ni seeds.

## Requisitos

- Node.js 22 o superior y npm 10 o superior.
- Servidor OpenCode en `http://127.0.0.1:4096`.
- Navegador con WebGPU (y una pasada en WebGL2 si se quiere comprobar el modo de compatibilidad).
- `.env` local basado en `.env.example`.

## Puesta en marcha

```powershell
npm install
opencode serve --port 4096       # otra terminal
npm run dev                      # http://localhost:3000
```

Puertas automáticas:

```powershell
npm run typecheck
npm run build
```

## Escenarios

### V1. Escritorios con 2 agentes

1. Abrir la escena con dos agentes y seleccionar cada escritorio.
2. Comprobar `agente → teclado → monitor`: el agente mira al monitor, el teclado está entre ambos y
   la silla queda alineada detrás.
3. Revisar que taza, lámpara, papeles y base del monitor apoyan sobre la mesa sin flotar ni hundirse.
4. Verificar etiqueta legible y anillo de selección rodeando mesa, agente y silla.

**Esperado**: composición físicamente coherente, sin intersecciones visibles.
**Evidencia**: `verify-desk-1280.png` y `verify-desk-1024.png`.

### V2. Accesorios de pared

1. Enfocar la pared trasera a 1280x800 y 1024x768.
2. Comprobar que reloj y rótulo aparecen completos y separados, sin invadirse.
3. Revisar ventana, rótulo, reloj y mosaico: montados al mismo plano, sin pilares que los tapen.
4. Revisar pizarra y puerta en la pared izquierda: completas y sin recortes.
5. Comprobar que el reloj muestra la hora local y la pizarra las tareas reales.

**Esperado**: cero solapamientos y cero oclusiones de molduras.
**Evidencia**: `verify-wall-back.png` y `verify-wall-left.png`.

### V3. Densidades 1, 2, 3+ y 10 agentes

1. Abrir la escena con 1, 2, 3+ y, si es posible, 10 agentes.
2. Revisar que ningún escritorio, prop, etiqueta o accesorio de pared se solapa ni se recorta.
3. Con 1 agente, comprobar que la composición no queda desequilibrada.

**Esperado**: las correcciones se mantienen en todas las densidades.
**Evidencia**: `verify-density-1.png`, `verify-density-2.png`, `verify-density-10.png`.

### V4. Selección, hover, zoom y pan

1. Hacer clic en varios escritorios y comprobar que el agente seleccionado cambia.
2. Mantener hover y selección simultáneos; revisar el anillo.
3. Hacer zoom y pan; comprobar que etiquetas y accesorios no se recortan ni se solapan.

**Esperado**: interacción intacta y resaltado visible en todos los estados.
**Evidencia**: captura con zoom y captura con escritorio seleccionado.

### V5. Contenido real

1. Comparar la hora del reloj con la hora local.
2. Verificar que la pizarra refleja tareas reales y muestra su estado vacío cuando no hay tareas.
3. Leer el rótulo a 1024x768.

**Esperado**: hora, tareas y texto correctos, sin contenido inventado.

### V6. Rendimiento y compatibilidad

1. Medir FPS con 3+ agentes en WebGPU.
2. Activar el modo de compatibilidad gráfica o el resplandor apagado por rendimiento.
3. Comprobar que las correcciones visuales se mantienen y que la escena no se degrada.

**Esperado**: 60 fps con 3+ agentes; DPR ≤1.75; correcciones intactas en ambos modos.

### V7. Regresión funcional

1. Seleccionar agentes, crear/cancelar una tarea y responder una aprobación.
2. Comprobar que los estados y el anillo siguen representándose.
3. Revisar que `server/`, la API y la base de datos no cambiaron:

```powershell
git diff --stat -- server data package.json package-lock.json
```

**Esperado**: flujos reales intactos y diff limitado a `app/`, `docs/` y `specs/`.

## Criterios de cierre

- Capturas de escritorios y paredes a 1280x800 y 1024x768, más móvil 390x844.
- Sin solapamientos de pared, sin props flotantes y con agente/teclado/monitor coherentes.
- `npm run typecheck` y `npm run build` en verde.
- Reloj, pizarra y rótulo con contenido real.
- Sin cambios en backend, datos ni dependencias.

## Solución de problemas

- **Un prop flota**: recalcular su base respecto a `surfaceY` (0.89) y aplicar la tolerancia de
  ±0.005.
- **El anillo se corta**: comprobar que el agente y la silla quedan dentro del radio exterior y que
  el anillo se dibuja por debajo de los props.
- **Un pilar tapa un accesorio**: revisar el plano de montaje y retrasar la moldura por detrás.
- **Etiqueta recortada**: comprobar el anclaje y el viewport; no debe tapar la pantalla.
- **El reloj se solapa con el rótulo**: verificar los huecos del contrato (reloj en x≈1.95, rótulo en
  x≈5.1) y la separación mínima.
