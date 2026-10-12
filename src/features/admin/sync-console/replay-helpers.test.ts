import { describe, expect, it } from 'vitest'
import { REPLAY_REMOVED } from '@/core/models/sync-console'
import {
  lineColumn,
  pushReady,
  removedLabel,
  replayFailure,
  replayPreflight,
  replayRequest,
  targetStoreCode,
  type ReplaySummary,
} from './replay-helpers'
import en from '@/locales/en/sync-console.json'

/** Read a dotted key out of the en bundle, so a label key that renders raw fails here. */
const label = (key: string): unknown =>
  key.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], en)

/** A completed sale in the engine's real shape (PascalCase, as Newtonsoft writes it). Obviously fake values. */
const sale = (over: { header?: Record<string, unknown>; tenders?: unknown[]; lines?: unknown[] } = {}) => ({
  SchemaVersion: 1,
  Header: {
    TransactionId: 'FAKE-TX-0001',
    StoreId: 'P999',
    RegisterId: 'R01',
    ReceiptNumber: 'FAKE-0001-000001',
    Status: 'Completed',
    IsReturn: false,
    IsTraining: false,
    GrandTotal: 115.5,
    TotalTendered: 120,
    TotalApplied: 115.5,
    TotalChange: 4.5,
    ...over.header,
  },
  Lines: over.lines ?? [{ Sku: 'FAKE-SKU-1' }, { Sku: 'FAKE-SKU-2' }],
  Conditions: [],
  Tenders: over.tenders ?? [
    { TenderType: 'Cash', Amount: 100, AppliedAmount: 95.5, ChangeAmount: 4.5 },
    { TenderType: 'Card', Amount: 20, AppliedAmount: 20, ChangeAmount: 0 },
  ],
  Coupons: [],
})

const text = (value: unknown) => JSON.stringify(value, null, 2)

const summaryOf = (value: unknown): ReplaySummary => {
  const p = replayPreflight(text(value))
  if (p.kind !== 'summary') throw new Error(`expected a summary, got ${JSON.stringify(p)}`)
  return p.summary
}

