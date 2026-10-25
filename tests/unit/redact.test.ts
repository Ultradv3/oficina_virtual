import { describe, expect, it } from 'vitest'
import { clip, redact } from '../../server/utils/redact'

describe('redact', () => {
  it('oculta claves sensibles en objetos anidados', () => {
    const result = redact({
      name: 'builder',
      token: 'secret-token',
      config: { apiKey: 'abc', authorization: 'Bearer x' },
      safe: 'visible',
    }) as Record<string, unknown>

    expect(result.token).toBe('[redacted]')
    expect(result.config).toEqual({
      apiKey: '[redacted]',
      authorization: '[redacted]',
    })
    expect(result.safe).toBe('visible')
    expect(result.name).toBe('builder')
  })

  it('trunca estructuras profundas y arrays largos', () => {
    const deep = { a: { b: { c: { d: { e: { f: 'too deep' } } } } } }
    expect(JSON.stringify(redact(deep))).toContain('[truncated]')
    expect((redact(Array.from({ length: 100 }, (_, index) => index)) as unknown[]).length).toBe(40)
  })
})

describe('clip', () => {
  it('recorta sin romper textos cortos', () => {
    expect(clip('hola', 10)).toBe('hola')
    expect(clip('abcdefghij', 5)).toBe('abcde…')
  })
})
