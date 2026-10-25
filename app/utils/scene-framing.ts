/**
 * Cálculo PURO del encuadre ortográfico isométrico de la escena (T025 / FR-017).
 *
 * La escena se dibuja con una cámara ortográfica fija en la dirección isométrica
 * `[14, 14, 14]` mirando a `[0, 1, 0]`. Este módulo traduce el estado real de la
 * oficina (número de agentes y, por tanto, de escritorios), los límites del
 * diorama y el tamaño real del lienzo en un frustum objetivo:
 *
 * 1. Proyecta el volumen ocupado (diorama + escritorios) sobre los ejes de la
 *    cámara, de modo que el cálculo no dependa de la escala del mundo.
 * 2. Reserva la zona segura del HUD (barra superior y pie de la escena) y centra
 *    el contenido en esa zona desplazando el centro del frustum, no la cámara:
 *    así `OrbitControls` conserva su target y su rango de zoom.
 * 3. Devuelve además un `target.zoom` de composición acotado al rango del
 *    control de órbita (0.8–2.3). El encuadre base se resuelve con el frustum a
 *    zoom 1 (la entrada dolly anima 0.86 → 1); ese zoom de composición se usa
 *    como foco suave al seleccionar un escritorio.
 *
 * No importa `three` ni toca el DOM: es determinista y se puede validar con
 * 0/1/2/3+/10 agentes y con cualquier viewport (1280x800, 1024x768, 390x844…).
 */

export interface FramingViewport {
  width: number
  height: number
}

/** Zona segura del HUD medida en píxeles CSS del lienzo de la escena. */
export interface FramingSafeArea {
  top: number
  bottom: number
  left: number
  right: number
}

export interface FramingBounds {
  minX: number
  maxX: number
  minY: number
  maxY: number
  minZ: number
  maxZ: number
}

/** Huella de un escritorio alrededor de su posición (en unidades de mundo). */
export interface FramingDeskFootprint {
  halfWidth: number
  halfDepth: number
  minY: number
  maxY: number
}

export interface FramingCamera {
  position: [number, number, number]
  target: [number, number, number]
}

export interface FramingZoomRange {
  min: number
  max: number
}

export interface FramingDeskLayout {
  columns: number
  rows: number
  positions: Array<[number, number, number]>
}

export interface FramingProjection {
  minX: number
  maxX: number
  minY: number
  maxY: number
  halfWidth: number
  halfHeight: number
  centerX: number
  centerY: number
}

export interface SceneFramingInput {
  /** Tamaño real del contenedor de la escena (no del viewport del navegador). */
  viewport: FramingViewport
  agentCount: number
  diorama?: FramingBounds
  deskFootprint?: FramingDeskFootprint
  safeArea?: Partial<FramingSafeArea>
  /**
   * Margen de composición a cada lado del área segura, como fracción (0–0.2).
   * Por defecto 0.04: el contenido ocupa como máximo el 92 % del área segura.
   */
  margin?: number
  camera?: FramingCamera
  zoomRange?: FramingZoomRange
}

export interface SceneFramingResult {
  viewport: FramingViewport
  safeArea: FramingSafeArea
  zoomRange: FramingZoomRange
  agentCount: number
  layout: FramingDeskLayout
  /** Bounds ocupados por los escritorios; `null` sin agentes. */
  occupancy: FramingBounds | null
  dioramaBounds: FramingBounds
  /** Unión del diorama y de los escritorios: lo que no se puede recortar. */
  content: FramingBounds
  projected: FramingProjection
  frustum: {
    left: number
    right: number
    top: number
    bottom: number
    width: number
    height: number
  }
  target: {
    halfWidth: number
    halfHeight: number
    zoom: number
    targetX: number
    targetZ: number
  }
  /** Fracción del área segura ocupada por el contenido (0–1, informativo). */
  contentFill: number
  /** Ocupación de los escritorios respecto al diorama (0–1). */
  occupancyRatio: number
}

/** Zona segura del HUD: barra de estado superior y pie de la escena. */
export const SCENE_SAFE_AREA: FramingSafeArea = { top: 64, bottom: 72, left: 0, right: 0 }

/** Límites de zoom de `OrbitControls` (los mismos que usa la plantilla). */
export const SCENE_ZOOM_RANGE: FramingZoomRange = { min: 0.8, max: 2.3 }

/** Cámara isométrica de la escena (la misma que declara `OfficeScene`). */
export const SCENE_CAMERA: FramingCamera = {
  position: [14, 14, 14],
  target: [0, 1, 0],
}

