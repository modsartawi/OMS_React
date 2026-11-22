import { describe, expect, it } from 'vitest'
import { ApiError } from '@/core/api'
import type { StockConsoleLedgerLine } from '@/core/models/stock-console'
import {
  LEDGER_URL,
  LEDGER_WINDOW,
  SAP_URL,
  SAP_WINDOW,
  closeLines,
  emptyMovements,
  feedCell,
  ledgerDocument,
  ledgerEffects,
  markCell,
  movementsView,
  openLines,
  pressRead,
  toLedgerLine,
  windowRead,
  type MovementsState,
} from './movements'

const TODAY = '2026-11-22'
const state = (over: Partial<MovementsState> = {}): MovementsState => ({ ...emptyMovements(), ...over })

describe('the window is read only by its button', () => {
  it('neither tab asks before its button is pressed', () => {
    expect(windowRead(state(), SAP_WINDOW, TODAY)).toEqual({ kind: 'nothing' })
    expect(windowRead(state(), LEDGER_WINDOW, TODAY)).toEqual({ kind: 'nothing' })
  })

  it('once pressed with the boxes untouched, SAP reads yesterday and today, the ledger the last 7 days', () => {
    expect(windowRead(state({ ran: true }), SAP_WINDOW, TODAY)).toEqual({ kind: 'read', from: '2026-11-21', to: '2026-11-22' })
    expect(windowRead(state({ ran: true }), LEDGER_WINDOW, TODAY)).toEqual({ kind: 'read', from: '2026-11-16', to: '2026-11-22' })
  })

  it('a window over its limit asks nothing and says why', () => {
    expect(windowRead(state({ ran: true, from: '2026-11-17', to: '2026-11-22' }), SAP_WINDOW, TODAY)).toEqual({
      kind: 'stopped',
      problem: 'tooLong',
    })
    expect(windowRead(state({ ran: true, from: '2026-11-15', to: '2026-11-22' }), LEDGER_WINDOW, TODAY)).toEqual({
      kind: 'stopped',
      problem: 'tooLong',
    })
  })

  it('the longest window each allows is read: 5 entry days for SAP, 7 days for the ledger', () => {
    expect(windowRead(state({ ran: true, from: '2026-11-18', to: '2026-11-22' }), SAP_WINDOW, TODAY).kind).toBe('read')
    expect(windowRead(state({ ran: true, from: '2026-11-16', to: '2026-11-22' }), LEDGER_WINDOW, TODAY).kind).toBe('read')
  })

  it('a window whose first day is after its last, or a day that is not one, asks nothing', () => {
    expect(windowRead(state({ ran: true, from: '2026-11-22', to: '2026-11-21' }), SAP_WINDOW, TODAY)).toEqual({
      kind: 'stopped',
      problem: 'reversed',
    })
    expect(windowRead(state({ ran: true, from: '2026-02-30', to: '2026-03-01' }), SAP_WINDOW, TODAY)).toEqual({
      kind: 'stopped',
      problem: 'invalid',
    })
  })
})

describe('a SAP line’s mark', () => {
  it('the three marks map to their labels: applied ok, received not applied a warning, not received by us bad', () => {
    expect(markCell('Applied')).toEqual({ key: 'sap.mark.Applied', sev: 'ok' })
    expect(markCell('ReceivedNotApplied')).toEqual({ key: 'sap.mark.ReceivedNotApplied', sev: 'warn' })
    expect(markCell('NotReceived')).toEqual({ key: 'sap.mark.NotReceived', sev: 'bad' })
  })

  it('a mark the screen does not know is drawn raw, as a warning', () => {
    expect(markCell('Staged')).toEqual({ raw: 'Staged', sev: 'warn' })
  })
})

