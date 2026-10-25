import { describe, expect, it } from 'vitest'
import { WALL_ACCESSORY_GAP, WALL_LAYOUT, WALL_MARGIN } from '~/utils/wall-layout'

describe('wall layout', () => {
  it('mantiene las molduras detrás del plano de montaje', () => {
    expect(WALL_LAYOUT.back.trimFront).toBeLessThan(WALL_LAYOUT.back.mount)
    expect(WALL_LAYOUT.left.trimFront).toBeLessThan(WALL_LAYOUT.left.mount)
  })

  it('separa reloj y rótulo sin solaparse', () => {
    const clock = WALL_LAYOUT.back.slots.clock
    const sign = WALL_LAYOUT.back.slots.sign
    const clockRight = clock.center + clock.width / 2
    const signLeft = sign.center - sign.width / 2
    expect(signLeft - clockRight).toBeGreaterThanOrEqual(WALL_ACCESSORY_GAP)
  })

  it('deja margen de pared en los accesorios traseros', () => {
    const wallHalf = 8.8
    for (const slot of Object.values(WALL_LAYOUT.back.slots)) {
      expect(slot.center - slot.width / 2).toBeGreaterThan(-wallHalf + WALL_MARGIN)
      expect(slot.center + slot.width / 2).toBeLessThan(wallHalf - WALL_MARGIN)
    }
  })

  it('no solapa ventana, reloj, rótulo y mosaico', () => {
    const slots = Object.values(WALL_LAYOUT.back.slots).sort((a, b) => a.center - b.center)
    for (let index = 1; index < slots.length; index += 1) {
      const previous = slots[index - 1]!
      const current = slots[index]!
      const gap = current.center - current.width / 2 - (previous.center + previous.width / 2)
      expect(gap).toBeGreaterThanOrEqual(WALL_ACCESSORY_GAP - 0.001)
    }
  })
})
