# Especificación de funcionalidad: Mejoras premium de UI/UX y escena

**Rama de funcionalidad**: `001-premium-ui-scene`

**Creada**: 2026-10-24

**Estado**: Draft

**Entrada**: Descripción del usuario: "Implementar las mejoras premium de UI/UX y escena descritas en docs/premium-improvements.md"

**Fuente**: `docs/premium-improvements.md` (problemas detectados, fases, no objetivos y criterios de aceptación).

## Escenarios de usuario y pruebas

Esta funcionalidad eleva la percepción visual y la legibilidad de Agent Office sin cambiar su
base funcional: mismos datos, mismos flujos, misma identidad LEGO isométrica. Se entrega en
cuatro historias independientes y priorizadas; cada una puede implementarse, probarse y
demostrarse por separado.

### Historia de usuario 1 - Panel operativo legible y premium (Prioridad: P1)

Como operador que supervisa varios agentes, quiero que la tipografía, las métricas, los estados
y las pestañas del HUD y del panel se lean con jerarquía y respondan con fluidez, para
interpretar el estado de la oficina de un vistazo y sin fatiga visual.

**Por qué esta prioridad**: la legibilidad y la jerarquía son la base de toda la experiencia;
sin ellas, cualquier mejora visual posterior no se percibe. Es también el fundamento que
comparten las demás historias (tipografía, tokens, foco y contraste).

**Prueba independiente**: con un servidor real y dos agentes, revisar a 1024x768 y 1280x800 la
tipografía renderizada, las métricas, la deduplicación del estado de conexión, las pestañas, los
botones, los badges y la navegación por teclado. No depende de la escena ni del cajón móvil.

**Escenarios de aceptación**:

1. **Dado** el HUD con dos agentes conectados, **cuando** carga la aplicación, **entonces** se
   renderiza la tipografía de marca (no una fuente del sistema) y las métricas aparecen con
   cifras tabulares actualizadas en vivo.
2. **Dado** un operador que navega solo con teclado, **cuando** recorre la barra superior, las
   pestañas y el panel, **entonces** cada control muestra foco visible y puede activarse.
3. **Dado** un cambio de pestaña, **cuando** el operador selecciona otra sección, **entonces** el
   indicador se desplaza con animación y el contenido hace una transición suave de 180 ms o
   menos, sin saltos de layout.
4. **Dado** cualquier texto de 14 px o menos, **cuando** se audita el contraste, **entonces**
   cumple al menos 4.5:1 sobre su fondo.
5. **Dado** el estado de conexión de un agente, **cuando** se muestra en la misma pantalla,
   **entonces** aparece una sola vez como fuente de verdad visible.
6. **Dado** el sistema de diseño documentado, **cuando** se revisa la interfaz, **entonces**
   tipografía, espaciado, radios y curvas de easing coinciden con los valores documentados.

---

### Historia de usuario 2 - Primer contacto y recuperación con estados diseñados (Prioridad: P2)

Como operador que abre la oficina por primera vez o pierde la conexión, quiero ver estados de
vacío, carga y error diseñados y accionables, para entender qué pasa y cómo recuperarme sin
quedarme ante una pantalla vacía o un spinner genérico.

**Por qué esta prioridad**: es la primera impresión del producto y el camino de recuperación
cuando algo falla; los estados actuales no están diseñados y transmiten abandono.

**Prueba independiente**: detener el servidor remoto y recargar; simular una carga lenta;
provocar un error de conexión; verificar que cada estado explica la situación y ofrece la
acción siguiente. No depende del encuadre de cámara ni de la identidad del agente.

**Escenarios de aceptación**:

1. **Dado** que no hay agentes conectados, **cuando** carga la vista principal, **entonces** se
   muestra un estado vacío diseñado con explicación, el comando de arranque del servicio y una
   acción de conexión, sin agentes ni estados inventados.
2. **Dado** que la carga inicial tarda, **cuando** la aplicación aún no tiene datos, **entonces**
   se muestra un estado de carga con la forma del contenido (no un spinner aislado) que no
   provoca saltos al terminar.
3. **Dado** un fallo de conexión o de lectura, **cuando** se muestra el error, **entonces** se
   indica la causa, se ofrece reintentar y el reintento muestra progreso y evita envíos
   duplicados.
