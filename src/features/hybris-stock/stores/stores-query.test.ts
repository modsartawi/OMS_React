import { describe, expect, it } from 'vitest'
import { storesDoorParams, storesFromParams, storesToParams } from './stores-query'

describe('the stores URL', () => {
  it('round-trips flag, health and q, defaults left off', () => {
    expect(storesToParams({ flag: 'any', health: 'any', q: null }).toString()).toBe('')
    const q = storesFromParams(new URLSearchParams('flag=marked&health=unhealthy&q=%20olaya%20'))
    expect(q).toEqual({ flag: 'marked', health: 'unhealthy', q: 'olaya' })
    expect(storesToParams(q).toString()).toBe('flag=marked&health=unhealthy&q=olaya')
  })

  it('a value the door does not know reads as any (never sent, so never HybrisStockFilterUnknown)', () => {
    expect(storesFromParams(new URLSearchParams('flag=yes&health=red'))).toEqual({ flag: 'any', health: 'any', q: null })
  })
})

describe('storesDoorParams', () => {
  it('sends flag / health / q, any left off', () => {
    expect(storesDoorParams({ flag: 'any', health: 'any', q: null })).toEqual({ flag: null, health: null, q: null })
    expect(storesDoorParams({ flag: 'unmarked', health: 'ok', q: 'x' })).toEqual({ flag: 'unmarked', health: 'ok', q: 'x' })
  })
})
