import { describe, expect, it } from 'vitest'
import { historyFromParams, storesDoorParams, storesFromParams, storesToParams, withHistory } from './stores-query'

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

describe('the history drawer in the URL', () => {
  it('sets, swaps and clears ?history= and leaves the filters alone', () => {
    const p = new URLSearchParams('flag=marked&q=olaya')
    expect(withHistory(p, '1234').toString()).toBe('flag=marked&q=olaya&history=1234')
    expect(withHistory(new URLSearchParams('flag=marked&history=1234'), '0099').toString()).toBe('flag=marked&history=0099')
    expect(withHistory(new URLSearchParams('flag=marked&history=1234'), null).toString()).toBe('flag=marked')
    expect(p.toString()).toBe('flag=marked&q=olaya')
  })

  it('keeps the open drawer across new filters', () => {
    expect(withHistory(storesToParams({ flag: 'any', health: 'ok', q: null }), historyFromParams(new URLSearchParams('flag=marked&history=1234'))).toString()).toBe(
      'health=ok&history=1234',
    )
    expect(historyFromParams(new URLSearchParams('flag=marked'))).toBeNull()
  })
})
