# Contrato de layout de escena: escritorios y accesorios de pared

**Feature**: `002-desk-wall-corrections` · **Fecha**: 2026-10-24 · **Plan**: [plan.md](./plan.md)

Contrato de las interfaces de presentación de la escena. No hay API ni contrato de datos nuevos:
esta funcionalidad solo mueve geometría y fija invariantes visuales.

## 1. Contrato de componentes

Las props públicas no cambian:

```text
<OfficeDesk
  :agent="OfficeAgent"
  :index="number"
  :selected="boolean"
  :position="[number, number, number]"
  @select="(agentId: string) => void"
/>

<OfficeScene
  :agents="OfficeAgent[]"
  :tasks="TaskSummary[]"
  :selected-id="string | null"
  @select="(agentId: string) => void"
/>
```

Reglas:

- `OfficeDesk` sigue emitiendo `select` con el id del agente; el volumen clicable no se reduce.
- `OfficeScene` sigue recibiendo solo datos reales y no consulta la API.
- La corrección no añade props nuevas ni cambia los eventos existentes.

## 2. Convención de coordenadas

- Unidades de mundo; `y` hacia arriba; la cámara isométrica está en `[14, 14, 14]` mirando a
  `[0, 1, 0]`.
- La superficie del escritorio está a `y = 0.89`; el grupo del escritorio arranca en `y = 0.02`.
- Pared trasera: cara interior en `z = -5.78`; plano de montaje de accesorios en `z = -5.66`.
- Pared izquierda: cara interior en `x = -8.78`; plano de montaje en `x = -8.70`.
- Molduras, pilares y junquillos deben quedar **por detrás** del plano de montaje; los accesorios,
  por delante.

## 3. Contrato de escritorio

| Elemento | Ancla local objetivo | Regla de apoyo |
| --- | --- | --- |
| Grupo del escritorio | giro `π` | El puesto completo mira a cámara |
| Mesa | centro `[0, 0.8, 0]`; superficie `y = 0.89` | Fija; define la superficie de apoyo |
| Agente | `[0, 0.08, 0.95]`, giro local `π` | Suelo; mira a cámara (+z) |
| Silla | `[0, 0, 1.20]`, giro local `π` | Suelo; centrada bajo el agente y girada con el grupo |
| Monitor | `[-0.68, 0.90, -0.28]`, giro local `0.18 - π` | Base sobre la mesa (±0.005); pantalla compensada hacia cámara |
| Teclado | `[0.15, 0.91, 0.30]` | Base sobre la mesa (±0.005) |
| Taza | `[-1.02, 0.89, 0.30]` | Base sobre la mesa (±0.005) |
| Lámpara | `[-1.02, 0.89, -0.40]` | Base sobre la mesa (±0.005) |
| Papeles | `[0.80, 0.9125, -0.40]` y `[0.81, 0.9575, -0.39]` | Apilados sobre la mesa |
| Etiqueta | `[0, 2.32, -0.05]`, escala `[1.6, 0.36, 1]`, opacidad `0.7` | Flotante; dentro del escenario |

Invariantes:

1. Cada pieza con `support: desk` tiene su base a ±0.005 de `y = 0.89`.
2. La minifigura no atraviesa mesa, silla ni props; mira a cámara con el grupo girado `π`.
3. El teclado queda entre el agente y el monitor; el monitor queda entre el teclado y la pared.
4. La etiqueta no tapa la pantalla ni el mobiliario de otro escritorio y no se recorta a 1024x768.

## 4. Contrato de pared

| Accesorio | Pared | Centro (x) | Tamaño (ancho × alto) | Contenido |
| --- | --- | --- | --- | --- |
| Ventana | trasera | -1.30 | 4.50 × 2.02 | Luz/ventana decorativa |
| Reloj | trasera | 1.95 | 1.32 × 1.32 | Hora local real |
| Rótulo | trasera | 5.10 | 4.50 × 1.26 | Texto de marca actual |
| Mosaico | trasera | -5.60 | 3.50 × 1.66 | Patrón de colores existente |
| Pizarra | izquierda | z = 0.90 | 3.60 × 2.10 | Tareas reales |
| Puerta | izquierda | z = -3.50 | 0.16 × 2.30 | Decorativa |

Invariantes:

1. Los accesorios de la pared trasera comparten `z de montaje = -5.66`; los de la izquierda,
   `x = -8.70`.
2. Todos quedan dentro de su pared con margen ≥0.15 en los cuatro lados.
3. La separación horizontal entre accesorios es ≥0.12; en particular, reloj y rótulo no se tocan.
4. Molduras, pilares y junquillos quedan detrás del plano de montaje y no tapan accesorios.
5. El contenido se mantiene real: hora local, tareas reales y texto del rótulo.
6. Ningún accesorio queda tapado por etiquetas, minifiguras o props en los encuadres de referencia.

## 5. Contrato de validación visual

- Capturas a 1280x800 y 1024x768 con 1, 2, 3+ y 10 agentes; adicional a 390x844.
- Inspección de cada escritorio: agente–monitor–teclado–silla, props apoyados, etiqueta y anillo.
- Inspección de paredes: reloj/rótulo separados, accesorios completos, sin oclusión de pilares.
- Estados de selección, hover, zoom y pan.
- Contenido: hora real, tareas reales, rótulo legible.
- Rendimiento: 60 fps con 3+ agentes, fallback gráfico operativo.
- Puertas: `typecheck` y `build` verdes; `server/` sin cambios.

## 6. Límites de datos

- No se añaden endpoints, tablas, columnas ni eventos.
- No se persisten posiciones ni preferencias de layout.
- No se introducen datos simulados; la escena sigue usando el estado real.