/** Entrada dolly de la escena: 600–900 ms (FR-018, SC-008). */
export const SCENE_ENTRANCE = {
  fromZoom: 0.86,
  toZoom: 1,
  durationMs: 720,
} as const

/** Transición suave al seleccionar un escritorio. */
export const SCENE_SELECTION_DURATION_MS = 240

/** Límites del diorama LEGO (base + paredes) en unidades de mundo. */
export const SCENE_DIORAMA_BOUNDS: FramingBounds = {
  minX: -9.45,
  maxX: 9.45,
  minY: -0.72,
  maxY: 3.3,
  minZ: -6.6,
  maxZ: 6.6,
}

/**
 * Huella de un escritorio alrededor de su posición: mesa, silla, lámpara y la
 * etiqueta flotante (`y` 2.32 + media altura del sprite).
 */
export const SCENE_DESK_FOOTPRINT: FramingDeskFootprint = {
  halfWidth: 1.45,
  halfDepth: 1.4,
  minY: 0,
  maxY: 2.8,
}

const DESK_COLUMN_SPACING = 4.9
const DESK_ROW_SPACING = 4.4
const DESK_ROW_OFFSET_Z = 0.2
const DESK_BASE_Y = 0.03

/** Altura mínima del frustum: evita zooms absurdos en lienzos muy pequeños. */
const MIN_FRUSTUM_HEIGHT = 12
/** Ganancia del foco de selección: más cerca cuando hay menos escritorios. */
const FOCUS_ZOOM_GAIN = 0.12
/** Margen de composición por defecto (4 % a cada lado del área segura). */
const DEFAULT_MARGIN = 0.04
/** Presupuesto máximo del HUD para no dejar sin área útil a lienzos pequeños. */
const SAFE_AREA_BUDGET = 0.6

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

/** Acota un zoom al rango del control de órbita. */
export function clampZoom(value: number, range: FramingZoomRange = SCENE_ZOOM_RANGE): number {
  return clamp(isFiniteNumber(value) ? value : SCENE_ENTRANCE.toZoom, range.min, range.max)
}

/**
 * Reparto de escritorios de la oficina (una sola fuente de verdad para la
 * plantilla y para el encuadre): hasta 2 agentes en línea, hasta 9 en rejilla
 * de 3 columnas y hasta 12 en 4 columnas.
 */
export function computeDeskLayout(agentCount: number): FramingDeskLayout {
  const count = Math.max(0, Math.trunc(isFiniteNumber(agentCount) ? agentCount : 0))
  // 1-2 agentes en línea; hasta 9 en 3 columnas; a partir de 10 se usa una
  // cuarta columna, que cabe en la base del diorama actual.
  const columns = count <= 2 ? Math.max(count, 1) : count > 9 ? 4 : 3
  const rows = Math.max(1, Math.ceil(count / columns))
  const positions: Array<[number, number, number]> = []

  for (let index = 0; index < count; index += 1) {
    const column = index % columns
    const row = Math.floor(index / columns)
    positions.push([
      (column - (columns - 1) / 2) * DESK_COLUMN_SPACING,
      DESK_BASE_Y,
      (row - (rows - 1) / 2) * DESK_ROW_SPACING + DESK_ROW_OFFSET_Z,
    ])
  }

  return { columns, rows, positions }
}

function normalizeVector(vector: [number, number, number]): [number, number, number] | null {
  const length = Math.hypot(vector[0], vector[1], vector[2])
  if (!Number.isFinite(length) || length < 1e-6) return null
  return [vector[0] / length, vector[1] / length, vector[2] / length]
}

function cross(a: [number, number, number], b: [number, number, number]): [number, number, number] {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ]
}

function dot(a: [number, number, number], b: [number, number, number]): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
}

/**
 * Base de la cámara (ejes x/y de pantalla) a partir de su posición y su target,
 * replicando la orientación que construye `Object3D.lookAt`: `z` apunta de la
 * escena a la cámara, `x = up × z` e `y = z × x`.
 */
export function getCameraBasis(camera: FramingCamera = SCENE_CAMERA): {
  x: [number, number, number]
  y: [number, number, number]
  z: [number, number, number]
  target: [number, number, number]
} {
  const back = normalizeVector([
    camera.position[0] - camera.target[0],
    camera.position[1] - camera.target[1],
    camera.position[2] - camera.target[2],
  ]) ?? [0, 0, 1]
  const right = normalizeVector(cross([0, 1, 0], back)) ?? [1, 0, 0]
  const up = cross(back, right)

  return { x: right, y: up, z: back, target: camera.target }
}

