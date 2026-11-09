import { describe, expect, it } from 'vitest'
import type { HybrisStockStoreHealth } from '@/core/models/hybris-stock'
import { storeHealth } from './health'

const health = (over: Partial<HybrisStockStoreHealth> = {}): HybrisStockStoreHealth => ({
  lastDeltaAt: '2026-11-07T10:30:00',
  lastFullAt: '2026-11-06T03:05:00',
  nextFullDue: '2026-11-08T03:00:00',
  fullRequested: false,
  lastErrorAt: null,
  lastError: null,
  deltaBehind: false,
  fullOverdue: false,
  healthy: true,
  ...over,
})

describe('storeHealth', () => {
  it('an unmarked store has no health, whatever block it carries', () => {
    expect(storeHealth({ marked: false, health: null })).toMatchObject({ reading: 'unmarked', highlight: null })
    expect(storeHealth({ marked: false, health: health({ deltaBehind: true, healthy: false }) })).toMatchObject({ reading: 'unmarked', highlight: null })
  })

  it('a healthy marked store is ok', () => {
    expect(storeHealth({ marked: true, health: health() })).toEqual({ reading: 'ok', causes: [], highlight: null, sev: 'ok' })
  })

  it('a delta behind is unhealthy, red', () => {
    expect(storeHealth({ marked: true, health: health({ deltaBehind: true }) })).toEqual({
      reading: 'unhealthy',
      causes: ['deltaBehind'],
      highlight: 'bad',
      sev: 'bad',
    })
  })

  it('a full overdue is unhealthy; both causes are kept in order', () => {
    expect(storeHealth({ marked: true, health: health({ fullOverdue: true }) }).causes).toEqual(['fullOverdue'])
    expect(storeHealth({ marked: true, health: health({ fullOverdue: true, deltaBehind: true }) }).causes).toEqual(['deltaBehind', 'fullOverdue'])
  })

  it('a store the server calls not healthy is unhealthy, even with no cause flag', () => {
    expect(storeHealth({ marked: true, health: health({ healthy: false }) })).toEqual({ reading: 'unhealthy', causes: [], highlight: 'bad', sev: 'bad' })
  })

  it('unhealthy outranks a last error', () => {
    expect(storeHealth({ marked: true, health: health({ deltaBehind: true, lastError: 'Blob 503' }) }).reading).toBe('unhealthy')
  })

  it('a failed last push on a store not yet behind is amber', () => {
    expect(storeHealth({ marked: true, health: health({ lastError: 'Blob 503' }) })).toMatchObject({ reading: 'lastFailed', highlight: 'warn' })
  })

  it('a newly marked store waits for its first full, not unhealthy', () => {
    expect(storeHealth({ marked: true, health: health({ fullRequested: true, lastFullAt: null, lastDeltaAt: null }) })).toMatchObject({
      reading: 'awaitingFull',
      highlight: null,
    })
    expect(storeHealth({ marked: true, health: null }).reading).toBe('awaitingFull')
  })

  it('only an explicit true flags a store (a stub that sent "true" or 1 does not)', () => {
    expect(storeHealth({ marked: true, health: health({ deltaBehind: 'true' as never, fullOverdue: 1 as never }) }).reading).toBe('ok')
  })
})