describe('replayPreflight', () => {
  it('summarises a completed sale', () => {
    expect(replayPreflight(text(sale()))).toEqual({
      kind: 'summary',
      summary: {
        sourceStoreCode: 'P999',
        sourceReceiptNumber: 'FAKE-0001-000001',
        sourceTransactionId: 'FAKE-TX-0001',
        docKind: 'sale',
        completed: true,
        training: false,
        lineCount: 2,
        total: 115.5,
        tenderTotal: 115.5,
        balanced: true,
      },
    })
  })

  it('reads the keys case-insensitively (camelCase too)', () => {
    const camel = {
      header: { transactionId: 'FAKE-TX-2', storeId: 'P998', receiptNumber: 'FAKE-2', status: 'completed', isReturn: false, isTraining: false, grandTotal: 10 },
      lines: [{}],
      tenders: [{ appliedAmount: 10 }],
    }
    expect(summaryOf(camel)).toMatchObject({ sourceStoreCode: 'P998', sourceReceiptNumber: 'FAKE-2', sourceTransactionId: 'FAKE-TX-2', completed: true, lineCount: 1, total: 10, tenderTotal: 10, balanced: true })
  })

  it('gives invalid JSON its position', () => {
    const bad = '{\n  "Header": {,\n}'
    const p = replayPreflight(bad)
    expect(p.kind).toBe('invalid')
    if (p.kind !== 'invalid') return
    expect(p.reason).toBe('json')
    expect(p.at).toBe(bad.indexOf(','))
    expect(lineColumn(bad, p.at as number)).toEqual({ line: 2, column: 14 })
  })

  it('reads a line-and-column message (Firefox) as the same offset', () => {
    const bad = '{\n  "Header": {,\n}'
    const parse = JSON.parse
    JSON.parse = () => {
      throw new SyntaxError("JSON.parse: expected property name or '}' at line 2 column 14 of the JSON data")
    }
    try {
      expect(replayPreflight(bad)).toEqual({ kind: 'invalid', reason: 'json', at: bad.indexOf(',') })
    } finally {
      JSON.parse = parse
    }
  })

  it('gives no position for a message it cannot read, rather than a wrong one', () => {
    const parse = JSON.parse
    JSON.parse = () => {
      throw new SyntaxError('Bad JSON')
    }
    try {
      expect(replayPreflight('{,}')).toEqual({ kind: 'invalid', reason: 'json', at: null })
    } finally {
      JSON.parse = parse
    }
  })

  it('places a truncated paste at its end', () => {
    const cut = '{"Header": {'
    const p = replayPreflight(cut)
    expect(p).toMatchObject({ kind: 'invalid', reason: 'json', at: cut.length })
  })

  it('says nothing was pasted for a blank box', () => {
    expect(replayPreflight('   \n ')).toEqual({ kind: 'invalid', reason: 'empty', at: null })
  })

  it('refuses a value that is not an object', () => {
    for (const v of ['[]', '42', '"P001"', 'null', 'true', '[{"Header":{}}]'])
      expect(replayPreflight(v)).toEqual({ kind: 'invalid', reason: 'notObject', at: null })
  })

  it('refuses a snapshot with no header, and never reads a missing total as zero', () => {
    expect(replayPreflight(text({ Lines: [], Tenders: [] }))).toEqual({ kind: 'invalid', reason: 'noHeader', at: null })
    expect(replayPreflight(text({ Header: 'x' }))).toEqual({ kind: 'invalid', reason: 'noHeader', at: null })
    const noTotal = sale()
    delete (noTotal.Header as Record<string, unknown>).GrandTotal
    expect(replayPreflight(text(noTotal))).toEqual({ kind: 'invalid', reason: 'noTotal', at: null })
    expect(replayPreflight(text(sale({ header: { GrandTotal: '115.5' } })))).toEqual({ kind: 'invalid', reason: 'noTotal', at: null })
  })

  it('refuses a tender with no applied amount rather than counting it as zero', () => {
    expect(replayPreflight(text(sale({ tenders: [{ TenderType: 'Cash', Amount: 115.5 }] })))).toEqual({ kind: 'invalid', reason: 'tenderAmount', at: null })
  })

  it('refuses tenders that are not a list', () => {
    expect(replayPreflight(text({ ...sale(), Tenders: 'cash' }))).toEqual({ kind: 'invalid', reason: 'tenders', at: null })
  })

  it('reads a return, a void and a training sale', () => {
    expect(summaryOf(sale({ header: { IsReturn: true, GrandTotal: -115.5 }, tenders: [{ AppliedAmount: -115.5 }] }))).toMatchObject({ docKind: 'return', completed: true })
    expect(summaryOf(sale({ header: { Status: 'VOIDED' } }))).toMatchObject({ docKind: 'void', completed: false })
    expect(summaryOf(sale({ header: { IsTraining: true } }))).toMatchObject({ docKind: 'sale', training: true })
  })

  it('reads a sale that is not completed', () => {
    expect(summaryOf(sale({ header: { Status: 'Open' } }))).toMatchObject({ docKind: 'sale', completed: false })
    const noStatus = sale()
    delete (noStatus.Header as Record<string, unknown>).Status
    expect(summaryOf(noStatus)).toMatchObject({ docKind: 'sale', completed: false })
  })

  it('judges the balance to the cent', () => {
    // Float sums that miss by a hair still balance…
    expect(summaryOf(sale({ header: { GrandTotal: 0.3 }, tenders: [{ AppliedAmount: 0.1 }, { AppliedAmount: 0.2 }] }))).toMatchObject({ tenderTotal: 0.1 + 0.2, balanced: true })
    // …and a cent apart does not.
    expect(summaryOf(sale({ header: { GrandTotal: 115.5 }, tenders: [{ AppliedAmount: 115.49 }] }))).toMatchObject({ balanced: false })
    // No tenders at all: 0 tendered against a non-zero total.
    expect(summaryOf({ ...sale(), Tenders: [] })).toMatchObject({ tenderTotal: 0, balanced: false })
  })

  it('counts no lines when Lines is missing, and leaves an absent source field null', () => {
    const bare = { Header: { GrandTotal: 0, Status: 'Completed' } }
    expect(summaryOf(bare)).toMatchObject({ lineCount: 0, sourceStoreCode: null, sourceReceiptNumber: null, sourceTransactionId: null, balanced: true })
  })

  it('reads a numeric source field as its text', () => {
    expect(summaryOf(sale({ header: { StoreId: 1001 } })).sourceStoreCode).toBe('1001')
  })
})

