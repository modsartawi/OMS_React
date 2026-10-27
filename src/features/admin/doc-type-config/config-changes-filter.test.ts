/** Ticket 3152 — the Config changes filter: what is sent, and a range the page refuses before sending. */
import { describe, expect, it } from 'vitest'
import { EMPTY_CONFIG_CHANGE_FILTER, configChangeParams, configChangeRangeValid, isFilteredConfigChanges } from './config-changes-filter'

const f = (over: Partial<typeof EMPTY_CONFIG_CHANGE_FILTER>) => ({ ...EMPTY_CONFIG_CHANGE_FILTER, ...over })

describe('config changes filter', () => {
  it('sends every field trimmed, days as typed (local)', () => {
    expect(configChangeParams(f({ entityType: 'DocumentType', entityKey: ' BUPA ', user: ' ali ', from: '2026-10-01', to: '2026-10-27' }))).toEqual({
      entityType: 'DocumentType',
      entityKey: 'BUPA',
      user: 'ali',
      from: '2026-10-01',
      to: '2026-10-27',
    })
  })

  it('one day is a valid range; From after To is not; an open end is', () => {
    expect(configChangeRangeValid(f({ from: '2026-10-27', to: '2026-10-27' }))).toBe(true)
    expect(configChangeRangeValid(f({ from: '2026-10-28', to: '2026-10-27' }))).toBe(false)
    expect(configChangeRangeValid(f({ from: '2026-10-28' }))).toBe(true)
  })

  it('blank or white space is no filter', () => {
    expect(isFilteredConfigChanges(EMPTY_CONFIG_CHANGE_FILTER)).toBe(false)
    expect(isFilteredConfigChanges(f({ user: '  ' }))).toBe(false)
    expect(isFilteredConfigChanges(f({ to: '2026-10-27' }))).toBe(true)
  })
})
