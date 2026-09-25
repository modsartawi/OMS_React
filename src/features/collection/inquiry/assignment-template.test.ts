import { describe, expect, it } from 'vitest'
import {
  ASSIGNMENT_TEMPLATE_COLUMNS,
  ASSIGNMENT_TEMPLATE_FILENAME,
  assignmentTemplateCsv,
} from './assignment-template'

/**
 * **The blank assignment sheet** (ticket 318). A template whose header drifted from the
 * door's would be found by finance as a file the server refuses to read — and the
 * header is the one part of it nothing else in this repo asserts.
 */
describe('assignmentTemplateCsv', () => {
  // 🔑 BackOffice 1996's Web contract: "header row exactly StoreCode | AccountantId |
  // CollectorId". A rename here is a rename of the contract.
  it('is exactly the three headers the door reads', () => {
    expect(assignmentTemplateCsv()).toBe('StoreCode,AccountantId,CollectorId\r\n')
    expect(ASSIGNMENT_TEMPLATE_COLUMNS).toEqual(['StoreCode', 'AccountantId', 'CollectorId'])
  })

  // ⚠️ The upload is all or nothing: an example row left in the sheet would be refused
  // and refuse finance's own rows with it. So the template carries no row to delete.
  it('carries no example row that could refuse the whole file', () => {
    const lines = assignmentTemplateCsv().split('\r\n').filter((line) => line.trim())
    expect(lines).toHaveLength(1)
  })

  it('is a CSV with no BOM and no formula wrappers', () => {
    const csv = assignmentTemplateCsv()
    expect(csv.charCodeAt(0)).not.toBe(0xfeff)
    expect(csv).not.toContain('="')
    expect(ASSIGNMENT_TEMPLATE_FILENAME).toMatch(/\.csv$/)
  })
})
