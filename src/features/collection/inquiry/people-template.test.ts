import { describe, expect, it } from 'vitest'
import { PEOPLE_TEMPLATE_COLUMNS, PEOPLE_TEMPLATE_FILENAME, peopleTemplateCsv } from './people-template'

/**
 * **The blank people sheet** (ticket 337). A header that drifted from the door's would
 * be found by finance as a file the server refuses to read (all four columns are
 * required by BackOffice 2156).
 */
describe('peopleTemplateCsv', () => {
  // 🔑 BackOffice 2156's Web contract: "header row exactly StaffId | Name | Role |
  // SupervisorId". A rename here is a rename of the contract.
  it('people template has the four columns and no BOM', () => {
    const csv = peopleTemplateCsv()
    expect(csv).toBe('StaffId,Name,Role,SupervisorId\r\n')
    expect(PEOPLE_TEMPLATE_COLUMNS).toEqual(['StaffId', 'Name', 'Role', 'SupervisorId'])
    expect(csv.charCodeAt(0)).not.toBe(0xfeff)
    expect(csv).not.toContain('="')
    expect(PEOPLE_TEMPLATE_FILENAME).toMatch(/\.csv$/)
  })

  // ⚠️ The upload is all or nothing: an example row left in the sheet would be refused
  // and refuse finance's own rows with it.
  it('carries no example row that could refuse the whole file', () => {
    const lines = peopleTemplateCsv().split('\r\n').filter((line) => line.trim())
    expect(lines).toHaveLength(1)
  })
})
