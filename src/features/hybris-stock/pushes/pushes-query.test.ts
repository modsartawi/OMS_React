import { describe, expect, it } from 'vitest'
import { drawerFromParams, mayHoldMore, moreTake, pushesDoorParams, pushesFilterKey, pushesFromParams, pushesToParams, withDate, withDrawer } from './pushes-query'

describe('the push log URL and door', () => {
  it("round-trips every filter in the log's words", () => {
    const q = pushesFromParams(new URLSearchParams('store=1234&type=now-store&status=failed&from=2026-11-01&to=2026-11-07&take=100'))
    expect(q).toEqual({ store: '1234', type: 'now-store', status: 'failed', from: '2026-11-01', to: '2026-11-07', take: 100 })
    expect(pushesToParams(q).toString()).toBe('store=1234&type=now-store&status=failed&from=2026-11-01&to=2026-11-07&take=100')
  })

  it('drops what the door does not know (so it never answers HybrisStockFilterUnknown / InputInvalid)', () => {
    expect(pushesFromParams(new URLSearchParams('type=F&status=S&from=07/11/2026&take=0'))).toEqual({ store: null, type: null, status: null, from: null, to: null, take: 50 })
    expect(pushesFromParams(new URLSearchParams('take=501')).take).toBe(50)
    expect(pushesFromParams(new URLSearchParams('take=70')).take).toBe(50)
  })

  it('a link with from after to reads as the range it names, ends in order (the door refuses it reversed)', () => {
    expect(pushesFromParams(new URLSearchParams('from=2026-11-08&to=2026-11-01'))).toMatchObject({ from: '2026-11-01', to: '2026-11-08' })
  })

  it('moving from past to brings to along; moving to before from brings from along', () => {
    const q = pushesFromParams(new URLSearchParams('from=2026-11-01&to=2026-11-05'))
    expect(withDate(q, 'from', '2026-11-09')).toMatchObject({ from: '2026-11-09', to: '2026-11-09' })
    expect(withDate(q, 'to', '2026-10-28')).toMatchObject({ from: '2026-10-28', to: '2026-10-28' })
    expect(withDate(q, 'from', '2026-11-03')).toMatchObject({ from: '2026-11-03', to: '2026-11-05' })
    expect(withDate(q, 'to', null)).toMatchObject({ from: '2026-11-01', to: null })
  })

  it('the filter key ignores take, so Show more is the same filter and a filter change is not', () => {
    const a = pushesFromParams(new URLSearchParams('store=1234&take=50'))
    expect(pushesFilterKey({ ...a, take: 100 })).toBe(pushesFilterKey(a))
    expect(pushesFilterKey({ ...a, status: 'failed' })).not.toBe(pushesFilterKey(a))
  })

  it('sends take only — the door has no skip', () => {
    expect(pushesDoorParams(pushesFromParams(new URLSearchParams('take=150')))).toEqual({ store: null, type: null, status: null, from: null, to: null, take: 150 })
  })

  it('Show more asks 50 more, up to the door limit of 500', () => {
    expect(moreTake(50)).toBe(100)
    expect(moreTake(450)).toBe(500)
    expect(moreTake(500)).toBeNull()
  })

  it('a full page may hold more; a short one is all there is', () => {
    expect(mayHoldMore(50, 50)).toBe(true)
    expect(mayHoldMore(49, 50)).toBe(false)
  })
})

describe('the drawers in the URL', () => {
  it('a push lines drawer, or a material history', () => {
    expect(drawerFromParams(new URLSearchParams('push=P-1'))).toEqual({ kind: 'lines', pushId: 'P-1' })
    expect(drawerFromParams(new URLSearchParams('history=1234&material=100002'))).toEqual({ kind: 'material', storeCode: '1234', materialNumber: '100002' })
    expect(drawerFromParams(new URLSearchParams('history=1234'))).toEqual({ kind: 'material', storeCode: '1234', materialNumber: null })
    expect(drawerFromParams(new URLSearchParams('store=1'))).toBeNull()
  })

  it('withDrawer swaps the drawer and keeps the filters', () => {
    const p = new URLSearchParams('store=1234&push=P-1')
    expect(withDrawer(p, { kind: 'material', storeCode: '1234', materialNumber: '9' }).toString()).toBe('store=1234&history=1234&material=9')
    expect(withDrawer(p, null).toString()).toBe('store=1234')
  })
})