4. **Dado** el panel lateral, la sesión de tarea o la auditoría, **cuando** no hay datos,
   **entonces** cada vista muestra su propio estado vacío con lenguaje operativo en español.

---

### Historia de usuario 3 - Escena isométrica encuadrada como product shot (Prioridad: P3)

Como operador, quiero que la escena LEGO se presente intencionadamente encuadrada, con contexto
de suelo, iluminación y detalle, para que la oficina se perciba como un producto cuidado y no
como un diorama flotando en el vacío.

**Por qué esta prioridad**: la escena es la identidad del producto; una presentación descuidada
anula la percepción premium aunque el panel sea correcto.

**Prueba independiente**: abrir con 0, 1, 2 y 3+ agentes a 1280x800 y 1024x768, capturar la
escena y comprobar encuadre, entrada, etiquetas y estabilidad de rendimiento. No depende de los
estados de error ni del cajón móvil.

**Escenarios de aceptación**:

1. **Dado** un número cualquiera de agentes, **cuando** entra el operador, **entonces** la cámara
   encuadra la escena con margen para el HUD y sin recortes, ajustándose a 1, 2 y 3+ agentes.
2. **Dado** el primer render de la escena, **cuando** aparece, **entonces** hay un acercamiento
   suave de 600 a 900 ms y los escritorios aparecen escalonados; con la preferencia de movimiento
   reducido activa, la cámara aparece directamente encuadrada y sin escalonado.
3. **Dado** un escritorio seleccionado, **cuando** cambia la selección, **entonces** la cámara y
   el resaltado transicionan suavemente sin desorientar.
4. **Dado** el diorama, **cuando** se observa el fondo, **entonces** el suelo y el horizonte
   aportan contexto (rejilla sutil, sombra de contacto, viñeta asimétrica) y el conjunto no
   parece flotar.
5. **Dado** el diorama, **cuando** se observan los materiales de cerca, **entonces** hay
   microvariación de rugosidad y desgaste que evita el aspecto de plástico uniforme.
6. **Dado** un equipo con gráfica integrada, **cuando** la escena está en reposo y con tres
   agentes, **entonces** la animación se mantiene fluida a 60 fps y las etiquetas se leen nítidas.

---

### Historia de usuario 4 - Identidad del agente, storytelling y uso móvil (Prioridad: P4)

Como operador, quiero reconocer a cada agente por su minifigura, ver la oficina reaccionar a la
actividad real y usar el panel cómodamente en pantallas pequeñas, para conectar los datos con la
escena y supervisar también desde el móvil.

**Por qué esta prioridad**: cierra la brecha entre la escena y los datos, aporta personalidad y
completa el acceso; depende de que la escena y el panel ya estén pulidos.

**Prueba independiente**: comparar el avatar de cada agente con su minifigura; comprobar el
reloj, la pizarra y la iluminación reactiva; abrir a 390x844 y verificar el cajón del panel y la
ausencia de desplazamiento horizontal. No depende de los estados de error ni del encuadre
automático.

**Escenarios de aceptación**:

1. **Dado** un agente seleccionado, **cuando** se muestra su identidad en el panel, **entonces**
   el avatar deriva de su minifigura 3D (no de iniciales) y mantiene una alternativa textual
   accesible si la escena no está disponible.
2. **Dado** el reloj y la pizarra de la escena, **cuando** se consultan, **entonces** el reloj
   muestra la hora local real y la pizarra refleja las tareas y estados reales, con un estado
   propio cuando no hay tareas.
3. **Dado** un cambio de estado agregado de la oficina, **cuando** los agentes pasan de activos a
   inactivos o viceversa, **entonces** la iluminación y el ambiente reaccionan de forma sutil y
   sin retrasar la interacción.
4. **Dado** el sonido ambiental, **cuando** el operador abre la aplicación por primera vez,
   **entonces** está desactivado, requiere activación explícita y recuerda la preferencia durante
   la sesión.
5. **Dado** un ancho de pantalla de 390 px, **cuando** el operador abre el panel, **entonces** se
   presenta como cajón superpuesto que se abre y se cierra sin ocultar el HUD de forma
   permanente ni provocar desplazamiento horizontal.