/**
 * Proyecta los 8 vértices de un volumen sobre los ejes de pantalla de la
 * cámara, relativos a su target.
 */
export function projectSceneBounds(
  bounds: FramingBounds,
  camera: FramingCamera = SCENE_CAMERA,
): FramingProjection {
  const basis = getCameraBasis(camera)
  let minX = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY

  for (const x of [bounds.minX, bounds.maxX]) {
    for (const y of [bounds.minY, bounds.maxY]) {
      for (const z of [bounds.minZ, bounds.maxZ]) {
        const relative: [number, number, number] = [
          x - basis.target[0],
          y - basis.target[1],
          z - basis.target[2],
        ]
        const screenX = dot(relative, basis.x)
        const screenY = dot(relative, basis.y)
        minX = Math.min(minX, screenX)
        maxX = Math.max(maxX, screenX)
        minY = Math.min(minY, screenY)
        maxY = Math.max(maxY, screenY)
      }
    }
  }

  const halfWidth = (maxX - minX) / 2
  const halfHeight = (maxY - minY) / 2

  return {
    minX,
    maxX,
    minY,
    maxY,
    halfWidth,
    halfHeight,
    centerX: (minX + maxX) / 2,
    centerY: (minY + maxY) / 2,
  }
}

function normalizeViewport(viewport: FramingViewport | undefined): FramingViewport {
  const width = viewport && isFiniteNumber(viewport.width) && viewport.width > 0 ? viewport.width : 1280
  const height =
    viewport && isFiniteNumber(viewport.height) && viewport.height > 0 ? viewport.height : 800
  return { width: Math.max(1, width), height: Math.max(1, height) }
}

/**
 * Normaliza la zona segura: sin negativos y con un presupuesto máximo para que
 * un lienzo bajo (móvil apilado) conserve área útil de escena.
 */
function normalizeSafeArea(
  safeArea: Partial<FramingSafeArea> | undefined,
  viewport: FramingViewport,
): FramingSafeArea {
  const merged: FramingSafeArea = { ...SCENE_SAFE_AREA, ...safeArea }
  const area: FramingSafeArea = {
    top: Math.max(0, isFiniteNumber(merged.top) ? merged.top : SCENE_SAFE_AREA.top),
    bottom: Math.max(0, isFiniteNumber(merged.bottom) ? merged.bottom : SCENE_SAFE_AREA.bottom),
    left: Math.max(0, isFiniteNumber(merged.left) ? merged.left : 0),
    right: Math.max(0, isFiniteNumber(merged.right) ? merged.right : 0),
  }

  const vertical = area.top + area.bottom
  const verticalBudget = viewport.height * SAFE_AREA_BUDGET
  if (vertical > verticalBudget && vertical > 0) {
    const scale = verticalBudget / vertical
    area.top *= scale
    area.bottom *= scale
  }

  const horizontal = area.left + area.right
  const horizontalBudget = viewport.width * SAFE_AREA_BUDGET
  if (horizontal > horizontalBudget && horizontal > 0) {
    const scale = horizontalBudget / horizontal
    area.left *= scale
    area.right *= scale
  }

  return area
}

function boundsFromDesks(
  positions: Array<[number, number, number]>,
  footprint: FramingDeskFootprint,
): FramingBounds | null {
  if (positions.length === 0) return null

  let minX = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY
  let minZ = Number.POSITIVE_INFINITY
  let maxZ = Number.NEGATIVE_INFINITY

  for (const [x, y, z] of positions) {
    minX = Math.min(minX, x - footprint.halfWidth)
    maxX = Math.max(maxX, x + footprint.halfWidth)
    minY = Math.min(minY, y + footprint.minY)
    maxY = Math.max(maxY, y + footprint.maxY)
    minZ = Math.min(minZ, z - footprint.halfDepth)
    maxZ = Math.max(maxZ, z + footprint.halfDepth)
  }

  return { minX, maxX, minY, maxY, minZ, maxZ }
}

function unionBounds(a: FramingBounds, b: FramingBounds): FramingBounds {
  return {
    minX: Math.min(a.minX, b.minX),
    maxX: Math.max(a.maxX, b.maxX),
    minY: Math.min(a.minY, b.minY),
    maxY: Math.max(a.maxY, b.maxY),
    minZ: Math.min(a.minZ, b.minZ),
    maxZ: Math.max(a.maxZ, b.maxZ),
  }
}

