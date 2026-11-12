import { afterEach, describe, expect, it } from 'vitest'
import { QueryClient } from '@tanstack/react-query'
import { useSession } from '@/core/session'
import { COPILOT_ACCESS_KEY, COPILOT_STARTERS_KEY, canAskCopilot, canCurateCopilot, dropCopilotAccessOnUserChange } from './access'

afterEach(() => useSession.getState().clear())

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

  it('copilotAccess_aGrantNeverOutlivesItsUser', () => {
    const client = new QueryClient()
    const stop = dropCopilotAccessOnUserChange(client)
    useSession.getState().setSession({ userId: 'a.user' })
    client.setQueryData(COPILOT_ACCESS_KEY, { canAsk: true, canUseMcp: false })
    // A store switch is the same user: the answer stands.
    useSession.getState().setCurrentStore('P002')
    expect(client.getQueryData(COPILOT_ACCESS_KEY)).toEqual({ canAsk: true, canUseMcp: false })
    // Another user: A's grant is gone, so B is asked afresh.
    useSession.getState().setSession({ userId: 'b.user' })
    expect(client.getQueryData(COPILOT_ACCESS_KEY)).toBeUndefined()
    // Sign-out: gone too.
    client.setQueryData(COPILOT_ACCESS_KEY, { canAsk: true, canUseMcp: false })
    useSession.getState().clear()
    expect(client.getQueryData(COPILOT_ACCESS_KEY)).toBeUndefined()
    stop()
  })

  it('theReadersStarters_neverOutliveTheirUser (3586 review item 1)', () => {
    const client = new QueryClient()
    const stop = dropCopilotAccessOnUserChange(client)
    useSession.getState().setSession({ userId: 'a.user' })
    const mine = { starters: [{ question: { en: 'A asks', ar: 'أ' }, blank: false }] }
    client.setQueryData(COPILOT_STARTERS_KEY, mine)
    // The same user switching store keeps them.
    useSession.getState().setCurrentStore('P002')
    expect(client.getQueryData(COPILOT_STARTERS_KEY)).toEqual(mine)
    // Another user: A's starters are gone.
    useSession.getState().setSession({ userId: 'b.user' })
    expect(client.getQueryData(COPILOT_STARTERS_KEY)).toBeUndefined()
    // Sign-out: gone too.
    client.setQueryData(COPILOT_STARTERS_KEY, mine)
    useSession.getState().clear()
    expect(client.getQueryData(COPILOT_STARTERS_KEY)).toBeUndefined()
    stop()
  })

  it('canCurateCopilot_onlyWhenTheReplySaysTrue (ticket 790)', () => {
    // Failed (no data), malformed, absent (a pre-3395 server), or false: denied.
    expect(canCurateCopilot(undefined)).toBe(false)
    expect(canCurateCopilot(null)).toBe(false)
    expect(canCurateCopilot({ canAsk: true, canUseMcp: false })).toBe(false)
    expect(canCurateCopilot({ canAsk: true, canUseMcp: false, canCurate: false })).toBe(false)
    expect(canCurateCopilot({ canAsk: true, canUseMcp: false, canCurate: 'true' } as never)).toBe(false)
    expect(canCurateCopilot({ canAsk: true, canUseMcp: false, canCurate: true })).toBe(true)
  })
})
