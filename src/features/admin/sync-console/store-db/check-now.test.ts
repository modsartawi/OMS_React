import { describe, expect, it } from 'vitest'
import { permissionsOf } from '@/core/permissions'
import { checkNowBody, checkNowVisible } from './check-now'

const VIEW = 'StoreDatabase:03'
const ACT = 'StoreDatabase:06'

describe('checkNowVisible', () => {
  it('shows Check now to a user holding View and Act', () => {
    expect(checkNowVisible(permissionsOf({ screens: [VIEW, ACT] }))).toBe(true)
  })

  it('hides Check now without Act, even to a console operator', () => {
    expect(checkNowVisible(permissionsOf({ screens: [VIEW, 'ActionSyncConsole:03', 'ActionSyncConsole:06'] }))).toBe(false)
  })

  it('hides Check now when Act is held without View', () => {
    expect(checkNowVisible(permissionsOf({ screens: [ACT] }))).toBe(false)
  })
})

describe('checkNowBody', () => {
  it('sends nothing without a reason', () => {
    expect(checkNowBody('P104', '')).toBeNull()
  })

  it('sends nothing for a reason of white space only', () => {
    expect(checkNowBody('P104', '   \n\t ')).toBeNull()
  })

  it('sends the store and the reason, trimmed', () => {
    expect(checkNowBody('P104', '  helpdesk ticket 5512 \n')).toEqual({ code: 'P104', reason: 'helpdesk ticket 5512' })
  })
})
