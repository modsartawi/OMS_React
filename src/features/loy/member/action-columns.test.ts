/**
 * What an action **row** puts on screen (ticket 238, second Proof bullet).
 *
 * Two external behaviours an agent could describe, and nothing about how the
 * grid computes them:
 *
 * - 🚩 an action whose description the server could not resolve reads as its raw
 *   code, never as a blank cell;
 * - 🚩 the member's own details reach no column — a page of audit history is
 *   audit history, not the same PII twenty-five times.
 */
import { describe, expect, it } from 'vitest'
import type { ColDef } from 'ag-grid-community'
import type { TFunction } from 'i18next'

import type { LoyMemberActionRow } from '@/core/models/loy'
import { ACTION_DEFAULT_COL_DEF, actionText, buildActionColumns } from './action-columns'

/** `t` as the columns use it: the key back, so a header is checkable by name. */
const t = ((key: string) => key) as unknown as TFunction

const columns = buildActionColumns(t)

/** What a `valueGetter` column renders for one row. */
const cell = (column: ColDef<LoyMemberActionRow>, data: LoyMemberActionRow) =>
  typeof column.valueGetter === 'function'
    ? column.valueGetter({ data } as never)
    : data[column.field as keyof LoyMemberActionRow]

const columnById = (id: string) =>
  columns.find((c) => (c.colId ?? c.field) === id) as ColDef<LoyMemberActionRow>

const ROW: LoyMemberActionRow = {
  actionNo: '4471',
  mainActionType: 'MUPD',
  mainActionDescription: 'Member update',
  subActionType: 'CHMB',
  subActionDescription: 'Change mobile',
  actionDateTime: '2026-07-30T11:04:00',
  actionData: '0555000111 → 0555000222',
  actionData2: '',
  userId: 'msartawi',
  branchId: '1001',
}

describe('an action description the server could not resolve', () => {
  it('🚩 falls back to its raw code rather than rendering a blank cell', () => {
    // Both description fields are LEFT JOINs and go null on a code that is in the
    // data but not in its type table.
    const unresolved: LoyMemberActionRow = {
      ...ROW,
      mainActionDescription: null,
      subActionDescription: null,
    }

    expect(cell(columnById('action'), unresolved)).toBe('MUPD')
    expect(cell(columnById('subAction'), unresolved)).toBe('CHMB')
  })

  it('prefers the server’s English whenever the join found some', () => {
    expect(cell(columnById('action'), ROW)).toBe('Member update')
    expect(cell(columnById('subAction'), ROW)).toBe('Change mobile')
  })

  it('treats a whitespace-only description as no description', () => {
    // A LEFT JOIN onto a blank description column is the same fact as a null one:
    // there is no English, so the code is what there is to say.
    expect(actionText('   ', 'MBLK')).toBe('MBLK')
  })

  it('renders empty only when there is neither a description nor a code', () => {
    // Not a state the source can produce; asserted so a future placeholder is a
    // deliberate change rather than a drift.
    expect(actionText(null, null)).toBe('')
  })

  it('leaves a sub-action with no code at all blank rather than borrowing the main one', () => {
    expect(cell(columnById('subAction'), { ...ROW, subActionType: null, subActionDescription: null }))
      .toBe('')
  })
})

describe('the seven columns', () => {
  it('are the seven 226 settled, in order', () => {
    expect(columns.map((c) => c.headerName)).toEqual([
      'tabs.actions.columns.when',
      'tabs.actions.columns.action',
      'tabs.actions.columns.subAction',
      'tabs.actions.columns.details',
      'tabs.actions.columns.details2',
      'tabs.actions.columns.by',
      'tabs.actions.columns.branch',
    ])
  })

  it('🚩 reach no member-snapshot field — the member is the header, not 25 grid rows', () => {
    // The wire row is denormalised with the whole member. None of it may surface.
    const snapshot = [
      'mobile',
      'fullName',
      'email',
      'gender',
      'cityName',
      'profileUpdated',
      'insuranceCompany',
      'blockedReason',
      'blockedReasonDescription',
      'joinedDate',
    ]
    const bound = columns.flatMap((c) => [c.field, c.colId].filter(Boolean))

    for (const field of snapshot) expect(bound).not.toContain(field)
  })

  it('shows ActionData2 — the user’s ruling: nothing is hidden from the agent', () => {
    expect(columns.some((c) => c.field === 'actionData2')).toBe(true)
  })

  it('🚩 offers no sort and no filter — sort what you hold, never what you page through', () => {
    expect(ACTION_DEFAULT_COL_DEF.sortable).toBe(false)
    expect(ACTION_DEFAULT_COL_DEF.filter).toBe(false)
    // And no column may re-enable either one for itself.
    expect(columns.some((c) => c.sortable === true || c.filter === true)).toBe(false)
  })
})
