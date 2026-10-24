/**
 * Ticket 544 — an order's prescription-session panel lines (BackOffice 3016 + 3014): the order's
 * row line, one line per session, and under each session one line per after-close event. Empty
 * `sessions` is no panel at all. Pure.
 */
import { describe, expect, it } from 'vitest'
import en from '@/locales/en/prescription-session.json'
import ar from '@/locales/ar/prescription-session.json'
import type {
  PrescriptionSessionAfterClose,
  PrescriptionSessionOrderStatus,
  PrescriptionSessionStatus,
  PrescriptionSessionStep,
} from '@/core/models/prescription-session'
import { orderSessionsView } from './lines'

const step = (over: Partial<PrescriptionSessionStep> = {}): PrescriptionSessionStep => ({
  code: 'AWAIT_APPROVAL',
  label: 'Waiting on payer approval',
  owner: 'PAYER',
  waitingOn: null,
  isParked: false,
  parkNote: null,
  badges: [],
  ...over,
})

const session = (sessionId: string, over: Partial<PrescriptionSessionStatus> = {}): PrescriptionSessionStatus => ({
  sessionId,
  displayId: `PS-${sessionId}`,
  sourceKind: 'NPHS',
  holdingStore: 'P001',
  state: 'AWAITING_APPROVAL',
  route: 'DELIVERY',
  step: step(),
  afterClose: [],
  ...over,
})

const order = (sessions: PrescriptionSessionStatus[], row: PrescriptionSessionStep | null = sessions[0]?.step ?? null) => ({
  documentNo: '1000000123',
  sessions,
  row,
  isInvoiced: false,
}) satisfies PrescriptionSessionOrderStatus

const event = (over: Partial<PrescriptionSessionAfterClose>): PrescriptionSessionAfterClose => ({
  kind: 'RETURN',
  originalSaleNo: 'S1',
  documentNo: 'R1',
  resaleNo: null,
  storeCode: 'P001',
  recordedAt: '2026-10-23T14:05:00',
  recordedBy: 'till.p001',
  ...over,
})

const has = (locale: unknown, key: string) =>
  typeof key.split('.').reduce<unknown>((n, part) => (n as Record<string, unknown> | undefined)?.[part], locale) === 'string'

describe('orderSessionsView — no session, no panel', () => {
  it('empty sessions → null (no heading, no empty state)', () => {
    expect(orderSessionsView(order([], null))).toBeNull()
  })
  it('no answer at all → null', () => {
    expect(orderSessionsView(null)).toBeNull()
    expect(orderSessionsView(undefined)).toBeNull()
  })
})

describe('orderSessionsView — one session', () => {
  const view = orderSessionsView(order([session('41')]))!

  it('the row line first: the step label as server text, its owner as a word', () => {
    expect(view.row).toEqual({
      label: 'Waiting on payer approval',
      owner: { key: 'owner.PAYER', raw: 'PAYER' },
      waitingOn: null,
      parked: false,
      parkNote: null,
      badges: [],
    })
  })

  it('one session line: display id, source, holding store, state, route, its step', () => {
    expect(view.sessions).toHaveLength(1)
    const s = view.sessions[0]
    expect(s.displayId).toBe('PS-41')
    expect(s.source).toEqual({ key: 'source.NPHS', raw: 'NPHS' })
    expect(s.holdingStore).toBe('P001')
    expect(s.state).toEqual({ key: 'state.AWAITING_APPROVAL', raw: 'AWAITING_APPROVAL' })
    expect(s.stateSev).toBe('go')
    expect(s.route).toEqual({ key: 'route.DELIVERY', raw: 'DELIVERY' })
    expect(s.step?.label).toBe('Waiting on payer approval')
    expect(s.afterClose).toEqual([])
  })

  it('a session with no step yet has no step line, and a null route reads not chosen', () => {
    const s = orderSessionsView(order([session('42', { step: null, route: null, state: 'DRAFT' })], null))!
    expect(s.row).toBeNull()
    expect(s.sessions[0].step).toBeNull()
    expect(s.sessions[0].route.key).toBe('route.notChosen')
  })
})

describe('orderSessionsView — a shared order with two sessions', () => {
  const waiting = step({ code: 'WAIT_SIBLING', label: 'Waiting on PS-51', owner: 'SYSTEM', waitingOn: 'PS-51' })
  const view = orderSessionsView(
    order(
      [
        session('50', { state: 'DISPENSED', step: waiting }),
        session('51', { state: 'AWAITING_APPROVAL', sourceKind: 'WSFT', holdingStore: 'P002' }),
      ],
      step({ label: '1 of 2 ready, Waiting on payer (PS-51)' }),
    ),
  )!

  it('both sessions are listed in full, in server order', () => {
    expect(view.sessions.map((s) => s.displayId)).toEqual(['PS-50', 'PS-51'])
    expect(view.sessions[1].source.key).toBe('source.WSFT')
    expect(view.sessions[1].holdingStore).toBe('P002')
  })

  it('the waiting session names the session it waits on', () => {
    expect(view.sessions[0].step?.waitingOn).toBe('PS-51')
    expect(view.sessions[1].step?.waitingOn).toBeNull()
  })

  it('the row line is the order-level line the server chose', () => {
    expect(view.row?.label).toBe('1 of 2 ready, Waiting on payer (PS-51)')
  })
})

