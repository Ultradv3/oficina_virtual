/**
 * Medidas y anclajes del escritorio de un agente.
 *
 * Todas las posiciones son locales al grupo externo de `OfficeDesk` (el que
 * recibe la prop `position`). La superficie de la mesa está en `y = 0.89`;
 * las piezas que se apoyan en ella se calculan con `seatOnDesk()` para no
 * volver a dispersar la altura de contacto (FR-002 de la spec 002).
 */

export type Vec3 = [number, number, number]

/** Superficie superior del tablero dentro del grupo del escritorio. */
export const DESK_SURFACE_Y = 0.89

/** Tolerancia de contacto visible permitida entre una pieza y su apoyo. */
export const DESK_CONTACT_TOLERANCE = 0.005

/**
 * Altura del centro de una pieza de altura `height` para que su base quede
 * exactamente sobre la superficie de la mesa.
 */
export function seatOnDesk(height: number): number {
  return DESK_SURFACE_Y + height / 2
}

export const DESK_LAYOUT = {
  /** Altura del tablero respecto al suelo local del escritorio. */
  surfaceY: DESK_SURFACE_Y,
  /** Grupo interior que contiene la mesa y los props. */
  groupY: 0.02,
  /** Giro del conjunto del escritorio: ahora el puesto mira a cámara. */
  groupRotationY: Math.PI,
  footprint: { width: 2.55, depth: 1.18 },
  agent: {
    // La altura deja los muslos sobre el asiento de la silla (y ≈ 0.48).
    position: [0, 0.08, 0.95] as Vec3,
    // Compensa el giro del grupo: el minifig mira a cámara (+z).
    rotationY: Math.PI,
  },
  chair: {
    // Centrada bajo el agente; con el giro del grupo queda detrás de él.
    position: [0, 0, 1.2] as Vec3,
    rotationY: Math.PI,
  },
  monitor: {
    // La base del monitor queda en y = 0.89 (0.90 + 0.02 - 0.03). El giro local
    // compensa el giro π del grupo para que la pantalla siga mirando a cámara
    // (el agente queda detrás del monitor, sentado de frente).
    position: [-0.68, 0.9, -0.28] as Vec3,
    rotationY: 0.18 - Math.PI,
  },
  keyboard: {
    position: [0.15, seatOnDesk(0.04), 0.3] as Vec3,
    height: 0.04,
  },
  mug: {
    // El grupo arranca en la base de la taza.
    position: [-1.02, DESK_SURFACE_Y, 0.3] as Vec3,
  },
  lamp: {
    // El grupo arranca en la base de la lámpara.
    position: [-1.02, DESK_SURFACE_Y, -0.4] as Vec3,
  },
  papers: [
    { position: [0.8, seatOnDesk(0.045), -0.4] as Vec3, height: 0.045 },
    { position: [0.81, seatOnDesk(0.045) + 0.045, -0.39] as Vec3, height: 0.045 },
  ],
  label: {
    // Etiqueta discreta sobre el escritorio: chip pequeño que no roza el
    // monitor (techo ≈ 1.8) ni el escritorio vecino.
    position: [0, 2.32, -0.05] as Vec3,
    scale: [1.6, 0.36, 1] as Vec3,
  },
} as const

/** Distribución pseudoaleatoria y estable de monitores por agente. */
export interface MonitorPlacement {
  position: Vec3
  rotationY: number
  vertical: boolean
  scale: number
}

export interface DeskPaper {
  position: Vec3
  height: number
}

export interface DeskProps {
  lamp: Vec3
  mug: Vec3
  papers: DeskPaper[]
  notebook: Vec3
}

export function getMonitorCount(agentName: string): 1 | 2 | 3 {
  let hash = 0
  for (const char of agentName) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  return (1 + (hash % 3)) as 1 | 2 | 3
}

export function getMonitorPlacements(agentName: string): MonitorPlacement[] {
  const y = DESK_SURFACE_Y
  const z = DESK_LAYOUT.monitor.position[2]
  const count = getMonitorCount(agentName)
  if (count === 1) {
    return [{ position: [0, y, z], rotationY: 0.18, vertical: false, scale: 1 }]
  }
  if (count === 2) {
    return [
      { position: [-0.55, y, z], rotationY: 0.18, vertical: false, scale: 0.76 },
      { position: [0.55, y, z], rotationY: 0.18, vertical: false, scale: 0.76 },
    ]
  }
  return [
    { position: [-0.8, y, z], rotationY: 0.18, vertical: false, scale: 0.52 },
    { position: [0, y, z], rotationY: 0.18, vertical: false, scale: 0.52 },
    { position: [0.8, y, z], rotationY: 0.18, vertical: true, scale: 0.64 },
  ]
}

export function getDeskProps(agentName: string): DeskProps {
  if (getMonitorCount(agentName) === 1) {
    return {
      lamp: [...DESK_LAYOUT.lamp.position],
      mug: [...DESK_LAYOUT.mug.position],
      papers: DESK_LAYOUT.papers.map((paper) => ({
        position: [...paper.position],
        height: paper.height,
      })),
      notebook: [0.74, DESK_SURFACE_Y + 0.025, 0.32],
    }
  }
  return {
    lamp: [-1.02, DESK_SURFACE_Y, 0.28],
    mug: [0.95, DESK_SURFACE_Y, 0.3],
    papers: [
      { position: [0.95, seatOnDesk(0.045), 0.08], height: 0.045 },
      { position: [0.96, seatOnDesk(0.045) + 0.045, 0.09], height: 0.045 },
    ],
    notebook: [-0.55, DESK_SURFACE_Y + 0.025, 0.32],
  }
}