6. **Dado** un diálogo o el cajón abierto, **cuando** el operador pulsa Escape, **entonces** se
   cierra y el foco vuelve al control desde el que se abrió.

### Casos límite

- Oficina con 0 agentes, con 1, con 2 y con 10 o más: el encuadre, las métricas y la pizarra
  deben seguir siendo legibles.
- Nombres de agente, descripciones o títulos de tarea muy largos: las etiquetas 3D y las filas
  del panel no deben desbordar ni romper el layout.
- Desconexión a mitad de sesión, actualizaciones en vivo interrumpidas o reconectando: los
  estados deben ser honestos y la UI debe resincronizarse sin duplicar información.
- La carga de fuentes falla o es lenta: la UI sigue siendo legible con la pila de respaldo, sin
  salto de layout perceptible.
- Movimiento reducido activo: sin dolly-in, sin escalonado y sin animaciones no esenciales; la
  app sigue siendo comprensible.
- Navegador sin aceleración 3D disponible: la supervisión por paneles sigue operativa y el avatar
  tiene alternativa textual.
- Zoom del navegador al 200 % y ventanas de poca altura: sin recortes de controles esenciales.
- Cambio de hora o de zona horaria durante la sesión, y timestamps que cruzan medianoche.
- Selección de escritorio mientras la cámara aún se está encuadrando, y actualizaciones de
  aprobaciones en vivo durante una animación.
- Reintentos repetidos de conexión: sin duplicar peticiones ni toasts.

## Requisitos

### Requisitos funcionales

**Fundamentos de diseño**

- **FR-001**: La interfaz DEBE mostrar las tipografías de marca desde el primer render, sin
  depender de fuentes del sistema ni provocar saltos de layout perceptibles.
- **FR-002**: El proyecto DEBE disponer de un sistema de diseño documentado y versionado que
  defina escala tipográfica, escala de espaciado (4/8/12/16/24/32), radios (8/10/14), curvas de
  easing y tokens de color, y esa documentación DEBE ser la referencia de la UI.
- **FR-003**: Todos los elementos interactivos DEBEN mostrar un indicador de foco visible y
  consistente al navegar con teclado.
- **FR-004**: Todo texto de 14 px o menos DEBE cumplir un contraste mínimo de 4.5:1 sobre su
  fondo.
- **FR-005**: Con la preferencia de movimiento reducido activa, la UI NO DEBE reproducir
  animaciones no esenciales ni movimientos de cámara; sin ella, las transiciones DEBEN seguir los
  valores del sistema de diseño.

**HUD y panel**

- **FR-006**: El HUD superior DEBE mostrar métricas compactas con cifras tabulares y estado en
  vivo, visibles a 1024x768 sin ocultarse en tablet.
- **FR-007**: Cada dato operativo (estado de conexión, recuentos, estado del agente, sesión) DEBE
  aparecer una sola vez por contexto visible.
- **FR-008**: El estado DEBE comunicarse siempre con icono o forma, color y etiqueta; NUNCA solo
  con color.
- **FR-009**: Las pestañas DEBEN tener un indicador animado compartido y una transición de
  contenido con desenfoque suave de 180 ms o menos, sin saltos de layout.
- **FR-010**: Los botones DEBEN tener estados hover, active (escala 0.97), foco y deshabilitado
  coherentes, conservando la jerarquía del botón primario.
- **FR-011**: Los badges DEBEN tener al menos 11 px; los timestamps DEBEN mostrarse en formato
  relativo con acceso al valor absoluto, en español (es-ES).

**Estados**

- **FR-012**: La vista principal DEBE tener estados de vacío, carga y error diseñados, con
  explicación y acción siguiente, sin spinner genérico ni texto suelto.
- **FR-013**: El estado vacío DEBE ofrecer la acción de conexión y el comando de arranque del
  servicio, sin inventar agentes ni estados.
- **FR-014**: El estado de error DEBE indicar la causa y ofrecer reintento; el reintento DEBE
  mostrar progreso y evitar envíos duplicados.
- **FR-015**: El panel lateral, la sesión de tarea y la auditoría DEBEN tener estados de vacío,
  carga y error propios y coherentes con la vista principal.
- **FR-016**: El texto propio de la interfaz DEBE estar íntegramente en español (es-ES); el
  contenido aportado por el proveedor externo se muestra tal cual y se distingue visualmente del
  texto propio.

