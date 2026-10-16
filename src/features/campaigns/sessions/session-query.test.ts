import { describe, expect, it } from 'vitest'
import { backPath, canCancelSession, listQuery, sessionPath, sessionsPath, sessionsQueryFromParams, sessionsQueryToParams } from './session-query'

const read = (qs: string) => sessionsQueryFromParams(new URLSearchParams(qs))

describe('sessionsQueryFromParams', () => {
  it('reads the store, the local day and the status', () => {
    expect(read('store=P001&date=2026-10-16&status=closed')).toEqual({ store: 'P001', date: '2026-10-16', status: 'closed' })
  })

  it('reads an unknown status as every status, and a day that is not yyyy-MM-dd as none', () => {
    expect(read('store=P001&date=16/10/2026&status=won')).toEqual({ store: 'P001', date: '', status: null })
  })

  it('reads an empty address as no store, no day, every status', () => {
    expect(read('')).toEqual({ store: '', date: '', status: null })
  })

  it('writes back only what is set, and round-trips', () => {
    const q = { store: 'P001', date: '2026-10-16', status: 'cancelled' as const }
    expect(sessionsQueryToParams(q).toString()).toBe('store=P001&date=2026-10-16&status=cancelled')
    expect(read(sessionsQueryToParams(q).toString())).toEqual(q)
    expect(sessionsQueryToParams({ store: '', date: '', status: null }).toString()).toBe('')
  })
})

describe('listQuery', () => {
  it('asks for today when no day is chosen, and passes every status as null', () => {
    expect(listQuery({ store: 'P001', date: '', status: null }, '2026-10-16')).toEqual({ store: 'P001', date: '2026-10-16', status: null })
    expect(listQuery({ store: 'P001', date: '2026-10-01', status: 'open' }, '2026-10-16')).toEqual({ store: 'P001', date: '2026-10-01', status: 'open' })
  })
})

describe('canCancelSession', () => {
  it('offers a cancel on a session with something left to roll back', () => {
    expect(['open', 'paying', 'closed', 'partiallyReturned'].every((s) => canCancelSession(s as never))).toBe(true)
  })

  it('never on one already cancelled or wholly returned', () => {
    expect(canCancelSession('cancelled')).toBe(false)
    expect(canCancelSession('returned')).toBe(false)
  })
})

describe('paths', () => {
  it('escapes a sale id into one path segment', () => {
    expect(sessionPath('P001/2026/0042')).toBe('/campaigns/sessions/P001%2F2026%2F0042')
  })

  it('Back goes to the list it came from, as it was left', () => {
    expect(backPath({ fromList: '/campaigns/sessions?store=P001&date=2026-10-16&status=open' }, { store: 'P001', date: '2026-10-15', status: null })).toBe(
      '/campaigns/sessions?store=P001&date=2026-10-16&status=open',
    )
  })

  it('…else to its store and its day, and never off the Sessions list', () => {
    expect(backPath(null, { store: 'P001', date: '2026-10-15', status: null })).toBe('/campaigns/sessions?store=P001&date=2026-10-15')
    expect(backPath({ fromList: '/admin/users' }, null)).toBe('/campaigns/sessions')
  })

  it('opens the list on a store and a day', () => {
    expect(sessionsPath({ store: 'P001', date: '2026-10-16', status: null })).toBe('/campaigns/sessions?store=P001&date=2026-10-16')
    expect(sessionsPath()).toBe('/campaigns/sessions')
  })
})
