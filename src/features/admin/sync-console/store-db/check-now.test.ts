import { describe, expect, it } from 'vitest'
import { checkNowBody } from './check-now'

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