describe('orderSessionsView — a parked session', () => {
  const parked = step({
    code: 'COLLECT',
    label: 'Customer collects',
    owner: 'CUSTOMER',
    isParked: true,
    parkNote: 'collects tomorrow',
    badges: ['EXPIRES_TOMORROW', 'SOMETHING_NEW'],
  })
  const s = orderSessionsView(order([session('60', { step: parked })]))!.sessions[0]

  it('parked, with its note', () => {
    expect(s.step?.parked).toBe(true)
    expect(s.step?.parkNote).toBe('collects tomorrow')
  })

  it('its badges as words; an unknown badge as itself', () => {
    expect(s.step?.badges).toEqual([
      { key: 'badge.EXPIRES_TOMORROW', raw: 'EXPIRES_TOMORROW' },
      { key: null, raw: 'SOMETHING_NEW' },
    ])
  })

  it('a note on a step that is not parked is not shown', () => {
    const v = orderSessionsView(order([session('61', { step: step({ parkNote: 'stale note' }) })]))!
    expect(v.sessions[0].step?.parkNote).toBeNull()
  })
})

describe('orderSessionsView — a closed session and what happened after', () => {
  const s = orderSessionsView(
    order([
      session('70', {
        state: 'CLOSED',
        step: null,
        afterClose: [
          event({ kind: 'RETURN', originalSaleNo: 'S1', documentNo: 'R1' }),
          event({ kind: 'CORRECTION', originalSaleNo: 'S1', documentNo: 'R2', resaleNo: 'I2', recordedBy: 'سارة' }),
          event({ kind: 'RESALE', originalSaleNo: 'S1', documentNo: 'I3', resaleNo: 'I3', storeCode: 'P009' }),
          event({ kind: 'REFUND_LATER', documentNo: 'X9' }),
        ],
      }),
    ], null),
  )!.sessions[0]

  it('one line per event, in server order, each with its sentence', () => {
    expect(s.stateSev).toBe('ok')
    expect(s.afterClose.map((e) => [e.kind.raw, e.sentence])).toEqual([
      ['RETURN', 'afterClose.line.RETURN'],
      ['CORRECTION', 'afterClose.line.CORRECTION'],
      ['RESALE', 'afterClose.line.RESALE'],
      ['REFUND_LATER', 'afterClose.line.other'],
    ])
  })

  it('each line carries its numbers, store, and recorded at + by', () => {
    expect(s.afterClose[1]).toEqual({
      kind: { key: 'afterClose.kind.CORRECTION', raw: 'CORRECTION' },
      sentence: 'afterClose.line.CORRECTION',
      sale: 'S1',
      document: 'R2',
      resale: 'I2',
      storeCode: 'P001',
      recordedAt: '2026-10-23T14:05:00',
      recordedBy: 'سارة',
    })
    expect(s.afterClose[2].storeCode).toBe('P009')
    expect(s.afterClose[0].resale).toBe('')
  })

  it('every sentence key exists in en and ar, and says what BackOffice Describe() says', () => {
    for (const e of s.afterClose) {
      expect([e.sentence, has(en, e.sentence)]).toEqual([e.sentence, true])
      expect([e.sentence, has(ar, e.sentence)]).toEqual([e.sentence, true])
    }
    expect(en.afterClose.line.RETURN).toBe('Returned <v>{{document}}</v> (sale <v>{{sale}}</v>)')
    expect(en.afterClose.line.CORRECTION).toBe(
      'Patient share corrected on <v>{{sale}}</v>: reversal <v>{{document}}</v>, re-invoice <v>{{resale}}</v>',
    )
    expect(en.afterClose.line.RESALE).toBe('Re-sold as <v>{{resale}}</v> (after sale <v>{{sale}}</v>)')
  })

  it('each sentence interpolates the same values in en and ar', () => {
    const vars = (s: string) => (s.match(/\{\{\w+\}\}/g) ?? []).sort()
    for (const k of ['RETURN', 'CORRECTION', 'RESALE', 'other'] as const)
      expect([k, vars(ar.afterClose.line[k])]).toEqual([k, vars(en.afterClose.line[k])])
  })
})

describe('orderSessionsView — state severities', () => {
  const sev = (state: string) => orderSessionsView(order([session('1', { state })]))!.sessions[0].stateSev
  it('in motion, owed, done, ended badly, unknown', () => {
    expect(sev('PICKING')).toBe('go')
    expect(sev('DISPENSED')).toBe('warn')
    expect(sev('INVOICED')).toBe('ok')
    expect(sev('WRITTEN_OFF')).toBe('bad')
    expect(sev('ABANDONED')).toBe('mute')
    expect(sev('NEW_STATE')).toBe('mute')
  })
})
