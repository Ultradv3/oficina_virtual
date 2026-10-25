# Gestión de agentes

El equipo de OpenCode se define en `.opencode/agents/`, un archivo Markdown por agente. El nombre del archivo es el nombre del agente.

```
.opencode/agents/
  orchestrator.md   # planificador, primary
  builder.md        # implementación
  reviewer.md       # revisión
  tester.md         # validación
```

## Formato

```md
---
description: Una frase sobre qué hace y cuándo usarlo.
mode: primary | subagent | all
model: deepseek/deepseek-flash
color: accent
steps: 20
permission:
  edit: deny
  bash: ask
  task:
    "*": deny
    builder: allow
---
Prompt del agente en Markdown.
```

- `mode: primary`: aparece como escritorio en Agent Office y puede ser el agente activo.
- `mode: subagent`: solo se invoca desde la herramienta `task`; no aparece como escritorio.
- `mode: all`: ambas cosas.
- `permission.task` controla qué subagentes puede invocar cada agente. Las reglas se evalúan en orden y **la última que coincide gana**.
- `edit`, `bash`, `task`, `question` y `todowrite` son las claves de permisos más usadas.

## Añadir un agente

1. Crea `.opencode/agents/<nombre>.md`.
2. Define `description`, `mode`, `model` y `permission`.
3. Si debe ser invocable por el orquestador, añádelo a su `permission.task`.
4. Reinicia el servidor OpenCode (`opencode serve`).
5. En Agent Office pulsa **Reconectar** o espera la reconexión automática.

No uses `README.md` dentro de `.opencode/agents/`: OpenCode lo cargaría como un agente llamado `README`.

## Orquestación

El `orchestrator` es el agente por defecto (`default_agent`). No edita: divide el trabajo y usa `task` para delegar en `builder`, `reviewer` y `tester`. Los workers tienen `task: deny` para evitar delegaciones recursivas.

Si un worker necesita aprobación de una herramienta, Agent Office la muestra en **Aprobaciones** y el trabajo delegado se pausa hasta que respondas.

### Seguimiento en Agent Office

Agent Office escucha `session.created` y registra las sesiones hijas en la tabla `subtasks`:

- El worker aparece en `working` mientras su sesión hija está activa.
- Sus eventos, aprobaciones y errores se atribuyen al worker correcto.
- El detalle de la tarea del orquestador muestra las delegaciones y el historial combinado.

Los agentes con `mode: all` se muestran como escritorios. La escena adapta la rejilla y retira mobiliario si el número de escritorios crece; actualmente soporta hasta 12 por oficina.

Agent Office oculta por defecto los agentes nativos (`build` y `plan`) para mostrar solo el equipo orquestado. El botón **Nativos** del panel los vuelve a mostrar; la preferencia se guarda en el navegador.

## Modelo

El proyecto usa `deepseek/deepseek-flash` como modelo por defecto. Los archivos `.md` también lo declaran explícitamente. Si cambias de proveedor, actualiza `model` en `opencode.json` y en los agentes que quieras mover.

## Verificación

```bash
opencode agent list
curl http://127.0.0.1:4096/agent
```

Deben aparecer `orchestrator`, `builder`, `reviewer` y `tester`. Si editas los `.md`, reinicia OpenCode antes de probar.
