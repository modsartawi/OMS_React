// Paste IDs in Add holders (spec 805, ticket 808): a pasted list of employee IDs, looked up one by one
// through the contains-match people search, resolved only to the row whose ID equals it.
import { describe, expect, it } from 'vitest'
import { ApiError } from '@/core/api'
import type { UaEmployeeGridRow } from '@/core/models/ua-user'
import { resolvePastedIds } from './paste-ids'

const person = (employeeId: string, displayName: string): UaEmployeeGridRow => ({
  employeeId, displayName, phone: '', phoneClass: 'missing', email: '', deliveryChannel: 'sms', isActive: true,
  isSeeded: false, credentialState: 'none', isTotpEnrolled: false, lastLoginAt: null,
} as UaEmployeeGridRow)

// What the contains-match search returns for each term.
const SEARCH: Record<string, UaEmployeeGridRow[]> = {
  '1234': [person('12345', 'Khalid Fahad'), person('1234', 'Ahmed Ali')],
  '5678': [person('5678', 'Huda Saleh')],
  '9999': [person('99990', 'Not this one')],
  '777': [person('777', 'Already in')],
}

describe('resolvePastedIds', () => {
  it('resolvePastedIds splits, de-duplicates and matches exactly', async () => {
    const looked: string[] = []
    const progress: Array<[number, number]> = []
    const result = await resolvePastedIds('1234\n5678, 1234\t9999 777\r\n5678', {
      holders: ['777'],
      lookup: async (id) => {
        looked.push(id)
        return SEARCH[id] ?? []
      },
      onProgress: (completed, total) => progress.push([completed, total]),
    })

    // One lookup per distinct ID that is not already a holder, in pasted order.
    expect(looked).toEqual(['1234', '5678', '9999'])
    expect(progress).toEqual([[1, 3], [2, 3], [3, 3]])
    // 1234 never picks 12345; 9999 never picks 99990.
    expect(result.found.map((p) => [p.employeeId, p.displayName])).toEqual([
      ['1234', 'Ahmed Ali'],
      ['5678', 'Huda Saleh'],
    ])
    expect(result.alreadyHolds).toEqual(['777'])
    expect(result.notFound).toEqual(['9999'])
    expect(result.failed).toEqual([])
    expect(result.stopped).toBe(false)
  })

  it('resolvePastedIds keeps going past a failed lookup and stops on an expired session', async () => {
    const offline = new ApiError('network', 'Network unreachable.', 0)
    const expired = new ApiError('auth', 'Session expired.', 401)
    const looked: string[] = []
    const result = await resolvePastedIds('5678 1234 9999 777', {
      holders: [],
      lookup: async (id) => {
        looked.push(id)
        if (id === '5678') throw offline
        if (id === '9999') throw expired
        return SEARCH[id] ?? []
      },
    })

    expect(looked).toEqual(['5678', '1234', '9999'])
    expect(result.failed).toEqual([{ id: '5678', error: offline }, { id: '9999', error: expired }])
    expect(result.found.map((p) => p.employeeId)).toEqual(['1234'])
    expect(result.stopped).toBe(true)
  })
})