**Escena**

- **FR-017**: La cámara DEBE encuadrar automáticamente la escena según el número de agentes y el
  tamaño del lienzo, con margen para el HUD y sin recortes.
- **FR-018**: La entrada a la escena DEBE incluir un acercamiento suave de 600 a 900 ms, y la
  selección de escritorio DEBE transicionar suavemente; ambas se desactivan con movimiento
  reducido.
- **FR-019**: El suelo y el horizonte DEBEN aportar contexto (rejilla sutil y sombra de
  contacto) y el fondo DEBE incluir una viñeta asimétrica, de modo que el diorama no parezca
  flotar.
- **FR-020**: Los elementos emisivos DEBEN tener un resplandor selectivo que refuerce estado y
  profundidad sin competir con la legibilidad del HUD. El resplandor DEBE cumplirse con la capa
  emisiva y los sprites de brillo; el bloom de pantalla completa es una mejora que solo se activa
  cuando el rendimiento sostiene el presupuesto de FR-023.
- **FR-021**: Los materiales DEBEN tener microvariación de rugosidad y desgaste, preservando la
  identidad LEGO isométrica.
- **FR-022**: Las etiquetas 3D DEBEN generarse a densidad 2x y recortarse limpiamente, con nombre
  y estado legibles a 1024x768.
- **FR-023**: La escena DEBE mantener 60 fps en un equipo con gráfica integrada con 0, 1, 2 y 3+
  agentes, sin degradar la interacción.

**Identidad y responsive**

- **FR-024**: Cada agente DEBE identificarse en los paneles con una representación visual derivada
  de su minifigura 3D, no con iniciales, con alternativa textual accesible si la escena no está
  disponible.
- **FR-025**: La escena DEBE incluir un reloj de pared con la hora local real en formato es-ES.
- **FR-026**: La pizarra o kanban de la escena DEBE reflejar tareas y estados reales del sistema,
  con un estado propio cuando no haya tareas.
- **FR-027**: La iluminación y el ambiente DEBEN reaccionar al estado agregado real de la oficina
  (activo cálido frente a inactivo frío) sin retrasar la interacción.
- **FR-028**: Los escritorios DEBEN aparecer con un escalonado al entrar en la escena, desactivado
  con movimiento reducido.
- **FR-029**: El sonido ambiental DEBE ser opcional, estar desactivado por defecto, requerir
  activación explícita y recordar la preferencia durante la sesión; NUNCA se reproduce de forma
  automática.
- **FR-030**: En pantallas de 640 px o menos, el panel DEBE presentarse como cajón superpuesto,
  abrible y cerrable, sin ocultar de forma permanente el HUD ni la escena y sin desplazamiento
  horizontal.
- **FR-031**: Los diálogos y el cajón DEBEN gestionar el foco (atraparlo al abrir y devolverlo al
  cerrar) y cerrarse con la tecla Escape.
- **FR-032**: La UI DEBE funcionar a 1024x768 y 1280x800 sin recortes ni zonas muertas, y a
  390x844 sin desplazamiento horizontal.
- **FR-033**: Las microinteracciones de UI DEBEN durar 250 ms o menos y no bloquear la
  interacción.
- **FR-034**: La funcionalidad NO DEBE alterar datos, lógica de negocio, integraciones ni
  persistencia; la UI sigue consumiendo las mismas fuentes de verdad y no introduce datos
  simulados.
- **FR-035**: El tratamiento visual DEBE preservar la identidad LEGO isométrica y el tema oscuro;
  no se introduce un tema claro conmutable.

### Entidades clave

- **Agente supervisado**: identidad visual derivada de su minifigura (color y variante), estado
  operativo, tarea actual y aprobaciones pendientes; siempre con origen en datos reales.
- **Token de diseño**: valor documentado de tipografía, espaciado, radio, easing o color; es la
  unidad de coherencia visual de toda la interfaz.
- **Estado de vista**: situación de una vista (vacío, carga, error o listo) con su mensaje, causa
  y acción siguiente.
- **Encuadre de escena**: relación entre el número de agentes y el tamaño del lienzo que determina
  la cámara y el margen reservado para el HUD.
- **Preferencia de presentación**: movimiento reducido (del sistema) y sonido (desactivado por
  defecto, recordado durante la sesión).
