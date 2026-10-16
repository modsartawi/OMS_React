import { describe, expect, it } from 'vitest'
import { QueryClient } from '@tanstack/react-query'
import { ApiError } from '@/core/api'
import type { OmsAccessResult } from '@/core/models/oms-access'
import { OMS_ACCESS_KEY, revokeOnForbidden } from './api'

const GRANTED: OmsAccessResult = { canOpenList: true, canOpenDetail: true, canChangeDetail: true, canCreateReturn: true }

function seeded(): QueryClient {
  const client = new QueryClient()
  client.setQueryData(OMS_ACCESS_KEY, GRANTED)
  return client
}

describe('revokeOnForbidden (ticket 521)', () => {
  it('a 403 clears only the named write grant; the screen grant stays', () => {
    const client = seeded()
    revokeOnForbidden(client, new ApiError('unknown', 'Forbidden', 403), 'canChangeDetail')
    expect(client.getQueryData(OMS_ACCESS_KEY)).toEqual({ ...GRANTED, canChangeDetail: false })
    revokeOnForbidden(client, new ApiError('unknown', 'Forbidden', 403), 'canCreateReturn')
    expect(client.getQueryData(OMS_ACCESS_KEY)).toEqual({ ...GRANTED, canChangeDetail: false, canCreateReturn: false })
  })

  it.each([
    ['a business 400', new ApiError('business', 'No', 400)],
    ['a server 500', new ApiError('server', 'Boom', 500)],
    ['a non-ApiError', new Error('offline')],
  ])('%s leaves the grant alone', (_, err) => {
    const client = seeded()
    revokeOnForbidden(client, err, 'canChangeDetail')
    expect(client.getQueryData(OMS_ACCESS_KEY)).toEqual(GRANTED)
  })

  it('no probe answer yet stays no answer', () => {
    const client = new QueryClient()
    revokeOnForbidden(client, new ApiError('unknown', 'Forbidden', 403), 'canChangeDetail')
    expect(client.getQueryData(OMS_ACCESS_KEY)).toBeUndefined()
  })
})
