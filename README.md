# Agent Office

Oficina virtual isométrica tipo LEGO para **visualizar, supervisar y controlar agentes de IA** ejecutados mediante OpenCode (y, en fases posteriores, Hermes y otros CLI compatibles).

El MVP conecta un servidor real de OpenCode, descubre sus agentes primarios y crea tareas/sesiones reales. Cada agente tiene un escritorio interactivo; al seleccionarlo se consulta su estado, tarea actual, sesiones, actividad, aprobaciones y registros.

> Estado: **MVP funcional** probado contra `opencode 1.19.0`. Sin agentes simulados: si no hay conexión, la oficina aparece vacía.

---

## 1. Qué incluye el MVP

- Oficina 3D isométrica tipo **LEGO**: diorama con baseplate y studs, paredes, ventana, rótulo, mosaico, lounge, cafetera, credenza y escritorios construidos con piezas.
- Minifiguras LEGO animadas por estado (trabajando, esperando aprobación, error) con variantes de cabello, gorra, casco y auriculares.
- Iluminación de estudio: luz clave cálida con sombras, relleno frontal, rim frío, lámparas de escritorio, tone mapping ACES y reflejos PMREM.
- Estados reales por agente: `available`, `working`, `waiting_approval`, `error`, `disconnected`.
- Integración real con OpenCode:
  - Descubrimiento de agentes primarios (`GET /agent`).
  - Creación de tareas (`POST /session` + `POST /session/{id}/prompt_async`).
  - Cancelación con confirmación (`POST /session/{id}/abort`).
  - Aprobaciones humanas (`permission.asked` → `POST /session/{id}/permissions/{permissionID}`).
  - Historial de conversación (`GET /session/{id}/message`).
  - Eventos en tiempo real por SSE (`GET /event`) con reconexión y backoff.
- Persistencia SQLite: conexiones, agentes, tareas, eventos, aprobaciones y auditoría.
- SSE propio hacia el navegador: la UI se refresca con eventos reales.
- Registro de auditoría de acciones sensibles (crear/cancelar tarea, aprobar/rechazar, reconectar).
- Capacidades declaradas por adaptador; la UI solo ofrece acciones soportadas.
- Registro de adaptadores extensible sin tocar el núcleo.
- Seguridad: token opcional para la API, rate limit, redacción de secretos, límites de tamaño y sin ejecución arbitraria desde el navegador.
- Dockerfile + Docker Compose (app y, opcionalmente, servidor OpenCode).

### Fuera del MVP (por diseño)

- Orquestador autónomo propio o planificación multiagente.
- Ejecución arbitraria de comandos desde el navegador.
- Agentes simulados o estados inventados.
- Arquitecturas distribuidas (colas, brokers, microservicios).
- Adaptador Hermes y adaptador CLI genérico (la interfaz y el registro ya están preparados).
- Selector de modelo en UI y RBAC multiusuario.

---

## 2. Arquitectura

```
┌──────────────────────────┐        SSE         ┌───────────────────────────┐
│  Navegador (Nuxt/TresJS) │ ◄───────────────── │  Nitro (API + SSE hub)    │
│  oficina + paneles       │ ─────────────────► │  auth · rate limit · audit│
└──────────────────────────┘    REST /api       └─────────────┬─────────────┘
                                                              │
                                                    Adapter registry
                                                              │
                                              ┌───────────────┴───────────────┐
                                              │  OpenCodeAdapter              │
                                              │  fetch REST + SSE /event      │
                                              └───────────────┬───────────────┘
                                                              │
                                                    ┌─────────▼─────────┐
                                                    │ opencode serve    │
                                                    │ :4096             │
                                                    └───────────────────┘

SQLite (data/agent-office.db)
  conexiones · agentes · tareas · eventos · aprobaciones · auditoría
```

Decisiones clave:

- **Un escritorio por agente primario** devuelto por OpenCode (normalmente `build`, `plan` y agentes primarios personalizados). No se inventan agentes.
- **Tareas = sesiones de OpenCode**. Se guarda la relación `task.session_id`.
- **Eventos**: el adaptador consume `/event`, normaliza y el runtime persiste y difunde. Solo se persisten eventos de sesiones gestionadas por Agent Office (evita ruido de otras TUIs).
- **SSE** en lugar de WebSocket: unidireccional, resiliente y suficiente para refrescar estado.
- **SQLite + WAL**: persistencia local, transaccional y portable para un único nodo.
- **Renderer WebGPU** (`tres: { renderer: 'webgpu' }` en `nuxt.config.ts`): la escena usa node materials de `three/webgpu`. Si el navegador no expone WebGPU, `WebGPURenderer` arranca solo con el backend WebGL2 manteniendo el mismo código y materiales.
- **Escena optimizada**: materiales y geometrías de bricks compartidos por caché de módulo, shadow map estático (la escena es fija salvo los minifigs) y DPR limitado a 1.75. Las texturas de estado (etiqueta/pantalla/glow) solo se regeneran cuando cambia nombre o estado, no en cada refresco SSE.