- **Elemento de pizarra**: tarea o sesión representada en la escena con su estado real y su
  agente asociado.

## Fuera de alcance

- Sustituir la base tecnológica o de componentes actual, o rehacer la escena con otro estilo
  visual.
- Tocar la lógica de negocio, las integraciones existentes, las actualizaciones en vivo ni la
  persistencia.
- Añadir autenticación, RBAC o gestión multiusuario.
- Nuevas funcionalidades de supervisión (nuevos tipos de tarea, planificación, orquestación).
- Internacionalización a otros idiomas o selector de idioma.
- Tema claro conmutable o rediseño de la paleta oscura.
- Sonido activado por defecto o reproducción automática.
- Analítica de producto o telemetría nueva.

## Criterios de éxito

### Resultados medibles

- **SC-001**: El 100 % de los textos de 14 px o menos cumple un contraste de al menos 4.5:1.
- **SC-002**: Un operador que usa solo el teclado alcanza y activa el 100 % de los controles
  interactivos, con foco siempre visible.
- **SC-003**: Las métricas operativas son visibles a 1024x768 y 1280x800 sin desplazamiento ni
  ocultación.
- **SC-004**: El estado de conexión aparece 0 veces duplicado en una misma pantalla.
- **SC-005**: La escena se encuadra sin recortes con 1, 2 y 3+ agentes a 1280x800 y 1024x768,
  verificado con capturas.
- **SC-006**: La escena mantiene 60 fps en un equipo con gráfica integrada en reposo y con tres
  agentes, y la interacción no se degrada al seleccionar.
- **SC-007**: La tipografía de marca es la efectivamente renderizada en las 3 cargas en frío
  verificadas, sin salto de layout perceptible.
- **SC-008**: El 100 % de las microinteracciones de UI dura 250 ms o menos; la entrada de escena
  dura entre 600 y 900 ms; con movimiento reducido hay 0 animaciones no esenciales.
- **SC-009**: El 100 % de las vistas principales (escena, agente, actividad, aprobaciones,
  auditoría y sesión) dispone de estados de vacío, carga y error propios.
- **SC-010**: A 390x844 el cajón del panel se abre y se cierra, y la aplicación no presenta
  desplazamiento horizontal.
- **SC-011**: Un operador nuevo identifica qué agente requiere aprobación y abre su sesión en
  menos de 20 segundos sin ayuda.
- **SC-012**: La entrega supera las verificaciones de calidad del proyecto y los flujos
  principales no muestran errores visibles para el usuario.

## Supuestos

- Las cuatro fases del brief (`docs/premium-improvements.md`) forman parte de esta funcionalidad;
  las historias pueden entregarse de forma incremental en el orden de prioridad.
- Se preserva la identidad LEGO isométrica, el tema oscuro y la paleta actual; el trabajo es de
  ejecución visual y de interacción, no un rediseño de marca.
- No se modifican datos, integraciones, actualizaciones en vivo ni persistencia: la UI sigue
  mostrando las mismas fuentes de verdad y nunca introduce datos simulados.
- Las fuentes de marca pueden alojarse en el propio proyecto; cualquier otra dependencia nueva
  requiere justificación y no forma parte del alcance por defecto.
- El objetivo de rendimiento se mide en un equipo de gama media con gráfica integrada, con la
  escena en reposo y con tres agentes.
- La verificación visual se realiza a 1280x800 y 1024x768; el soporte móvil se valida a 390x844
  con el panel como cajón.
- La preferencia de movimiento reducido proviene de la configuración del sistema operativo del
  operador.
- El idioma del producto es español (es-ES); los textos técnicos del proveedor externo pueden
  llegar en inglés y se muestran como contenido ajeno, no como microcopy propio.
- El sonido es una mejora opcional y apagada por defecto; no se requiere audio para completar
  ninguna tarea.
- El bloom de pantalla completa es una mejora progresiva: si el rendimiento no sostiene el
  presupuesto se apaga y se conserva el resplandor emisivo/sprites, sin incumplir FR-020.
- Las verificaciones de integración se hacen contra un servidor OpenCode real, no contra datos
  simulados.
- El trabajo se apoya en la escena, el panel y los datos reales ya existentes; no requiere
  servicios ni backend nuevos.
