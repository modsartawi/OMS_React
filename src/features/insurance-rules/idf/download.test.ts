/**
 * The IDF downloads' fallback file names (BackOffice spec 3185; oms 644 / 650 / 651 / 652). The server's
 * `Content-Disposition` name wins; these are used only when it sends none, so each must still say what the file is.
 *
 * ⚠️ Parallel slices: add your ticket's describe under YOUR slot comment only.
 */
import { describe, expect, it } from 'vitest'

import { masterExportFileName, masterTemplateFileName } from './download'
import { changesExportFileName } from './download' // 650

// 644 · master export + template
describe('master export + template file names (644)', () => {
  it('export file name names the master and version', () => {
    expect(masterExportFileName('M-BUPA', { versionId: 'V-11', number: 3 })).toBe('idf-master-M-BUPA-v3.xlsx')
    expect(masterExportFileName('M-OPS', { versionId: 'V-4', number: 1 })).toBe('idf-master-M-OPS-v1.xlsx')
  })
  it('a version the history does not hold is named by its id', () => {
    expect(masterExportFileName('M-BUPA', { versionId: 'V-99' })).toBe('idf-master-M-BUPA-V-99.xlsx')
  })
  it('characters a file system refuses become a dash', () => {
    expect(masterExportFileName('M/BUPA: east', { versionId: 'V-1', number: 12 })).toBe('idf-master-M-BUPA-east-v12.xlsx')
  })
  it('the template names no master', () => {
    expect(masterTemplateFileName()).toBe('idf-master-template.xlsx')
  })
})

// 650 · change log export
describe('change log export file name (650)', () => {
  it('names the general change log and its window, an open end left out', () => {
    expect(changesExportFileName({ from: '', to: '' })).toBe('idf-general-changes.xlsx')
    expect(changesExportFileName({ from: '2026-10-01', to: '2026-10-27' })).toBe('idf-general-changes-20261001-to-20261027.xlsx')
    expect(changesExportFileName({ from: '2026-10-01', to: '' })).toBe('idf-general-changes-20261001.xlsx')
    expect(changesExportFileName({ from: '', to: '2026-10-27' })).toBe('idf-general-changes-to-20261027.xlsx')
  })
})

// 651 · general export + template

// 652 · IDF groups export + template