function boundsArea(bounds: FramingBounds | null): number {
  if (!bounds) return 0
  const width = Math.max(0, bounds.maxX - bounds.minX)
  const depth = Math.max(0, bounds.maxZ - bounds.minZ)
  return width * depth
}

/**
 * Calcula el frustum ortográfico objetivo, el desplazamiento de centrado para
 * respetar la zona segura del HUD y el zoom de composición acotado.
 */
export function computeSceneFraming(input: SceneFramingInput): SceneFramingResult {
  const viewport = normalizeViewport(input.viewport)
  const aspect = viewport.width / viewport.height
  const safeArea = normalizeSafeArea(input.safeArea, viewport)
  const zoomRange = input.zoomRange ?? SCENE_ZOOM_RANGE
  const camera = input.camera ?? SCENE_CAMERA
  const dioramaBounds = input.diorama ?? SCENE_DIORAMA_BOUNDS
  const deskFootprint = input.deskFootprint ?? SCENE_DESK_FOOTPRINT
  const margin = clamp(isFiniteNumber(input.margin) ? input.margin : DEFAULT_MARGIN, 0, 0.2)
  const contentScale = 1 - margin * 2

  const layout = computeDeskLayout(input.agentCount)
  const occupancy = boundsFromDesks(layout.positions, deskFootprint)
  const content = occupancy ? unionBounds(dioramaBounds, occupancy) : dioramaBounds
  const projected = projectSceneBounds(content, camera)

  const safeWidth = Math.max(1, viewport.width - safeArea.left - safeArea.right)
  const safeHeight = Math.max(1, viewport.height - safeArea.top - safeArea.bottom)

  // Altura de mundo necesaria para que el contenido entre en el área segura:
  // se resuelve por alto y por ancho (el frustum mantiene el aspecto del lienzo
  // para no deformar la proyección isométrica).
  const heightForContent =
    (2 * projected.halfHeight * viewport.height) / (safeHeight * contentScale)
  const widthForContent =
    (2 * projected.halfWidth * viewport.width) / (safeWidth * contentScale * aspect)
  const frustumHeight = Math.max(MIN_FRUSTUM_HEIGHT, heightForContent, widthForContent)
  const frustumWidth = frustumHeight * aspect

  // El HUD ocupa 64 px arriba y 72 px abajo: el centro del área segura está unos
  // píxeles por encima del centro del lienzo. Se desplaza el centro del frustum
  // (no la cámara) para no alterar el target de OrbitControls.
  const upOffsetPx = (safeArea.bottom - safeArea.top) / 2
  const rightOffsetPx = (safeArea.left - safeArea.right) / 2
  const centerX = projected.centerX - (rightOffsetPx * frustumWidth) / viewport.width
  const centerY = projected.centerY - (upOffsetPx * frustumHeight) / viewport.height

  const halfContentPxX = (projected.halfWidth * viewport.width) / frustumWidth
  const halfContentPxY = (projected.halfHeight * viewport.height) / frustumHeight
  const contentFill = clamp(
    Math.max(halfContentPxX / (safeWidth / 2), halfContentPxY / (safeHeight / 2)),
    0,
    1.5,
  )

  const occupancyRatio = clamp(
    boundsArea(occupancy) / Math.max(1, boundsArea(dioramaBounds)),
    0,
    1,
  )
  // Con pocos escritorios el contenido deja más aire: la selección puede
  // acercarse algo más. Siempre dentro del rango de OrbitControls (0.8–2.3).
  const zoom = clampZoom(1 + FOCUS_ZOOM_GAIN * (1 - occupancyRatio), zoomRange)

  return {
    viewport,
    safeArea,
    zoomRange,
    agentCount: layout.positions.length,
    layout,
    occupancy,
    dioramaBounds,
    content,
    projected,
    frustum: {
      left: centerX - frustumWidth / 2,
      right: centerX + frustumWidth / 2,
      top: centerY + frustumHeight / 2,
      bottom: centerY - frustumHeight / 2,
      width: frustumWidth,
      height: frustumHeight,
    },
    target: {
      halfWidth: frustumWidth / 2,
      halfHeight: frustumHeight / 2,
      zoom,
      // La composición es simétrica alrededor del diorama; el centrado fino se
      // hace con el frustum, así que el target de órbita sigue en el origen.
      targetX: 0,
      targetZ: 0,
    },
    contentFill,
    occupancyRatio,
  }
}
