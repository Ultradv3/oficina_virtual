# Constitución de Agent Office

<!--
Sync Impact Report
==================
Versión: sin ratificar (plantilla) → 1.0.0
Tipo de cambio: MAJOR (ratificación inicial)
Principios añadidos:
  I.   Integración real, sin datos simulados (NO NEGOCIABLE)
  II.  Núcleo estable, adaptadores como única frontera
  III. Seguridad y control humano
  IV.  Una sola fuente de verdad observable
  V.   Presupuesto de rendimiento y accesibilidad
Secciones añadidas:
  - Restricciones de stack y plataforma
  - Flujo de desarrollo y puertas de calidad
Secciones eliminadas: ninguna (se sustituyen los marcadores de la plantilla)
TODOs diferidos: ninguno
Notas: plantilla resuelta desde la capa core (sin presets ni capas de extensión);
no hay hooks before_constitution ni after_constitution registrados
(.specify/extensions.yml no existe).
Este informe es material temporal de revisión: eliminarlo antes de confirmar la enmienda.
-->

## Principios Fundamentales

### I. Integración real, sin datos simulados (NO NEGOCIABLE)

Agent Office existe para supervisar agentes de IA reales. Todo lo que la interfaz muestra
DEBE originarse en un adaptador conectado a un servicio real (`opencode serve` hoy; otros
CLI compatibles en el futuro) o en la base de datos que refleja esas interacciones.

Reglas no negociables:

- `app/` y `server/` NO DEBEN contener agentes, tareas, aprobaciones, eventos, estados ni
  marcas de tiempo simulados, ni rutas que siembren datos de demostración en SQLite.
- Sin conexión, la oficina DEBE mostrarse vacía o en error accionable. NUNCA debe aparecer
  poblada con contenido ficticio que el operador pueda confundir con actividad real.
- Una acción solo se presenta como exitosa cuando el servicio remoto la confirmó
  (`confirmed: true`). Los fallos se muestran con el error real, sin degradarlos a silencio.
- Los estados `available`, `working`, `waiting_approval`, `error` y `disconnected` se derivan
  de hechos del adaptador y de la base de datos; no de heurísticas inventadas en la UI.
- Las capturas o datos estáticos de diseño pueden existir en `docs/`, pero NUNCA en rutas de
  ejecución del producto.

**Razón**: la utilidad del producto es la confianza operativa. Un panel que inventa estado es
más peligroso que un panel vacío.

**Verificación**: al detener el servidor remoto, la oficina debe quedar vacía o desconectada;
una tarea solo puede figurar como completada si el adaptador observó ese estado.

### II. Núcleo estable, adaptadores como única frontera

Toda integración con un proveedor externo entra por el contrato `AgentAdapter`
(`server/adapters/types.ts`) y se registra con `registerAdapterFactory`. Añadir un adaptador
NO DEBE exigir cambios en `runtime.ts`, en la API, en el hub SSE ni en la UI.

Reglas no negociables:

- El adaptador es la única frontera de traducción: produce `RemoteAgent`, `CreatedTask`,
  `RemoteMessage` y `NormalizedEvent`. Los formatos propietarios del proveedor no salen del
  adaptador.
- Las capacidades declaradas DEBEN ser reales (`agents:list`, `tasks:create`, `tasks:cancel`,
  `approvals:respond`, `history:read`). El núcleo responde `409` cuando falta una capacidad y
  la UI oculta o deshabilita lo no soportado; nunca simula la acción.
- El contrato obligatorio es `connect`, `disconnect`, `listAgents`, `createTask`,
  `cancelTask`, `respondApproval` e `isConnected`; `getMessages` es opcional y se anuncia con
  `history:read`.
- El núcleo depende de la interfaz, no de implementaciones concretas. Un adaptador ausente o
  desconectado no debe romper a los demás.
- Añadir un proveedor debe resolverse con un archivo de adaptador, su registro y una entrada de
  configuración; si hace falta tocar el núcleo, la propuesta está mal diseñada.

**Razón**: la extensibilidad sin tocar el núcleo es lo que permite incorporar Hermes u otros CLI
sin reescribir el producto ni duplicar lógica de negocio.

### III. Seguridad y control humano

El navegador nunca es una superficie de ejecución privilegiada: solo habla con la API de Agent
Office, y el servidor decide qué se puede hacer.

Reglas no negociables:

