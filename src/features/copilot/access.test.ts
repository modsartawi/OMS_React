import { afterEach, describe, expect, it } from 'vitest'
import { QueryClient } from '@tanstack/react-query'
import { permissionsOf, type ScreenKey } from '@/core/permissions'
import { useSession } from '@/core/session'
import { COPILOT_STARTERS_KEY, canAskCopilot, canCurateCopilot, canUseMcp, dropCopilotStartersOnUserChange } from './access'

afterEach(() => useSession.getState().clear())

const holding = (...screens: ScreenKey[]) => permissionsOf({ screens })

// The Copilot row of the permissions brief (oms 909, BackOffice spec 4002).
describe('the copilot grants', () => {
  it('ask and MCP read Copilot:01; nothing else opens them', () => {
    expect(canAskCopilot(holding('Copilot:01'))).toBe(true)
    expect(canUseMcp(holding('Copilot:01'))).toBe(true)
    expect(canAskCopilot(holding('Copilot:06'))).toBe(false)
    expect(canUseMcp(holding('Copilot:06'))).toBe(false)
    expect(canAskCopilot(permissionsOf(null))).toBe(false)
  })

  it('curate is Copilot:01 and Copilot:06; Copilot:06 without :01 is no curator', () => {
    expect(canCurateCopilot(holding('Copilot:01', 'Copilot:06'))).toBe(true)
    expect(canCurateCopilot(holding('Copilot:06'))).toBe(false)
    expect(canCurateCopilot(holding('Copilot:01'))).toBe(false)
    expect(canCurateCopilot(permissionsOf(null))).toBe(false)
  })

  it('theReadersStarters_neverOutliveTheirUser (3586 review item 1)', () => {
    const client = new QueryClient()
    const stop = dropCopilotStartersOnUserChange(client)
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
})
