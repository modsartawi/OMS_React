/**
 * Ticket 788 — the Insurance section's **Changes** timeline (BackOffice 3393): every accepted act with
 * who, when, item / quantity before and after, the reason, and the money source and totals before and
 * after; an act accepted before 3393 reads "not recorded", never zero; the document log on the same line.
 */
import { describe, expect, it } from 'vitest'
import type { InsuranceChangeEntry } from '@/core/models/order-insurance'
import type { OrderInsuranceReadWire } from '@/core/models/order-insurance'
import { insuranceReadOf } from './insurance-wire'
import type { SdDocumentLogModel } from '@/core/models/sd-document'
import changedJson from './__fixtures__/insurance-1006358461-changed.json'
import baseJson from './__fixtures__/insurance-1006358459.json'
import { timelineRows, type ChangeRow } from './insurance-timeline'

const CHANGED = insuranceReadOf(changedJson as unknown as OrderInsuranceReadWire)
const BASE = insuranceReadOf(baseJson as unknown as OrderInsuranceReadWire)

const changes = (rows: ReturnType<typeof timelineRows>) => rows.filter((r): r is ChangeRow => r.kind === 'change')

const log = (logNo: string, entryTime: string, actionType: string, actionTypeDescription: string): SdDocumentLogModel => ({
  logNo,
  documentNo: '1006358461',
  entryTime,
  entryUser: 'ph.alharbi',
  actionType,
  actionTypeDescription,
  actionData: '',
  actionOldData: '',
  note: '',
  staffId: '',
  storeCode: 'P001',
})

describe('insurance timeline', () => {
  it('an old act reads not recorded, not zero', () => {
    const [old] = changes(timelineRows(CHANGED.timeline, null, CHANGED.currency))
    expect(old.act).toBe('QUANTITY')
    expect(old.before).toEqual({ kind: 'notRecorded' })
    expect(old.after).toEqual({ kind: 'notRecorded' })
    expect(old.channelToEngine).toBe(false)
    // What it HAS is still shown: the quantity 2 → 1 and the reason.
    expect(old.quantity).toEqual({ before: '2 BOX', after: '1 BOX' })
    expect(old.reason).toBe('Doctor asked for one box')
  })

  it('a CHANNEL → ENGINE act is marked', () => {
    const [, swap] = changes(timelineRows(CHANGED.timeline, null, CHANGED.currency))
    expect(swap.act).toBe('SWAP')
    expect(swap.channelToEngine).toBe(true)
    expect(swap.before).toEqual({
      kind: 'recorded',
      source: 'CHANNEL',
      patient: { kind: 'amount', text: '63.65' },
      insurer: { kind: 'amount', text: '2.66' },
    })
    expect(swap.after).toEqual({
      kind: 'recorded',
      source: 'ENGINE',
      patient: { kind: 'amount', text: '13.26' },
      insurer: { kind: 'amount', text: '53.05' },
    })
    expect(swap.item).toEqual({ before: '100245', after: '100246' })
  })

  it('an act that stays on channel money is not marked', () => {
    const [pick] = changes(timelineRows(BASE.timeline, null, BASE.currency))
    expect(pick.act).toBe('PICK')
    expect(pick.channelToEngine).toBe(false)
    expect(pick.item).toEqual({ before: null, after: '100245' })
  })

  it('money is in the currency decimals: BHD shows three', () => {
    const [, swap] = changes(timelineRows(CHANGED.timeline, null, 'BHD'))
    expect(swap.after).toMatchObject({ patient: { kind: 'amount', text: '13.260' } })
  })

  it('a timeline without log rows takes the document log, oldest first', () => {
    const rows = timelineRows(CHANGED.timeline, [log('2', '2026-11-05T14:00:00', 'ORDY', 'Ready'), log('1', '2026-11-01T09:15:12', 'OADD', 'Order added')], CHANGED.currency)
    expect(rows.map((r) => (r.kind === 'change' ? r.act : r.action))).toEqual(['OADD', 'QUANTITY', 'SWAP', 'ORDY'])
  })

  it('a timeline the server already merged is not merged twice', () => {
    const rows = timelineRows(BASE.timeline, [log('9', '2026-11-05T12:57:34', 'OADD', 'Order added')], BASE.currency)
    expect(rows.map((r) => (r.kind === 'change' ? r.act : r.action))).toEqual(['OADD', 'PICK', 'DRDY'])
  })

  it('an act it does not know keeps its own code', () => {
    const [row] = changes(timelineRows([{ ...(CHANGED.timeline[1] as InsuranceChangeEntry), act: 'REPRICE' }], null, null))
    expect(row.actKey).toBeNull()
    expect(row.act).toBe('REPRICE')
  })
  it('an unreadable time does not break the order: A 10:00, B unreadable, C 09:00 reads C, A, B', () => {
    const swap = CHANGED.timeline[1] as InsuranceChangeEntry
    const at = (act: string, when: string): InsuranceChangeEntry => ({ ...swap, act, at: when })
    const rows = changes(timelineRows([at('PICK', '2026-11-05T10:00:00'), at('VOID', 'not a time'), at('RESTORE', '2026-11-05T09:00:00')], null, null))
    expect(rows.map((r) => r.act)).toEqual(['RESTORE', 'PICK', 'VOID'])
  })

  it('only the first CHANNEL → ENGINE act is marked: CHANNEL → ENGINE → CHANNEL → ENGINE marks one', () => {
    const swap = CHANGED.timeline[1] as InsuranceChangeEntry
    const toEngine = swap
    const toChannel: InsuranceChangeEntry = { ...swap, moneyBefore: swap.moneyAfter, moneyAfter: swap.moneyBefore }
    const at = (e: InsuranceChangeEntry, when: string): InsuranceChangeEntry => ({ ...e, at: when })
    const rows = changes(
      timelineRows([at(toEngine, '2026-11-05T12:00:00'), at(toChannel, '2026-11-05T11:00:00'), at(toEngine, '2026-11-05T10:00:00')], null, null),
    )
    expect(rows.map((r) => r.channelToEngine)).toEqual([true, false, false])
    expect(rows[0].at).toContain('10:00')
  })
})
