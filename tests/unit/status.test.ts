import { describe, expect, it } from 'vitest'
import { taskStatusLabel, statusMeta, timeAgo, toIso } from '~/utils/status'

describe('status labels', () => {
  it('traduce estados conocidos y conserva los desconocidos', () => {
    expect(taskStatusLabel('running')).toBe('En curso')
    expect(taskStatusLabel('completed')).toBe('Completada')
    expect(taskStatusLabel('custom')).toBe('custom')
  })

  it('expone metadatos para todos los estados de agente', () => {
    for (const status of ['available', 'working', 'waiting_approval', 'error', 'disconnected'] as const) {
      const meta = statusMeta(status)
      expect(meta.label.length).toBeGreaterThan(0)
      expect(meta.color).toMatch(/^#[0-9a-f]{6}$/i)
    }
  })

  it('normaliza timestamps inválidos', () => {
    expect(toIso(null)).toBeUndefined()
    expect(toIso(0)).toBeUndefined()
    expect(timeAgo(null)).toBe('—')
  })
})
