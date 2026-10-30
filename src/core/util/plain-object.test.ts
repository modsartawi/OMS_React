import { describe, expect, it } from 'vitest'
import { isPlainObject } from './plain-object'

describe('isPlainObject', () => {
  it('accepts an object literal', () => {
    expect(isPlainObject({ a: 1 })).toBe(true)
    expect(isPlainObject({})).toBe(true)
  })
  it('refuses null, arrays and scalars', () => {
    expect(isPlainObject(null)).toBe(false)
    expect(isPlainObject([])).toBe(false)
    expect(isPlainObject('x')).toBe(false)
    expect(isPlainObject(1)).toBe(false)
    expect(isPlainObject(undefined)).toBe(false)
  })
})