describe('what the tab draws', () => {
  const READ = { kind: 'read', from: '2026-11-21', to: '2026-11-22' } as const
  const refused = (code: string, message: string) => ({
    isPending: false,
    isError: true,
    error: new ApiError('business', message, code === 'SapNotConfigured' ? 503 : 502, [
      { errorCode: code, internalErrorCode: '', errorMessage: message },
    ]),
    rows: undefined,
  })

  it('SAP not configured says its sentence, not an empty list', () => {
    const view = movementsView(READ, refused('SapNotConfigured', 'Hana:ConnectionString is empty'))
    expect(view).toEqual({ kind: 'refused', refusal: { code: 'SapNotConfigured', key: 'refusal.SapNotConfigured', reason: null } })
  })

  it('SAP unreachable says its sentence with SAP’s reason, not an empty list', () => {
    const view = movementsView(READ, refused('SapUnreachable', 'SAP did not answer within 30 s'))
    expect(view).toEqual({
      kind: 'refused',
      refusal: { code: 'SapUnreachable', key: 'refusal.SapUnreachable', reason: 'SAP did not answer within 30 s' },
    })
  })

  it('a refusal is drawn even when the last answer is still kept on screen', () => {
    const view = movementsView(READ, { ...refused('SapUnreachable', 'down'), rows: 4 })
    expect(view.kind).toBe('refused')
  })

  it('an answer with no row is the empty sentence; with rows, the rows', () => {
    expect(movementsView(READ, { isPending: false, isError: false, error: null, rows: 0 })).toEqual({ kind: 'empty' })
    expect(movementsView(READ, { isPending: false, isError: false, error: null, rows: 3 })).toEqual({ kind: 'rows' })
  })

  it('before the button nothing is drawn but its sentence; a stopped window says why; a read in flight loads', () => {
    const pending = { isPending: true, isError: false, error: null, rows: undefined }
    expect(movementsView({ kind: 'nothing' }, pending)).toEqual({ kind: 'nothing' })
    expect(movementsView({ kind: 'stopped', problem: 'tooLong' }, pending)).toEqual({ kind: 'stopped', problem: 'tooLong' })
    expect(movementsView(READ, pending)).toEqual({ kind: 'loading' })
  })
})

const ledgerLine = (over: Partial<StockConsoleLedgerLine> = {}): StockConsoleLedgerLine => ({
  id: '01JD0000000000000000000000',
  at: '2026-11-22T10:15:00',
  feed: 'Sap',
  movementType: '251',
  quantity: -3,
  batch: 'B1',
  storageLocation: '0001',
  materialDocument: '4900012345',
  materialYear: 2026,
  materialLine: 2,
  tillStore: null,
  tillTrx: null,
  tillLine: null,
  postingDay: '2026-11-22',
  applied: true,
  onSap: 0,
  onTill: 0,
  ...over,
})

describe('a ledger line’s effect on each counter', () => {
  it('a SAP sale moves the SAP counter only', () => {
    expect(ledgerEffects(ledgerLine({ feed: 'Sap', movementType: '251', quantity: -3, onSap: -3, onTill: 0 }))).toEqual({
      onSap: { kind: 'moves', text: '-3' },
      onTill: { kind: 'none' },
    })
  })

  it('a till sale moves the till-side counter only', () => {
    const till = ledgerLine({
      feed: 'Pos',
      movementType: 'SALE',
      quantity: -1,
      materialDocument: null,
      materialYear: null,
      materialLine: null,
      tillStore: 'P077',
      tillTrx: '000123',
      tillLine: 1,
      onSap: 0,
      onTill: -1,
    })
    expect(ledgerEffects(till)).toEqual({ onSap: { kind: 'none' }, onTill: { kind: 'moves', text: '-1' } })
  })

  it('a receipt moves both, signed and grouped', () => {
    expect(ledgerEffects(ledgerLine({ movementType: '101', quantity: 1200, onSap: 1200, onTill: 1200 }))).toEqual({
      onSap: { kind: 'moves', text: '+1,200' },
      onTill: { kind: 'moves', text: '+1,200' },
    })
  })

  it('the feed and the document a line came from', () => {
    expect(feedCell('Sap')).toEqual({ key: 'movements.feed.Sap' })
    expect(feedCell('Pos')).toEqual({ key: 'movements.feed.Pos' })
    expect(feedCell('Hybris')).toEqual({ raw: 'Hybris' })
    expect(ledgerDocument(ledgerLine())).toBe('4900012345 · 2026 · 2')
    expect(ledgerDocument(ledgerLine({ materialDocument: null, tillStore: 'P077', tillTrx: '000123', tillLine: 1 }))).toBe(
      'P077 · 000123 · 1',
    )
    expect(ledgerDocument(ledgerLine({ materialDocument: null }))).toBe('')
  })
})

