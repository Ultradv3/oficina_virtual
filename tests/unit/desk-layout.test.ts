import { describe, expect, it } from 'vitest'
import {
  DESK_LAYOUT,
  DESK_SURFACE_Y,
  getDeskProps,
  getMonitorCount,
  getMonitorPlacements,
  seatOnDesk,
} from '~/utils/desk-layout'

describe('desk surface', () => {
  it('define la superficie y el asiento esperados', () => {
    expect(DESK_SURFACE_Y).toBe(0.89)
    expect(seatOnDesk(0.045)).toBeCloseTo(0.9125, 5)
    expect(DESK_LAYOUT.groupRotationY).toBe(Math.PI)
  })
})

describe('monitor distribution', () => {
  it('reparte 1/2/3 pantallas de forma estable por nombre', () => {
    const expected = {
      orchestrator: 1,
      builder: 3,
      reviewer: 3,
      tester: 1,
      build: 1,
      plan: 2,
    } as const
    for (const [name, count] of Object.entries(expected)) {
      expect(getMonitorCount(name)).toBe(count)
    }
  })

  it('coloca 3 pantallas con exactamente una vertical dentro de la mesa', () => {
    const placements = getMonitorPlacements('builder')
    expect(placements).toHaveLength(3)
    expect(placements.filter((monitor) => monitor.vertical)).toHaveLength(1)

    const halfDesk = DESK_LAYOUT.footprint.width / 2
    for (const monitor of placements) {
      const halfWidth = (monitor.vertical ? 0.82 : 1.34) * monitor.scale * 0.5
      expect(Math.abs(monitor.position[0]) + halfWidth).toBeLessThanOrEqual(halfDesk + 0.001)
      expect(monitor.position[1]).toBe(DESK_SURFACE_Y)
      expect(monitor.position[2]).toBe(DESK_LAYOUT.monitor.position[2])
    }
  })

  it('coloca dos pantallas simétricas', () => {
    const placements = getMonitorPlacements('plan')
    expect(placements).toHaveLength(2)
    expect(placements[0]?.position[0]).toBeCloseTo(-(placements[1]?.position[0] ?? 0), 5)
    expect(placements.every((monitor) => !monitor.vertical)).toBe(true)
  })
})

describe('desk props', () => {
  it('recoloca los objetos fuera de la zona de pantallas en multi-monitor', () => {
    const single = getDeskProps('orchestrator')
    const multi = getDeskProps('builder')
    expect(single.lamp[2]).toBeLessThan(0)
    expect(multi.lamp[2]).toBeGreaterThan(0)
    expect(multi.mug[0]).toBeGreaterThan(0)
    expect(multi.notebook[0]).toBeLessThan(0)
    expect(multi.papers).toHaveLength(2)
  })
})
