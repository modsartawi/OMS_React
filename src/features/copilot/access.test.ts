import { describe, expect, it } from 'vitest'
import { canAskCopilot } from './access'

describe('the copilot probe (spec 734 D7)', () => {
  it('copilotAccess_failsClosed', () => {
    // Absent (a 404 or an unreachable door leaves no data), malformed, or refused: not allowed.
    expect(canAskCopilot(undefined)).toBe(false)
    expect(canAskCopilot(null)).toBe(false)
    expect(canAskCopilot({} as never)).toBe(false)
    expect(canAskCopilot({ canAsk: 'true', canUseMcp: true } as never)).toBe(false)
    expect(canAskCopilot({ canAsk: false, canUseMcp: true })).toBe(false)
    // Only an explicit grant opens it.
    expect(canAskCopilot({ canAsk: true, canUseMcp: false })).toBe(true)
  })
})