describe('a ledger line as read', () => {
  it('the contract’s names are kept as sent', () => {
    expect(toLedgerLine(ledgerLine())).toEqual(ledgerLine())
  })

  it('Stock Visibility’s built names read the same: time, a nested SAP or till document', () => {
    const sap = toLedgerLine({
      id: 'X',
      time: '2026-11-22T10:15:00',
      feed: 'Sap',
      movementType: '101',
      quantity: 5,
      batch: null,
      storageLocation: '0001',
      sapDocument: { materialDocument: '4900012345', year: 2026, item: 3 },
      tillDocument: null,
      postingDay: '2026-11-22',
      applied: false,
      onSap: 5,
      onTill: 5,
    })
    expect([sap.at, sap.materialDocument, sap.materialYear, sap.materialLine, sap.tillStore]).toEqual([
      '2026-11-22T10:15:00',
      '4900012345',
      2026,
      3,
      null,
    ])
    const till = toLedgerLine({ id: 'Y', feed: 'Pos', tillDocument: { store: 'P077', transaction: '000123', line: 1 } })
    expect([till.tillStore, till.tillTrx, till.tillLine, till.materialDocument, till.onSap, till.onTill]).toEqual([
      'P077',
      '000123',
      1,
      null,
      0,
      0,
    ])
  })
})

describe('the window lives in the address', () => {
  it('opening the tab is its name alone: nothing read, boxes at their defaults', () => {
    expect(SAP_URL.fromParams(new URLSearchParams('tab=sap'))).toEqual(emptyMovements())
  })

  it('the button writes the window, ran and page 1 — and closes an opened SAP row', () => {
    const pressed = pressRead(state({ page: 3, sapDay: '2026-11-21', sapType: '101' }), { from: '2026-11-20', to: '2026-11-22' })
    expect(SAP_URL.toParams(pressed).toString()).toBe('tab=sap&from=2026-11-20&to=2026-11-22&ran=1')
    expect(LEDGER_URL.toParams(pressed).toString()).toBe('tab=movements&from=2026-11-20&to=2026-11-22&ran=1')
  })

  it('a window over its limit is written too, so the tab says why it read nothing', () => {
    const pressed = pressRead(state(), { from: '2026-11-01', to: '2026-11-22' })
    expect(windowRead(SAP_URL.fromParams(SAP_URL.toParams(pressed)), SAP_WINDOW, TODAY)).toEqual({
      kind: 'stopped',
      problem: 'tooLong',
    })
  })

  it('a SAP row opens its lines at page 1, and pages them as sapPage; the ledger pages as page', () => {
    const read = state({ ran: true, from: '2026-11-21', to: '2026-11-22' })
    const opened = openLines({ ...read, page: 4 }, { day: '2026-11-21', movementType: '101' })
    expect(opened.page).toBe(1)
    expect(SAP_URL.toParams({ ...opened, page: 2 }).toString()).toBe(
      'tab=sap&from=2026-11-21&to=2026-11-22&ran=1&sapDay=2026-11-21&sapType=101&sapPage=2',
    )
    expect(SAP_URL.toParams(closeLines({ ...opened, page: 2 })).toString()).toBe('tab=sap&from=2026-11-21&to=2026-11-22&ran=1')
    expect(LEDGER_URL.toParams({ ...read, page: 2 }).toString()).toBe('tab=movements&from=2026-11-21&to=2026-11-22&ran=1&page=2')
  })

  it('reads back what it wrote; a bad page is 1', () => {
    const url = 'tab=sap&from=2026-11-21&to=2026-11-22&ran=1&sapDay=2026-11-21&sapType=101&sapPage=2'
    expect(SAP_URL.toParams(SAP_URL.fromParams(new URLSearchParams(url))).toString()).toBe(url)
    expect(LEDGER_URL.fromParams(new URLSearchParams('tab=movements&ran=1&page=x')).page).toBe(1)
  })
})