---

## 3. Diseño visual

- **Diorama LEGO**: base con plinto, studs instanciados (un `InstancedMesh`), placas de suelo, alfombra, paredes con juntas y remates, ventana, rótulo retroiluminado, mosaico, pizarra, puerta, sofá, mesa de café, credenza con impresora, rack de servidores, plantas y una pieza suelta.
- **Personajes**: minifiguras construidas con piezas redondeadas, torso/brazos/piernas, cara, accesorios y auriculares. Cada agente tiene color de torso propio y variante (casco, gorra, cabello).
- **Estados en el 3D**: el monitor muestra una interfaz de sesión con el color de estado, la lámpara y el LED emiten, el anillo de selección y la etiqueta cambian, y la minifigura reacciona (teclea, levanta la mano, inclina la cabeza).
- **Iluminación**: clave cálida direccional con sombra 2048 px y frustum ajustado, relleno frontal suave, rim frío, dos lámparas de escritorio con luz puntual, `ACESFilmicToneMapping`, sombras PCF y entorno `RoomEnvironment` vía PMREM para reflejos plásticos.
- **Legibilidad**: etiquetas tipo placa LEGO con nombre y estado, halos emisivos en pantallas y foco, sombras de contacto bajo el mobiliario y fondo de estudio con viñeta.
- **Escala**: hasta 9 agentes en 3 columnas y hasta 12 en 4 columnas. Al crecer se amplían suelo/alfombra, se recalcula el encuadre y se retiran lounge, café y rack si invadirían escritorios. Más de 12 requiere plantas adicionales (siguiente fase).
- **Referencias**: composición y materiales inspirados en el showroom isométrico *The Lego Verse* (Behance) y en las guías de iluminación/sombras/materiales de threejsresources.

---

## 4. Requisitos

- Node.js 22+ (probado con Node 24).
- npm 10+.
- Un servidor OpenCode accesible (`opencode serve --port 4096`).
- Modelo configurado en OpenCode o `OPENCODE_MODEL` para forzar uno por tarea.

> OpenCode 1.19 puede no tener modelo por defecto. Si las tareas fallan con `ProviderModelNotFoundError`, define `OPENCODE_MODEL=provider/modelo` (por ejemplo `deepseek/deepseek-flash`).

---

## 5. Inicio rápido (desarrollo)

```bash
npm install
cp .env.example .env      # ajusta token/modelo/directorio

# En otra terminal:
opencode serve --port 4096

# En la raíz del proyecto:
npm run dev
```

Abre `http://localhost:3000`.

Flujo de uso:

1. La barra superior muestra la conexión OpenCode y el estado del stream SSE.
2. Clic en un escritorio (o en la lista del panel) para seleccionar el agente.
3. **Asignar tarea** crea una sesión real y lanza el prompt en OpenCode.
4. Si OpenCode pide permiso, el agente pasa a `waiting_approval`; responde en **Aprobaciones**.
5. **Cancelar tarea** pide confirmación y muestra si OpenCode la confirmó o falló.
6. **Actividad** muestra eventos en tiempo real; **Auditoría** las acciones sensibles.

---

## 6. Configuración

| Variable | Por defecto | Descripción |
| --- | --- | --- |
| `OPENCODE_BASE_URL` | `http://127.0.0.1:4096` | URL del servidor OpenCode. |
| `OPENCODE_DIRECTORY` | vacío | Directorio de trabajo enviado como `?directory=` a OpenCode. Recomendado en Docker (`/workspace`). |
| `OPENCODE_MODEL` | vacío | Override de modelo para tareas (`provider/modelo`). Vacío = default del servidor. |
| `OPENCODE_SERVER_USERNAME` | `opencode` | Usuario de Basic Auth del servidor. |
| `OPENCODE_SERVER_PASSWORD` | vacío | Password de Basic Auth del servidor. |
| `AGENT_OFFICE_TOKEN` | vacío | Si se define, exige `Authorization: Bearer` en `/api/*`. El SSE acepta `?token=`. |
| `AGENT_OFFICE_DB` | `./data/agent-office.db` | Ruta del archivo SQLite. |
| `AGENT_OFFICE_CONNECTIONS` | — | JSON con varias conexiones (sustituye a `OPENCODE_BASE_URL`). |

