import { describe, expect, it } from 'vitest'
import { drawerFromParams, pushesDoorParams, pushesFromParams, pushesToParams, withDrawer } from './pushes-query'

describe('the push log URL and door', () => {
  it('round-trips every filter', () => {
    const q = pushesFromParams(new URLSearchParams('store=1234&type=F&status=E&from=2026-11-01&to=2026-11-07&page=2'))
    expect(q).toEqual({ store: '1234', type: 'F', status: 'E', from: '2026-11-01', to: '2026-11-07', page: 2 })
    expect(pushesToParams(q).toString()).toBe('store=1234&type=F&status=E&from=2026-11-01&to=2026-11-07&page=2')
  })

  it('drops what the door does not know', () => {
    expect(pushesFromParams(new URLSearchParams('type=X&status=live&from=07/11/2026&page=0'))).toEqual({ store: null, type: null, status: null, from: null, to: null, page: 1 })
  })

  it('sends skip / take', () => {
    expect(pushesDoorParams(pushesFromParams(new URLSearchParams('page=3')))).toMatchObject({ skip: 100, take: 50 })
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