- El navegador NUNCA ejecuta comandos ni accede directamente al servicio de agentes. Solo
  existen las acciones del adaptador: crear tarea, cancelar tarea y responder aprobación.
- Si `AGENT_OFFICE_TOKEN` está definido, `/api/*` DEBE exigir `Authorization: Bearer`
  (excepto `/api/health`) con comparación en tiempo constante. En despliegues accesibles el
  token es obligatorio y se sirve por HTTPS.
- Los secretos NO se persisten ni se devuelven: `config.password` se elimina antes de guardar y
  de responder, y todo detalle se redacta antes de persistirse o difundirse.
- Las acciones sensibles (crear, cancelar, aprobar, rechazar, reconectar) DEBEN tener rate
  limit y auditoría. La auditoría registra actor, acción, entidad, detalle redactado y
  timestamp; una acción sensible sin registro de auditoría se considera incompleta.
- Las aprobaciones humanas solo se ofrecen cuando el servicio remoto las solicita. El sistema
  NUNCA aprueba automáticamente; el operador decide `approve` o `reject`.
- Docker Compose publica en `127.0.0.1` por defecto y no se habilita CORS abierto.
- Toda acción sensible nueva nace con token, rate limit, redacción y auditoría; ninguna de esas
  cuatro garantías es opcional.

**Razón**: el producto puede lanzar trabajo real en un agente con acceso al sistema de archivos.
La seguridad y la intervención humana son parte del comportamiento, no un extra.

### IV. Una sola fuente de verdad observable

SQLite (WAL) es la fuente de verdad local de conexiones, agentes, tareas, eventos,
aprobaciones y auditoría. El servicio remoto es la fuente de verdad de sesiones y mensajes en
vivo. La UI no crea una tercera copia divergente.

Reglas no negociables:

- El servidor normaliza, persiste y solo después difunde (`recordEvent` → `broadcast`). La UI se
  refresca por SSE y por lecturas REST (`/api/state`, `/api/agents/:id`, `/api/tasks/:id`).
- Cada dato se muestra desde una única fuente: se prohíbe duplicar el mismo hecho con dos
  etiquetas o dos chips que puedan contradecirse.
- El stream SSE se reconecta con backoff y heartbeat; una caída del stream no corrompe el
  estado, porque la UI se resincroniza con las lecturas REST.
- Las relaciones son explícitas (`tasks.session_id`) y los duplicados se deduplican (por
  ejemplo, `approvals` único por `session_id` + `external_id`).
- Los tiempos se almacenan como epoch en milisegundos; la UI los formatea en `es-ES` y los
  documentos usan fechas ISO 8601 (`YYYY-MM-DD`).
- La retención está acotada: los eventos se limitan y purgan, y los payloads se truncan y
  redactan. Ningún registro crece sin límite.
- Toda mutación de estado emite un evento observable; todo lo mostrado debe poder rastrearse a
  una fila de la base o a una respuesta real del adaptador.

**Razón**: sin una fuente de verdad única no hay auditoría fiable ni depuración posible en un
sistema que mezcla estado remoto, persistencia local y streaming.

### V. Presupuesto de rendimiento y accesibilidad

La escena 3D es la identidad del producto, pero nunca a costa de la operación ni de la salud
del operador.

Reglas no negociables:

- `three` se importa siempre desde `three/webgpu`; la escena mantiene un único camino de código
  para WebGPU y su fallback automático a WebGL2.
- Presupuesto de rendimiento: 60 fps en GPU integrada, DPR limitado a 1.75, materiales y
  geometrías compartidos por caché, shadow map estático para la escena fija, y texturas de
  estado regeneradas solo cuando cambian nombre o estado.
- Ningún trabajo por frame debe escalar con el histórico de eventos: la actividad se pinta por
  paneles HTML, no en el canvas.
- La UI DEBE respetar `prefers-reduced-motion` (CSS y escena), ofrecer foco visible, mantener
  contraste AA (al menos 4.5:1 en textos de 14 px o menos), etiquetar con ARIA los controles de
  icono y no romperse a 1024x768 ni a 1280x800.
- Si WebGPU y WebGL fallan, la supervisión por paneles debe seguir disponible: el canvas es una
  mejora, no un requisito para operar.
- Las microinteracciones duran 250 ms o menos, con curvas propias y sin saltos; los estados
  vacío, carga y error están diseñados explícitamente.

**Razón**: el producto se usa mientras otros agentes trabajan; una escena que consume la GPU o
ignora la accesibilidad degrada la supervisión real.

