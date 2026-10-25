# Especificación de funcionalidad: Corrección de escritorios de agentes y accesorios de pared

**Rama de funcionalidad**: `002-desk-wall-corrections`

**Creada**: 2026-10-24

**Estado**: Draft

**Entrada**: Descripción del usuario: "correcion de los ecritorios de los agentes y accesorios de las paredes"

**Fuente**: auditoría visual de la escena actual a 1280x800, 1024x768 y 390x844.

## Escenarios de usuario y pruebas

La escena isométrica es la identidad del producto y la superficie donde el operador reconoce de un
vistazo a cada agente. La auditoría actual detecta incoherencias de composición: el reloj de pared
invade el rótulo, la minifigura y la silla quedan al otro lado del monitor respecto al teclado, y
algunos objetos del escritorio no apoyan de forma consistente sobre la superficie. Esta
funcionalidad corrige esos defectos y establece una pauta visual verificable para cada escritorio y
cada accesorio de pared, sin cambiar datos ni flujos.

### Historia de usuario 1 - Escritorios coherentes y habitables (Prioridad: P1)

Como operador, quiero que cada escritorio se lea como un puesto de trabajo real —agente frente a su
monitor y teclado, silla alineada, objetos apoyados—, para identificar al agente y su estado sin
ruido visual y sin la sensación de que las piezas están mal montadas.

**Por qué esta prioridad**: el escritorio es el elemento que más se repite y el principal punto de
contacto con cada agente; una composición incoherente degrada toda la escena.

**Prueba independiente**: con 2 agentes reales, revisar cada escritorio a 1280x800 y 1024x768 y
comprobar la relación agente–monitor–teclado–silla y el apoyo de los props. No depende de los
accesorios de pared ni de la densidad de 10 agentes.

**Escenarios de aceptación**:

1. **Dado** un escritorio con agente, **cuando** se observa desde el ángulo isométrico, **entonces**
   el agente está frente al monitor y al teclado, sin atravesar silla, mesa ni otros objetos.
2. **Dado** el monitor del escritorio, **cuando** se observa la composición, **entonces** su pantalla
   se orienta hacia el agente y el estado representado sigue siendo reconocible desde la cámara.
3. **Dado** la taza, la lámpara, los papeles y el teclado, **cuando** se inspecciona la superficie,
   **entonces** todos apoyan sobre la mesa y no se interpenetran entre sí.
4. **Dado** la etiqueta de nombre y estado, **cuando** se muestra sobre el escritorio, **entonces**
   es legible, no recorta su contenido y no tapa la pantalla ni el mobiliario de otro escritorio.
5. **Dado** un escritorio seleccionado o con hover, **cuando** se activa el resaltado, **entonces**
   el anillo de selección es visible y no queda oculto por props, silla o pared.

---

### Historia de usuario 2 - Accesorios de pared alineados y sin solapamientos (Prioridad: P2)

Como operador, quiero que la ventana, el rótulo, el reloj, la pizarra, el mosaico y la puerta estén
montados de forma ordenada sobre sus paredes, sin pisarse ni flotar, para que el fondo de la oficina
se perciba cuidado y no distraiga de la supervisión.

**Por qué esta prioridad**: los accesorios enmarcan la escena y cualquier solapamiento (reloj sobre
rótulo) se percibe inmediatamente como un defecto de acabado.

**Prueba independiente**: con cualquier número de agentes, revisar las paredes a 1280x800 y
1024x768: separación reloj–rótulo, apoyo en el plano de pared, contenido del reloj/pizarra/rótulo y
ausencia de recortes. No depende de la composición interna de los escritorios.

**Escenarios de aceptación**:

1. **Dado** el reloj y el rótulo de la pared trasera, **cuando** se observa la pared, **entonces**
   ambos aparecen completos y separados, sin invadirse ni ocultarse.
