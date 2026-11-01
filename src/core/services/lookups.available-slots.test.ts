import { beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient } from '@tanstack/react-query'
import { api } from '@/core/api'
import { lookupQueries } from './lookups'

vi.mock('@/core/api', () => ({ api: { get: vi.fn().mockResolvedValue({ slots: [] }) } }))

describe('lookupQueries.availableSlots', () => {
  beforeEach(() => vi.mocked(api.get).mockClear())

  it('passes the delivery number, so the server caps the list at its hand-over limit', async () => {
    await new QueryClient().fetchQuery(lookupQueries.availableSlots('P001', '8000000253'))
    expect(api.get).toHaveBeenCalledWith('Slots/AvailableSlots/P001', { deliveryNo: '8000000253' })
  })

  it('keeps a capped list apart from the store list in the cache', () => {
    expect(lookupQueries.availableSlots('P001', '8000000253').queryKey).not.toEqual(
      lookupQueries.availableSlots('P001').queryKey,
    )
  })
})
