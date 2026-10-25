/**
 * Ticket 551 — the HungerStation stores page's pure rules: the health a row reads (the server
 * computes `ok` / `failing` / `silent`; a paused store reads paused, never silent) and the filters
 * ⇄ URL ⇄ door mapping.
 */
import { describe, expect, it } from 'vitest'
import type { HungerStationStoreSync } from '@/core/models/hungerstation'
import { healthLabel, storesFromParams, storesToParams } from './store-state'

const sync = (over: Partial<HungerStationStoreSync> = {}): HungerStationStoreSync => ({
  active: true,
  lastFullRun: '2026-10-24T07:05:00',
  lastDeltaRun: '2026-10-24T10:30:00',
  lastRun: '2026-10-24T10:30:00',
  lastStatus: 'S',
  lastError: null,
  health: 'ok',
  ...over,
})

describe('healthLabel', () => {
  it('ok reads ok, with no highlight', () => {
    expect(healthLabel(sync())).toEqual({ health: 'ok', highlight: null })
  })

  it('failing — the newest push in 24 h failed — is highlighted as an error', () => {
    expect(healthLabel(sync({ lastStatus: 'E', lastError: 'HTTP 500', health: 'failing' }))).toEqual({ health: 'failing', highlight: 'bad' })
  })

  it('silent — an active store with no push in 24 h — is highlighted as a warning', () => {
    expect(healthLabel(sync({ lastRun: null, lastStatus: null, health: 'silent' }))).toEqual({ health: 'silent', highlight: 'warn' })
  })

  it('🚩 a paused store reads paused, not silent — even if a server ever said silent for it', () => {
    expect(healthLabel(sync({ active: false, lastRun: null, lastStatus: null, health: 'ok' }))).toEqual({ health: 'paused', highlight: null })
    expect(healthLabel(sync({ active: false, lastRun: null, lastStatus: null, health: 'silent' }))).toEqual({ health: 'paused', highlight: null })
  })

  it('a paused store whose newest push failed still reads failing — the server’s word wins over the pause', () => {
    expect(healthLabel(sync({ active: false, lastStatus: 'E', health: 'failing' }))).toEqual({ health: 'failing', highlight: 'bad' })
  })

  it('a health the contract does not name reads as unknown, never ok', () => {
    expect(healthLabel(sync({ health: 'stale' as never }))).toEqual({ health: 'unknown', highlight: null })
  })
})

describe('storesFromParams / storesToParams', () => {
  it('an empty URL is the door’s defaults, and writes back as nothing', () => {
    const q = storesFromParams(new URLSearchParams(''))
    expect(q).toEqual({ chain: null, sync: 'any', health: 'any', q: null })
    expect(storesToParams(q).toString()).toBe('')
  })

  it('every filter round-trips, in the door’s own names', () => {
    const q = storesFromParams(new URLSearchParams('chain=OlaCare&sync=paused&health=silent&q=abc12'))
    expect(q).toEqual({ chain: 'OlaCare', sync: 'paused', health: 'silent', q: 'abc12' })
    expect(storesToParams(q).toString()).toBe('chain=OlaCare&sync=paused&health=silent&q=abc12')
  })

  it('a value the door does not know reads as its default (never sent — it would be a 400)', () => {
    expect(storesFromParams(new URLSearchParams('sync=sleeping&health=bad'))).toMatchObject({ sync: 'any', health: 'any' })
  })

  it('text is trimmed, and blank text is no filter; unicode is kept', () => {
    expect(storesFromParams(new URLSearchParams('q=%20%20&chain=%20'))).toMatchObject({ q: null, chain: null })
    expect(storesToParams({ chain: null, sync: 'any', health: 'any', q: 'العليا' }).get('q')).toBe('العليا')
  })
})
