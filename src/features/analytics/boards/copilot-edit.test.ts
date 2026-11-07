import { describe, expect, it } from 'vitest'
import { copilotEditable } from './copilot-edit'

describe('which open item the copilot may edit (836, BackOffice 3408 item 37 + 3430)', () => {
  it('a saved item of mine that is not Certified', () => {
    expect(copilotEditable({ owner: 'u-1', tier: 'personal' }, 'u-1')).toBe('ok')
    expect(copilotEditable({ owner: 'u-1', tier: 'shared' }, 'u-1')).toBe('ok')
  })

  it('never a Certified item, even my own, nor someone else’s', () => {
    expect(copilotEditable({ owner: 'u-1', tier: 'certified' }, 'u-1')).toBe('notYours')
    expect(copilotEditable({ owner: 'u-2', tier: 'shared' }, 'u-1')).toBe('notYours')
    expect(copilotEditable({ owner: 'u-1', tier: 'personal' }, null)).toBe('notYours')
  })

  it('a new item is saved first', () => {
    expect(copilotEditable(null, 'u-1')).toBe('unsaved')
  })
})