### Varias conexiones / adaptadores

```json
[
  {
    "id": "atlas",
    "name": "Atlas",
    "adapter": "opencode",
    "enabled": true,
    "config": {
      "baseUrl": "http://127.0.0.1:4096",
      "directory": "/workspace",
      "model": "deepseek/deepseek-flash"
    }
  },
  {
    "id": "backup",
    "name": "Backup",
    "adapter": "opencode",
    "config": { "baseUrl": "http://127.0.0.1:4097" }
  }
]
```

La contraseña nunca se persiste ni se devuelve por la API (`config.password` se elimina del JSON guardado y de la respuesta).

---

## 7. API

| Método | Ruta | Uso |
| --- | --- | --- |
| `GET` | `/api/health` | Salud del servicio (pública). |
| `GET` | `/api/state` | Conexiones, agentes, tareas recientes, aprobaciones, eventos y contadores. |
| `GET` | `/api/agents/:id` | Detalle de agente + sesiones + eventos + aprobaciones. |
| `POST` | `/api/tasks` | Crea y lanza una tarea `{ agentId, title, prompt }`. |
| `GET` | `/api/tasks/:id` | Tarea + mensajes remotos + eventos + aprobaciones. |
| `POST` | `/api/tasks/:id/cancel` | Cancela y devuelve `{ confirmed, error }`. |
| `POST` | `/api/approvals/:id/respond` | `{ decision: "approve" \| "reject", remember? }`. |
| `POST` | `/api/connections/:id/reconnect` | Reconecta el adaptador. |
| `GET` | `/api/events` | SSE de eventos/estado. |
| `GET` | `/api/audit` | Registro de auditoría (`?limit=`). |

Códigos relevantes: `401` token inválido, `409` agente ocupado/desconectado o capacidad ausente, `429` rate limit, `502` fallo del adaptador.

---

## 8. Adaptadores

Contrato en `server/adapters/types.ts`:

```ts
interface AgentAdapter {
  type: string
  capabilities: Capability[]
  connect(): Promise<void>
  disconnect(): Promise<void>
  listAgents(): Promise<RemoteAgent[]>
  createTask(input): Promise<{ sessionId: string }>
  cancelTask(sessionId: string): Promise<boolean>
  respondApproval(sessionId, approvalId, decision, remember?): Promise<boolean>
  getMessages?(sessionId, limit?): Promise<RemoteMessage[]>
  isConnected(): boolean
}
```

Para añadir Hermes/CLI genérico en una fase posterior:

1. Implementa `AgentAdapter` en `server/adapters/<nuevo>.ts`.
2. Regístralo con `registerAdapterFactory('<tipo>', factory)` en `server/adapters/registry.ts`.
3. Declara solo las capacidades reales; la UI oculta lo no soportado.
4. Añade la conexión en `AGENT_OFFICE_CONNECTIONS`.
5. Los procesos CLI deben ejecutarse mediante un supervisor del servidor con allowlist y auditoría; **nunca** desde el navegador.

El núcleo (`runtime.ts`, API y UI) no cambia.

### Equipo orquestado en Markdown

El equipo vive en `.opencode/agents/`, un archivo `.md` por agente:

- `orchestrator.md`: agente por defecto; planifica, usa `todowrite` y delega con `task`.
- `builder.md`: implementa y ejecuta pruebas.
- `reviewer.md`: revisión independiente sin editar.
- `tester.md`: valida sin editar.

`opencode.json` fija `"model": "deepseek/deepseek-flash"` y `"default_agent": "orchestrator"`. Los workers usan `mode: all`, así que también aparecen como escritorios. El orquestador tiene `edit: deny` y `permission.task` limitado a esos tres workers; los workers tienen `task: deny` para evitar delegaciones recursivas.

Agent Office sigue las sesiones hijas de la herramienta `task`: crea `subtasks`, atribuye eventos, aprobaciones y cancelaciones al worker correcto y muestra la delegación en el detalle de la tarea. Por defecto oculta los nativos `build` y `plan` para mostrar solo el equipo; el botón **Nativos** del panel los vuelve a mostrar. La guía para añadir o modificar agentes está en `docs/AGENTS.md`.

---

## 9. Persistencia y auditoría