describe('pushReady', () => {
  it('lets only a valid completed sale through (473 adds training and the balance)', () => {
    expect(pushReady(replayPreflight(text(sale())))).toBe(true)
    expect(pushReady(replayPreflight(text(sale({ header: { IsReturn: true } }))))).toBe(false)
    expect(pushReady(replayPreflight(text(sale({ header: { Status: 'Voided' } }))))).toBe(false)
    expect(pushReady(replayPreflight(text(sale({ header: { Status: 'Open' } }))))).toBe(false)
    expect(pushReady(replayPreflight('{'))).toBe(false)
    expect(pushReady(replayPreflight(''))).toBe(false)
  })
})

describe('targetStoreCode', () => {
  it('trims and upper-cases the typed code', () => {
    expect(targetStoreCode('  p001 \n')).toBe('P001')
    expect(targetStoreCode('   ')).toBe('')
  })
})

describe('replayRequest', () => {
  it('sends the parsed object, the trimmed upper-cased store code and the register', () => {
    const json = text(sale())
    const body = replayRequest(json, ' p012 ', 'R02')
    expect(body).toEqual({ targetStoreCode: 'P012', registerId: 'R02', snapshot: sale() })
    expect(typeof body?.snapshot).toBe('object')
  })

  it('sends the snapshot exactly as pasted, edits included', () => {
    const edited = sale({ header: { GrandTotal: 1 }, tenders: [{ AppliedAmount: 1 }] })
    expect(replayRequest(text(edited), 'P001', 'R01')?.snapshot).toEqual(edited)
  })

  it('builds nothing from JSON that does not parse to an object, or with no store or register', () => {
    expect(replayRequest('{', 'P001', 'R01')).toBeNull()
    expect(replayRequest('[]', 'P001', 'R01')).toBeNull()
    expect(replayRequest(text(sale()), '  ', 'R01')).toBeNull()
    expect(replayRequest(text(sale()), 'P001', '')).toBeNull()
  })
})

describe('removedLabel', () => {
  it('words every removed link, from a key that exists', () => {
    for (const r of REPLAY_REMOVED) {
      const key = removedLabel(r)
      expect(key).toBe(`replay.result.removed.${r}`)
      expect(label(key as string)).toEqual(expect.any(String))
    }
  })

  it('has no words for a link this bundle does not know, so it shows raw', () => {
    expect(removedLabel('pharmacyNote')).toBeNull()
    expect(removedLabel('toString')).toBeNull()
  })
})

describe('replayFailure', () => {
  it('takes the console shared words for a code that has them, and raw for one that does not (473 words the rest)', () => {
    expect(replayFailure('NO_STORE')).toEqual({ labelKey: 'failures.NO_STORE', showCode: true })
    expect(replayFailure('NOT_NEWPOS_STORE')).toEqual({ labelKey: null, showCode: true })
    expect(replayFailure(null)).toEqual({ labelKey: null, showCode: false })
  })
})

describe('the preflight words', () => {
  it('has a sentence for every reason and every kind', () => {
    for (const r of ['empty', 'json', 'notObject', 'noHeader', 'noTotal', 'tenders', 'tenderAmount']) expect(label(`replay.preflight.invalid.${r}`)).toEqual(expect.any(String))
    for (const k of ['sale', 'return', 'void']) expect(label(`replay.preflight.kinds.${k}`)).toEqual(expect.any(String))
  })
})
