/**
 * The one permissions answer never outlives its user (oms 914), but a cold load must cost ONE `Auth/Permissions`.
 * The answer is fetched in parallel with `Auth/Me`, so when `Auth/Me` lands the session goes from no user to the user:
 * that step must keep a successful answer (the server already answered for this cookie) and refetch only a failed one
 * (the 401 of a signed-out page, before a sign-in). Measured on staging 2026-11-18: two calls at 736 and 776 ms.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { QueryClient } from '@tanstack/react-query'
import { PERMISSIONS_KEY, dropPermissionsOnUserChange } from './permissions'
import { useSession } from './session'

const answer = { screens: ['DocumentList:03'], extras: {}, version: 'v1' }

function setup() {
  const client = new QueryClient()
  const stop = dropPermissionsOnUserChange(client)
  return { client, stop }
}

function failAnswer(client: QueryClient) {
  client
    .getQueryCache()
    .build(client, { queryKey: PERMISSIONS_KEY })
    .setState({ status: 'error', error: new Error('401'), data: undefined, fetchStatus: 'idle' })
}

afterEach(() => useSession.getState().clear())

describe('dropPermissionsOnUserChange', () => {
  it('keeps a successful answer when Auth/Me lands (no user -> the user): one call per cold load', () => {
    const { client, stop } = setup()
    client.setQueryData(PERMISSIONS_KEY, answer)

    useSession.getState().setSession({ userId: 'alice' })

    expect(client.getQueryData(PERMISSIONS_KEY)).toEqual(answer)
    stop()
  })

  it('drops a failed answer on sign-in (no user -> the user), so the signed-in answer is fetched', () => {
    const { client, stop } = setup()
    failAnswer(client)

    useSession.getState().setSession({ userId: 'alice' })

    expect(client.getQueryState(PERMISSIONS_KEY)?.status).not.toBe('error')
    stop()
  })

  it('drops the answer when the user changes (alice -> bob)', () => {
    const { client, stop } = setup()
    useSession.getState().setSession({ userId: 'alice' })
    client.setQueryData(PERMISSIONS_KEY, answer)

    useSession.getState().setSession({ userId: 'bob' })

    expect(client.getQueryData(PERMISSIONS_KEY)).toBeUndefined()
    stop()
  })

  it('drops the answer on sign-out (the user -> no user)', () => {
    const { client, stop } = setup()
    useSession.getState().setSession({ userId: 'alice' })
    client.setQueryData(PERMISSIONS_KEY, answer)

    useSession.getState().clear()

    expect(client.getQueryData(PERMISSIONS_KEY)).toBeUndefined()
    stop()
  })
})