SQLite en `data/agent-office.db` (WAL). Tablas: `connections`, `agents`, `tasks`, `subtasks`, `events`, `approvals`, `audit_log`.

- Los eventos se limitan a 20.000 (se purgan los más antiguos).
- La auditoría registra actor, acción, entidad, detalle redactado y timestamp.
- Las tareas y eventos sobreviven a reinicios; las sesiones remotas se consultan de nuevo a OpenCode.

Para respaldar: copia `data/agent-office.db` (y `-wal`/`-shm` si la app está en marcha) o usa `sqlite3 .backup`.

---

## 10. Seguridad

- **Token opcional** para toda la API. En despliegues accesibles, defínelo siempre y sirve la app por HTTPS.
  - Si defines `AGENT_OFFICE_TOKEN`, abre la UI una vez como `http://localhost:3000/?token=TU_TOKEN`; se guarda en `sessionStorage` y se añade a REST y SSE.
  - `/api/health` queda pública para healthchecks.
- **Sin ejecución de comandos desde el navegador**: solo acciones del adaptador (`createTask`, `cancelTask`, `approval`).
- **Aprobaciones humanas** solo cuando OpenCode las solicita; la UI muestra el permiso y los patrones afectados.
- **Rate limit** en creación de tareas, cancelaciones, aprobaciones y reconexiones.
- **Límites** de longitud de título/prompt y de payloads de eventos; secretos redactados.
- **Sin CORS abierto**; el navegador habla solo con el backend de Agent Office.
- OpenCode expone capacidades reales del agente: ejecútalo en un contenedor/workspace acotado y con credenciales de mínimo privilegio. `opencode serve` sin password avisa de que está inseguro; usa `OPENCODE_SERVER_PASSWORD`.
- El compose publica en `127.0.0.1` por defecto.

---

## 11. Docker Compose

Solo la app (OpenCode externo en el host):

```bash
cp .env.example .env
# OPENCODE_BASE_URL=http://host.docker.internal:4096  (Docker Desktop)
docker compose up --build
```

App + OpenCode incluido (perfil `with-opencode`):

```bash
# 1) Autenticar proveedores una vez (volumen persistente)
docker compose --profile with-opencode run --rm opencode auth login

# 2) Arrancar
OPENCODE_WORKSPACE=/ruta/a/tu/repo docker compose --profile with-opencode up --build
```

- `OPENCODE_WORKSPACE` monta el repositorio que verá el agente en `/workspace`.
- Credenciales del servidor OpenCode: `OPENCODE_SERVER_PASSWORD` en `.env` (se comparte con la app).
- Modelo por tarea: `OPENCODE_MODEL=provider/modelo`.
- Datos de Agent Office: volumen `agent-office-data` → `/data`.
- App en `http://127.0.0.1:3000`; OpenCode en `http://127.0.0.1:4096`.
- Para actualizar OpenCode, cambia `OPENCODE_VERSION` en `Dockerfile.opencode`.
- Imágenes verificadas con `docker build` y OpenCode 1.19.0 (`opencode --version`).

---

## 12. Estructura del proyecto

```
app/
  pages/index.vue               oficina + layout
  components/OfficeScene...     canvas isométrico (TresJS)
  components/OfficeDesk.vue     escritorio, monitor, minifigura y etiqueta
  components/lego/              piezas reutilizables, minifigura, sombras, entorno
  components/AgentPanel...      detalle, actividad, aprobaciones, auditoría
  composables/useOffice.ts      estado, SSE y acciones
server/
  adapters/                     contrato, registry, OpenCode
  api/                          endpoints REST + SSE
  middleware/auth.ts            token Bearer
  plugins/runtime.ts            arranque de adaptadores
  utils/                        DB, runtime, hub SSE, auditoría, redacción
.opencode/agents/               agentes OpenCode en Markdown
docs/AGENTS.md                  guía para añadir y gestionar agentes
docker-compose.yml
Dockerfile / Dockerfile.opencode
```

---

## 13. Verificación realizada

Contra `opencode 1.19.0` y Three.js r186:

- Conexión real y descubrimiento de agentes (`build`, `plan`).
- Tarea completada de extremo a extremo (prompt → evento `assistant.text` → `completed`).
- Cancelación confirmada y estado final `cancelled` (sin quedar en `error` por `Aborted`).
- Aprobación real `external_directory` → `waiting_approval` → aprobación/rechazo → ejecución de `read` → `completed`.
- Aprobaciones duplicadas deduplicadas y expiración al cerrar la tarea.
- Reconexión automática probada deteniendo y reiniciando el servidor OpenCode (estado `error` → `connected` sin intervención).
- SSE y refresco de UI sin errores de consola.
- Orquestador `.md` (`default_agent`) delegando en `reviewer` y `builder` mediante `task`.
- Sesiones hijas creadas como `subtasks`, con el worker en `working` y su tarea delegada visible.
- Aprobación solicitada dentro de una sesión hija, respondida y atribuida al worker correcto.
- Layout adaptativo probado con 6 escritorios: rejilla 3×2, reubicación de props y encuadre automático.
- Rediseño visual LEGO probado en escritorio y móvil (selección, etiquetas de estado y panel).
- `nuxt typecheck` y `nuxt build` limpios.
- Build de producción ejecutado con token: `/api/state` responde `401` sin Bearer y `200` con él.
- `docker build` de la app y de OpenCode; contenedor de la app arrancando con SQLite en volumen.

---

## 14. UI premium y sistema de diseño

- **Tipografía**: Inter Variable y JetBrains Mono Variable self-hosted en `public/fonts` (OFL-1.1),
  precargadas; escala y tokens documentados en `docs/DESIGN.md`.
- **Tokens**: color, tipografía, espaciado 4/8/12/16/24/32, radios 8/10/14, easings y duraciones
  120/180/250 ms. Los textos pequeños cumplen contraste AA (≥4.5:1); `--muted-2` y el estado
  `disconnected` se corrigieron para ello.
- **Estados**: vacío, carga y error diseñados para escena, panel, listas, actividad, aprobaciones,
  auditoría y sesión, con reintento sin dobles envíos.
- **Escena**: encuadre automático con margen de HUD, entrada dolly de 600–900 ms, suelo/viñeta,
  bloom selectivo con `RenderPipeline` de `three/webgpu` (apagado automático si no se sostienen
  55 fps durante 2 s a 1024x768 con 3 agentes), etiquetas/pantallas 2x y materiales con desgaste
  acotado.
- **Identidad**: avatar derivado del minifig (retrato en `RenderTarget` con respaldo SVG), reloj
  real, pizarra con tareas reales, luz reactiva y sonido ambiental opcional apagado por defecto.
- **Accesibilidad**: foco visible, trampa de foco con Escape en diálogos/cajón, `prefers-reduced-
  motion` respetado en CSS y escena, cajón del panel a ≤640 px.
- **Verificación**: protocolo manual en `specs/001-premium-ui-scene/quickstart.md` (V1–V9);
  `npm run typecheck` y `npm run build` como puertas del proyecto.

## 15. Calidad y pruebas

- **Puerta única**: `npm run verify` ejecuta ESLint, Vitest, `typecheck` y build.
- **Unitarias**: `npm run test:unit` cubre encuadre (0/1/2/3+/10 agentes), layout de escritorios,
  distribución 1/2/3 de monitores, paredes, presupuesto de rendimiento y formateo de estados/tiempos.
- **Rendimiento**: 55 fps objetivo con calidad adaptativa (DPR, sombras y bloom); detalle y
  verificación en `docs/PERFORMANCE.md`. La escena expone `data-quality` y `data-fps`.
- **E2E + accesibilidad**: `npm run test:e2e` usa Playwright con `/api/state` simulado (no requiere
  OpenCode) y comprueba escena, panel lateral, hora, skip-link y `axe` sin violaciones críticas.
  En Windows usa Edge del sistema; con otro navegador define `PLAYWRIGHT_CHANNEL` o ejecuta
  `npx playwright install chromium`.
- **CI**: `.github/workflows/ci.yml` ejecuta lint, unitarias, typecheck, build y E2E en cada push/PR.
- **Accesibilidad**: listado semántico de agentes, skip-link, `aria-live` de resumen, pestañas con
  `tablist`/`tabpanel` y foco visible; cubierto por el escaneo `axe`.

## 16. Referencias técnicas

- Cámara ortográfica para isometría: <https://threejsresources.com/guides/camera>
- Raycasting para selección de escritorios: <https://threejsresources.com/guides/raycaster>
- Iluminación de tres puntos: <https://threejsresources.com/guides/lighting>
- Sombras y frustum: <https://threejsresources.com/guides/shadows>
- Materiales PBR: <https://threejsresources.com/guides/materials>
- HUD/labels HTML frente a 3D: <https://threejsresources.com/guides/ui-hud>
- OpenCode Server API: <https://opencode.ai/docs/server/>
- Referencia visual LEGO isométrica: <https://www.behance.net/gallery/252373901/The-Lego-Verse-3D-Model-Isometric>
