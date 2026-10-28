/**
 * Ticket 653 — an IDF groups import (BackOffice 3197, the brief's "Spec 3185" sketch) lists EVERY row with its action;
 * a failing row names its rule. Apply is offered only when the server says `ok` AND no row names a rule (unlike a
 * master upload, the rows are never empty here, so `isPublishable` is the wrong test). The counts say how many rows
 * would add and how many would update.
 */
import { describe, expect, it } from 'vitest'
import { groupsImportCounts, groupsImportRuleWordKey, isGroupsImportApplicable, IDF_GROUPS_IMPORT_RULES, type IdfGroupsImportReport } from './groups-import'

const add = { line: 2, idfNumber: 'IDF-0600', action: 'add' as const, rule: '', messageEn: '', messageAr: '' }
const upd = { line: 3, idfNumber: 'IDF-0101', action: 'update' as const, rule: '', messageEn: '', messageAr: '' }
const bad = { line: 4, idfNumber: '', action: 'add' as const, rule: 'missingNumber', messageEn: 'The group number is missing.', messageAr: 'رقم المجموعة مفقود.' }

describe('a groups import is applicable only when ok and no row failed', () => {
  it('ok with every row passing applies', () => {
    expect(isGroupsImportApplicable({ uploadId: 'G-1', ok: true, rows: [add, upd] })).toBe(true)
  })
  it('a failing row does not, even when the flag says ok (the rows win)', () => {
    expect(isGroupsImportApplicable({ uploadId: 'G-2', ok: true, rows: [add, bad] })).toBe(false)
  })
  it('not ok with every row passing does not (the flag wins)', () => {
    expect(isGroupsImportApplicable({ uploadId: 'G-3', ok: false, rows: [add] })).toBe(false)
  })
  it('no report, no id, or no rows does not — an empty file applies nothing', () => {
    expect(isGroupsImportApplicable(null)).toBe(false)
    expect(isGroupsImportApplicable({ uploadId: '', ok: true, rows: [add] })).toBe(false)
    expect(isGroupsImportApplicable({ uploadId: 'G-4', ok: true, rows: [] })).toBe(false)
    expect(isGroupsImportApplicable({ uploadId: 'G-5', ok: true, rows: null } as unknown as IdfGroupsImportReport)).toBe(false)
  })
  it('a null rule counts as passing', () => {
    expect(isGroupsImportApplicable({ uploadId: 'G-6', ok: true, rows: [{ ...add, rule: null as unknown as string }] })).toBe(true)
  })
})

describe('the add / update counts', () => {
  it('counts the passing rows by action and the failing rows apart', () => {
    expect(groupsImportCounts([add, upd, { ...upd, line: 5, idfNumber: 'IDF-0102' }, bad])).toEqual({ add: 1, update: 2, failed: 1 })
  })
  it('no rows is all zero', () => {
    expect(groupsImportCounts(null)).toEqual({ add: 0, update: 0, failed: 0 })
  })
})

describe('a rule has a word', () => {
  it('the four rules the door names', () => {
    expect([...IDF_GROUPS_IMPORT_RULES]).toEqual(['missingNumber', 'duplicateNumber', 'numberTooLong', 'missingDescription'])
    expect(groupsImportRuleWordKey('duplicateNumber')).toBe('groupsImport.rule.duplicateNumber')
  })
  it('an unknown rule has none (the screen shows its code)', () => {
    expect(groupsImportRuleWordKey('unknownItem')).toBeNull()
    expect(groupsImportRuleWordKey('')).toBeNull()
  })
})