2. **Dado** cualquier accesorio montado (ventana, rótulo, reloj, pizarra, mosaico, puerta),
   **cuando** se inspecciona su unión con la pared, **entonces** está apoyado en el plano, sin
   flotar, hundirse ni producir parpadeo de profundidad.
3. **Dado** el reloj y la pizarra, **cuando** se consultan, **entonces** el primero muestra la hora
   local real y la segunda las tareas reales, sin contenido inventado.
4. **Dado** el rótulo de la oficina, **cuando** se lee a 1024x768, **entonces** su texto es legible
   y no queda tapado por otros accesorios ni por etiquetas de agente.
5. **Dado** cualquier accesorio de pared, **cuando** se compara con los demás, **entonces** mantiene
   una alineación y una separación visual coherentes con el resto de la pared.

---

### Historia de usuario 3 - Composición estable en todos los encuadres y estados (Prioridad: P3)

Como operador, quiero que las correcciones se mantengan al cambiar el número de agentes, el tamaño
de pantalla, la selección, el zoom o el estado de cada agente, para que la oficina se vea bien en
cualquier situación real de uso.

**Por qué esta prioridad**: las correcciones de mobiliario y pared pueden romperse con 1 agente, con
10 agentes, en móvil o al hacer zoom; la estabilidad es lo que convierte el arreglo en duradero.

**Prueba independiente**: abrir la escena con 1, 2, 3+ y 10 agentes a 1280x800, 1024x768 y 390x844,
seleccionar escritorios, hacer zoom/pan y activar estados; comprobar que no aparecen recortes,
solapamientos nuevos ni huecos muertos. No depende de cambios de datos ni de integraciones.

**Escenarios de aceptación**:

1. **Dado** 1 agente, **cuando** se carga la escena, **entonces** el escritorio queda centrado y los
   accesorios de pared mantienen una composición equilibrada, sin huecos ni amontonamientos.
2. **Dado** 10 agentes, **cuando** se distribuyen los escritorios, **entonces** no se solapan entre
   sí, con sus props, con las paredes ni con las etiquetas.
3. **Dado** un cambio de selección, hover, estado o zoom, **cuando** se inspecciona el escritorio,
   **entonces** las correcciones siguen vigentes y el resaltado no introduce recortes.
4. **Dado** un viewport de 390x844, **cuando** se abre el cajón y se navega por la escena,
   **entonces** no aparecen recortes de escritorios ni de accesorios de pared.
5. **Dado** el modo de compatibilidad gráfica o el resplandor apagado por rendimiento, **cuando** se
   renderiza la escena, **entonces** las correcciones visuales se mantienen y el rendimiento no se
   degrada.

### Casos límite

- Un solo agente: el escritorio y las paredes no deben quedar desequilibrados ni con espacios vacíos
  extraños.
- Diez o más agentes: densidad máxima sin solapamientos ni etiquetas fuera de la escena.
- Nombres de agente largos y estados con etiqueta extensa (`waiting_approval`).
- Selección y hover simultáneos con zoom alto o cámara desplazada.
- Cambio de estado mientras la etiqueta o la pantalla se reconstruyen.
- Reloj en cambio de hora o medianoche; pizarra sin tareas.
- Contenido del proveedor con textos largos en el monitor/panel.
- Modo de compatibilidad gráfica, resplandor apagado por rendimiento y movimiento reducido.
- Ventanas pequeñas, zoom del navegador al 200 % y cajón móvil abierto.
- Accesorios tapados total o parcialmente por escritorios en primer plano.

## Requisitos

### Requisitos funcionales

**Escritorios**

- **FR-001**: Cada agente DEBE tener exactamente un escritorio, situado sobre la base del diorama y
  sin solaparse con otros escritorios, con las paredes ni con el borde del escenario.
- **FR-002**: Todos los props del escritorio (monitor, teclado, lámpara, taza, papeles y silla)
  DEBEN apoyar sobre la superficie o el suelo correspondiente, sin flotación ni penetración
  apreciable a la escala de la cámara.