## Restricciones de stack y plataforma

- Node.js 22 o superior y npm 10 o superior; Nuxt 4 (compatibility date 2026-10-24), Vue 3.5,
  TresJS 5.10, three r186 y better-sqlite3. TypeScript en modo `strict`.
- El cliente vive en `app/`, el servidor Nitro en `server/` y la persistencia en `data/`
  (ignorada por git). `tsconfig.json` extiende la configuración generada por Nuxt.
- No se añaden dependencias de runtime sin una justificación explícita en el plan de la
  funcionalidad. Las fuentes self-hosted y utilidades pequeñas y auditables están permitidas si
  se justifican.
- Un solo nodo: SQLite local, sin colas, brokers ni microservicios. La escala horizontal no es
  un objetivo del MVP.
- Toda variable de entorno nueva se documenta en `.env.example` y en el README antes de usarse.
  El token vacío queda restringido a desarrollo local; en cualquier despliegue accesible se exige
  token y HTTPS.
- Idioma del producto y de la documentación: español (es-ES) para UI, errores, README y
  comentarios; los identificadores técnicos conservan su forma estándar.
- Docker: imagen de la app y perfil opcional `with-opencode`, sin secretos incrustados y con
  volúmenes persistentes para datos y credenciales.
- Fuera del MVP por diseño: orquestador autónomo, planificación multiagente, ejecución
  arbitraria de comandos desde el navegador, agentes simulados, arquitecturas distribuidas,
  adaptador Hermes/CLI genérico, selector de modelo en UI y RBAC multiusuario. Incorporar
  cualquiera de ellos exige una enmienda a esta constitución.

## Flujo de desarrollo y puertas de calidad

- Toda funcionalidad no trivial pasa por Spec Kit: `/speckit-specify` → `/speckit-plan` →
  `/speckit-tasks` → `/speckit-implement`. El plan incluye la comprobación de esta constitución
  y justifica cualquier desviación.
- Antes de implementar se fijan alcance, criterios de aceptación y no objetivos. Los briefs de
  trabajo viven en `docs/`.
- Puertas obligatorias antes de dar por terminado un cambio:
  - `npm run typecheck` y `npm run build` en verde.
  - Si el cambio toca API o autenticación: build de producción con token, comprobando `401` sin
    Bearer y `200` con él.
  - Si el cambio toca Docker: `docker build` de la imagen afectada.
  - Si el cambio toca integración: prueba manual contra `opencode` real (conectar, descubrir
    agentes, crear tarea, cancelar, aprobar y reconectar).
- No existe todavía una suite automatizada. Introducirla es una decisión planificada y
  justificada; cuando exista, sus pruebas pasan a ser puerta obligatoria y no se relajan las
  anteriores.
- La documentación se mantiene sincronizada: todo cambio de comportamiento, configuración o API
  actualiza `README.md` y `.env.example` en el mismo cambio.
- Commits atómicos con mensaje descriptivo. Nunca se versionan bases `data/*.db`, `.env`, logs
  ni artefactos de build.
- La revisión verifica estos principios y los criterios de aceptación de la spec. Un cambio que
  los contradice no se integra sin una enmienda previa a la constitución.

## Gobernanza

Esta constitución prevalece sobre cualquier otra práctica, documento o preferencia local. Ante
un conflicto, gana la constitución.

- **Enmiendas**: se proponen con `/speckit-constitution`, documentan motivo, impacto y
  alternativas descartadas, y requieren la aprobación del propietario del proyecto. Toda
  enmienda actualiza la fecha de última modificación.
- **Versionado semántico**: MAJOR elimina o redefine principios de forma incompatible; MINOR
  añade un principio o sección, o amplía materialmente la guía; PATCH aclara redacción sin
  cambiar la semántica. `1.0.0` es la ratificación inicial.
- **Cumplimiento**: planes, tareas y revisiones DEBEN comprobar los principios. Una desviación
  se registra con su justificación y fecha; la complejidad debe justificarse y YAGNI es el
  criterio por defecto.
- **Guía operativa**: `README.md` describe arquitectura, configuración y verificación; `docs/`
  contiene briefs de funcionalidad. Las plantillas de `.specify/templates/` son de solo lectura
  y no se editan como parte de una funcionalidad.

**Version**: 1.0.0 | **Ratified**: 2026-10-24 | **Last Amended**: 2026-10-24
