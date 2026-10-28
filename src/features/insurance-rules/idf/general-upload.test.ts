/**
 * Ticket 649 — a general upload (BackOffice 3193, the brief's "Spec 3185" sketch) checks a file and writes nothing: a
 * failing file shows its row report and is never applicable; a clean one shows the change preview (added / re-ranked /
 * moved / unchanged, each change before → after). Apply asks for a reason; its result lists any failed batch by its
 * lines.
 */
import { describe, expect, it } from 'vitest'
import {
  applyOutcome,
  failedBatchLines,
  IDF_GENERAL_CHANGE_KINDS,
  isGeneralUploadApplicable,
  previewRows,
  previewSide,
  type IdfGeneralChange,
  type IdfGeneralUploadReport,
} from './general-upload'

const preview = (changes: IdfGeneralChange[]) => ({ added: 1, reRanked: 1, moved: 1, unchanged: 1, changes })
const added: IdfGeneralChange = { itemNumber: '300700', change: 'added', before: null, after: { idfNumber: 'IDF-IBU', priority: 5 } }
const reRanked: IdfGeneralChange = { itemNumber: '300110', change: 'reRanked', before: { idfNumber: 'IDF-PARA-500', priority: 2 }, after: { idfNumber: 'IDF-PARA-500', priority: 1 } }
const moved: IdfGeneralChange = { itemNumber: '300230', change: 'moved', before: { idfNumber: 'IDF-IBU', priority: 4 }, after: { idfNumber: 'IDF-AMOX', priority: 1 } }
const same: IdfGeneralChange = { itemNumber: '300100', change: 'unchanged', before: { idfNumber: 'IDF-PARA-500', priority: 1 }, after: { idfNumber: 'IDF-PARA-500', priority: 1 } }
const all = [added, reRanked, moved, same]
const failing = { line: 4, itemNumber: '999999', rule: 'unknownItem', messageEn: 'Unknown item 999999.', messageAr: 'صنف غير معروف 999999.' }
const report = (r: Partial<IdfGeneralUploadReport>): IdfGeneralUploadReport => ({ uploadId: 'GU-1', ok: true, lineCount: 4, rows: [], preview: preview(all), ...r })

describe('a general upload is applicable only when ok and no row failed', () => {
  it('ok with no failing row applies', () => {
    expect(isGeneralUploadApplicable(report({}))).toBe(true)
  })
  it('a failing row does not, even when the flag says ok', () => {
    expect(isGeneralUploadApplicable(report({ rows: [failing] }))).toBe(false)
  })
  it('not ok with no row does not', () => {
    expect(isGeneralUploadApplicable(report({ ok: false }))).toBe(false)
  })
  it('no report or no upload id does not', () => {
    expect(isGeneralUploadApplicable(null)).toBe(false)
    expect(isGeneralUploadApplicable(report({ uploadId: '' }))).toBe(false)
  })
})

describe('preview filter by change kind', () => {
  it('no kind keeps every change in the server order', () => {
    expect(previewRows(preview(all), '').map((c) => c.itemNumber)).toEqual(['300700', '300110', '300230', '300100'])
  })
  it.each([
    ['added', ['300700']],
    ['reRanked', ['300110']],
    ['moved', ['300230']],
    ['unchanged', ['300100']],
  ] as const)('%s keeps only that kind', (kind, items) => {
    expect(previewRows(preview(all), kind).map((c) => c.itemNumber)).toEqual(items)
  })
  it('no preview, or no changes, is empty', () => {
    expect(previewRows(null, '')).toEqual([])
    expect(previewRows({ added: 0, reRanked: 0, moved: 0, unchanged: 0, changes: null as unknown as IdfGeneralChange[] }, 'added')).toEqual([])
  })
  it('names the four kinds in the brief order', () => {
    expect(IDF_GENERAL_CHANGE_KINDS).toEqual(['added', 'reRanked', 'moved', 'unchanged'])
  })
})

describe('one side of a change, and a failed batch, as one string each', () => {
  it('a side is its group and priority', () => {
    expect(previewSide({ idfNumber: 'IDF-AMOX', priority: 1 })).toBe('IDF-AMOX · 1')
  })
  it('no side (an added item has no before) is null', () => {
    expect(previewSide(null)).toBeNull()
  })
  it("a batch's lines are one range; a one-line batch is its line", () => {
    expect(failedBatchLines({ fromLine: 201, toLine: 400, messageEn: '', messageAr: '' })).toBe('201–400')
    expect(failedBatchLines({ fromLine: 7, toLine: 7, messageEn: '', messageAr: '' })).toBe('7')
  })
})

describe('an apply is a success only when every batch was written and something was (3185 review)', () => {
  const batch = { fromLine: 3, toLine: 4, messageEn: 'x', messageAr: 'x' }
  it('items written and no failed batch: applied', () => {
    expect(applyOutcome({ applied: 4, failedBatches: [] })).toBe('applied')
  })
  it('items written but a batch failed: partial', () => {
    expect(applyOutcome({ applied: 2, failedBatches: [batch] })).toBe('partial')
  })
  it('nothing written, with or without a failed batch: failed', () => {
    expect(applyOutcome({ applied: 0, failedBatches: [batch] })).toBe('failed')
    expect(applyOutcome({ applied: 0, failedBatches: [] })).toBe('failed')
  })
})