- **FR-003**: La minifigura DEBE estar situada frente al monitor y al teclado, sin atravesar la
  silla, la mesa ni otros props, y con una postura coherente con el estado mostrado.
- **FR-004**: La silla DEBE quedar alineada con la minifigura y el escritorio, sin recortar ni ser
  recortada por la mesa o el agente.
- **FR-005**: La pantalla del monitor DEBE orientarse hacia el agente y, a la vez, permitir que el
  operador reconozca el estado desde el ángulo isométrico; si ambas cosas compiten, la composición
  DEBE ajustarse para conservar las dos lecturas.
- **FR-006**: El teclado DEBE estar en el lado del agente y a su alcance, sin que el monitor u otro
  objeto se interponga entre ambos.
- **FR-007**: Lámpara, taza, papeles y teclado NO DEBEN interpenetrarse entre sí ni con la mesa, y
  DEBEN mantener una distribución estable entre escritorios.
- **FR-008**: La etiqueta de nombre y estado DEBE ser legible sobre el escritorio, sin recortarse en
  los encuadres objetivo y sin tapar la pantalla, el agente ni el mobiliario de otro escritorio.
- **FR-009**: El anillo de selección y el resaltado de hover DEBEN ser visibles alrededor del
  escritorio y no quedar ocultos por props, silla, pared u otros escritorios.
- **FR-010**: Los escritorios DEBEN conservar una separación libre suficiente para 1, 2, 3+ y 10
  agentes, sin que los props de uno invadan el espacio del siguiente.

**Accesorios de pared**

- **FR-011**: Cada accesorio de pared DEBE estar montado sobre el plano de su pared, sin flotar,
  hundirse ni producir artefactos de profundidad.
- **FR-012**: Los accesorios de pared NO DEBEN solaparse entre sí; en particular, el reloj DEBE
  quedar completamente separado del rótulo y de la ventana.
- **FR-013**: Ventana, rótulo, reloj, pizarra, mosaico y puerta DEBEN permanecer completos dentro de
  los límites de su pared y no quedar recortados por columnas, vigas ni escritorios.
- **FR-014**: El reloj DEBE seguir mostrando la hora local real y actualizarse sin salir de su
  soporte.
- **FR-015**: La pizarra DEBE seguir reflejando las tareas reales y su estado, con un estado vacío
  legible cuando no haya tareas.
- **FR-016**: El rótulo DEBE ser legible a 1024x768 y conservar el texto y la identidad actuales.
- **FR-017**: Ningún accesorio de pared DEBE quedar tapado por etiquetas de agente, minifiguras o
  props; si la composición lo provoca, DEBE reajustarse.
- **FR-018**: La distribución de accesorios DEBE mantener una jerarquía y una separación visual
  coherentes, sin amontonamientos ni huecos desproporcionados en ninguna pared.

**Composición y regresión**

- **FR-019**: Las correcciones DEBEN mantenerse con 1, 2, 3+ y 10 agentes, a 1280x800, 1024x768 y
  390x844, así como con selección, hover, zoom, pan y estados cambiantes.
- **FR-020**: La funcionalidad NO DEBE alterar datos, integraciones, actualizaciones en vivo ni
  persistencia; sigue mostrando exclusivamente datos reales.
- **FR-021**: La escena DEBE mantener la identidad LEGO isométrica, el tema oscuro y los materiales
  actuales; no se introduce un rediseño de estilo.
- **FR-022**: La corrección NO DEBE degradar el rendimiento: 60 fps en un equipo de gama media con
  3+ agentes, sin trabajo nuevo por frame que escale con el número de props.
- **FR-023**: Los estados `available`, `working`, `waiting_approval`, `error` y `disconnected`
  DEBEN seguir representándose en el escritorio sin que las correcciones oculten sus señales.
