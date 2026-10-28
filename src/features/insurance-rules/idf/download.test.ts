/**
 * The IDF downloads' fallback file names (BackOffice spec 3185; oms 644 / 650 / 651 / 652). The server's
 * `Content-Disposition` name wins; these are used only when it sends none, so each must still say what the file is.
 *
 * ⚠️ Parallel slices: add your ticket's describe under YOUR slot comment only.
 */
import { describe, expect, it } from 'vitest'

import { masterExportFileName, masterTemplateFileName } from './download'

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

// 651 · general export + template

// 652 · IDF groups export + template
