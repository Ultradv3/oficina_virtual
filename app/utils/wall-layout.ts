/**
 * Plano de montaje y huecos de los accesorios de pared.
 *
 * Convención: los accesorios se montan por delante del plano de las molduras
 * (`trimFront`) para que pilares y junquillos no los tapen. Las posiciones son
 * las de los grupos de `OfficeScene.client.vue` (coordenadas de mundo).
 */

export type WallId = 'back' | 'left'

export interface WallSlot {
  /** Coordenada a lo largo de la pared (x en la trasera, z en la izquierda). */
  center: number
  /** Altura del centro del accesorio. */
  y: number
  width: number
  height: number
}

export interface WallLayout {
  /** Cara interior de la pared. */
  inner: number
  /** Plano de montaje de los accesorios. */
  mount: number
  /** Plano máximo de molduras/pilares (siempre detrás del montaje). */
  trimFront: number
  slots: Record<string, WallSlot>
}

/** Margen mínimo entre un accesorio y los bordes de su pared. */
export const WALL_MARGIN = 0.15

/** Separación mínima entre dos accesorios de la misma pared. */
export const WALL_ACCESSORY_GAP = 0.12

export const WALL_LAYOUT = {
  back: {
    inner: -5.78,
    mount: -5.66,
    trimFront: -5.74,
    slots: {
      window: { center: -1.3, y: 1.9, width: 4.5, height: 2.02 },
      clock: { center: 1.95, y: 2.3, width: 1.32, height: 1.32 },
      sign: { center: 5.1, y: 2.3, width: 4.5, height: 1.26 },
      mosaic: { center: -5.6, y: 2.15, width: 3.5, height: 1.66 },
    },
  },
  left: {
    inner: -8.78,
    mount: -8.7,
    trimFront: -8.736,
    slots: {
      whiteboard: { center: 0.9, y: 1.75, width: 3.6, height: 2.1 },
      door: { center: -3.5, y: 1.1, width: 1.6, height: 2.3 },
    },
  },
} as const satisfies Record<WallId, WallLayout>