- **FR-024**: Las animaciones de selección, hover y entrada DEBEN respetar la preferencia de
  movimiento reducido y no introducir recortes al corregir la composición.

### Entidades clave

- **Escritorio**: puesto de un agente compuesto por superficie, silla, minifigura, monitor,
  teclado, lámpara, taza, papeles, etiqueta y anillo de selección; debe ser una composición física
  coherente.
- **Accesorio de pared**: elemento montado en una pared (ventana, rótulo, reloj, pizarra, mosaico,
  puerta) con su plano, alineación, separación y contenido propio.
- **Etiqueta de agente**: placa flotante con nombre y estado; su anclaje y tamaño condicionan la
  legibilidad y los solapamientos.
- **Encuadre**: combinación de número de agentes, viewport y cámara que determina si las
  correcciones se mantienen visibles.
- **Señal de estado**: color, icono y animación que identifican el estado del agente y no deben
  quedar ocultos por los ajustes de mobiliario.

## Fuera de alcance

- Añadir mobiliario o accesorios nuevos que no existan ya en la escena.
- Rediseñar el estilo visual, la paleta o la identidad LEGO isométrica.
- Cambiar la distribución general de la oficina, el número de escritorios o el concepto del diorama.
- Modificar datos, integraciones, actualizaciones en vivo, persistencia o lógica de negocio.
- Cambiar el comportamiento de las tareas, aprobaciones o estados.
- Añadir nuevas dependencias o assets externos.

## Criterios de éxito

### Resultados medibles

- **SC-001**: 0 solapamientos entre accesorios de pared en las capturas de 1280x800 y 1024x768.
- **SC-002**: 0 flotaciones o penetraciones visibles en la auditoría de escritorios con 1, 2, 3+ y
  10 agentes.
- **SC-003**: El 100 % de los escritorios auditados presenta al agente frente al monitor y al
  teclado, sin atravesar mobiliario.
- **SC-004**: El 100 % de las etiquetas de agente es legible y no tapa la pantalla ni el mobiliario
  de otro escritorio en los encuadres objetivo.
- **SC-005**: El 100 % de los accesorios de pared aparece completo, apoyado y separado del resto en
  las capturas de referencia.
- **SC-006**: La escena mantiene 60 fps en un equipo de gama media con 3+ agentes.
- **SC-007**: Las capturas a 1280x800, 1024x768 y 390x844 no muestran recortes ni zonas muertas de
  escritorios o accesorios.
- **SC-008**: La entrega supera las verificaciones de calidad del proyecto y no altera datos,
  integraciones ni persistencia.
- **SC-009**: Los flujos de selección, hover, estados, creación/cancelación de tarea y aprobación
  siguen funcionando sin regresiones visibles.
- **SC-010**: Una revisión visual de 5 minutos no encuentra defectos evidentes de montaje en
  escritorios ni en paredes.

## Supuestos

- El alcance es una corrección visual y geométrica de los elementos existentes, no un rediseño de la
  escena.
- La auditoría inicial parte de defectos conocidos —reloj solapado con el rótulo, relación
  agente–monitor–teclado incoherente y props sin apoyo consistente— y cualquier defecto adicional
  que aparezca en la revisión se incluye en la corrección.
- Se conservan los accesorios de pared actuales y su contenido real (hora, tareas, rótulo).
- No se modifican datos, integraciones, actualizaciones en vivo ni persistencia; la escena sigue
  mostrando solo datos reales.
- No se añaden dependencias ni assets externos; los materiales y geometrías compartidos se mantienen.
- Los encuadres de referencia son 1280x800 y 1024x768, con móvil a 390x844 y zoom de navegador al
  200 % como comprobación adicional.
- El objetivo de rendimiento se mide en un equipo de gama media con gráfica integrada.
- La preferencia de movimiento reducido se toma del sistema operativo del operador.
- Cualquier ajuste de posición debe respetar la cámara isométrica y la estética de diorama LEGO.
