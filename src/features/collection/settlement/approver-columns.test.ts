import { describe, expect, it } from 'vitest'
import type { TFunction } from 'i18next'

import { buildAccountColumns } from './account-columns'
import { projectAccount } from './account-projection'
import { APPROVAL_ACCOUNT, SUPERVISOR_ID } from './approval-fixture'
import { auditColumn } from './audit'
import { approvedAtCell, approvedByCell } from './entry-cells'
import { buildLedgerColumns } from './ledger-columns'

/**
 * Spec 2423 (ticket 426): **Approved by** and **Approved at** on the Ledger and on a
 * branch's Account, after Posted at, and the audit pane naming the approver.
 */

const t = ((key: string) => key) as unknown as TFunction
const ids = (cols: { colId?: string }[]) => cols.map((c) => c.colId)

describe('ledger and account columns include Approved by/at after Posted at', () => {
  it('on the ledger: Posted at → Approved by → Approved at', () => {
    const order = ids(buildLedgerColumns(t, false))
    const at = order.indexOf('postedAt')
    expect(at).toBeGreaterThan(-1)
    expect(order.slice(at, at + 3)).toEqual(['postedAt', 'approvedBy', 'approvedAt'])
  })

  it('on the account: Posted at → Approved by → Approved at, the journal count still last', () => {
    const order = ids(buildAccountColumns(t, 'SAR'))
    const at = order.indexOf('postedAt')
    expect(at).toBeGreaterThan(-1)
    expect(order.slice(at, at + 3)).toEqual(['postedAt', 'approvedBy', 'approvedAt'])
    expect(order.at(-1)).toBe('journalCount')
  })

  it('both grids label them with the same keys', () => {
    for (const cols of [buildLedgerColumns(t, false), buildAccountColumns(t, 'SAR')]) {
      const header = (id: string) => cols.find((c) => c.colId === id)?.headerName
      expect(header('approvedBy')).toBe('account.columns.approvedBy')
      expect(header('approvedAt')).toBe('account.columns.approvedAt')
    }
  })
})

describe('approved by falls back to staff id when the name is blank', () => {
  const AT = '2026-09-21T16:00:00'

  it('shows the stamped name', () => {
    expect(approvedByCell({ approvedByStaffId: 'SUP1', approvedByName: 'Majed Al-Otaibi', approvedAt: AT })).toBe(
      'Majed Al-Otaibi',
    )
  })

  it('falls back to the staff id when the name is blank (approved before BackOffice 2430)', () => {
    expect(approvedByCell({ approvedByStaffId: 'SUP1', approvedByName: '', approvedAt: AT })).toBe('SUP1')
    expect(approvedByCell({ approvedByStaffId: 'SUP1', approvedByName: '   ', approvedAt: AT })).toBe('SUP1')
  })

  it('falls back to the staff id when an older SIS.Api sends no name at all', () => {
    expect(approvedByCell({ approvedByStaffId: 'SUP1', approvedAt: AT })).toBe('SUP1')
  })

  it('is blank, not a dash, on an entry nobody approved', () => {
    expect(approvedByCell({ approvedByStaffId: '', approvedAt: '0001-01-01T00:00:00' })).toBe('')
    expect(approvedByCell(undefined)).toBe('')
  })

  it('🚩 names nobody without a stamp — Approved by, Approved at and the audit pane agree', () => {
    // The audit fact needs `approvedByStaffId && isStamped(approvedAt)`; a grid naming an
    // approver beside a blank Approved at would contradict it.
    expect(approvedByCell({ approvedByStaffId: 'SUP1', approvedByName: 'Majed', approvedAt: '0001-01-01T00:00:00' })).toBe('')
  })

  it('approved at is blank on the year-1 default, and formatted like Posted at otherwise', () => {
    expect(approvedAtCell({ approvedAt: '0001-01-01T00:00:00' })).toBe('')
    expect(approvedAtCell({ approvedAt: '' })).toBe('')
    expect(approvedAtCell({ approvedAt: '2026-09-21T16:00:00' })).toBe('2026-09-21 16:00')
  })
})

describe('the audit pane names the approver', () => {
  /** 0719's entry 1205 — a supervisor's own large surplus, approved by its poster —
   *  with the approver's name patched in as BackOffice 2430 stamps it. */
  const selfApproved = (approvedByName: string) =>
    projectAccount({
      ...APPROVAL_ACCOUNT,
      entries: APPROVAL_ACCOUNT.entries.map((e) => (e.entryNumber === 1205 ? { ...e, approvedByName } : e)),
    }).find((r) => r.entryNumber === 1205)

  it('by the name the server stamped', () => {
    const facts = auditColumn(selfApproved('ماجد العتيبي / Majed Al-Otaibi'))
    expect(facts.find((f) => f.kind === 'approved')?.where).toEqual({
      kind: 'person',
      name: 'ماجد العتيبي / Majed Al-Otaibi',
    })
  })

  it('…by staff id when no name was stamped', () => {
    const facts = auditColumn(selfApproved(''))
    expect(facts.find((f) => f.kind === 'approved')?.where).toEqual({ kind: 'staff', staffId: SUPERVISOR_ID })
  })
})
