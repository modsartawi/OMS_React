import { beforeEach, describe, expect, it, vi } from 'vitest'

const post = vi.hoisted(() => vi.fn())

vi.mock('@/core/api', async (actual) => ({
  ...(await actual<typeof import('@/core/api')>()),
  api: { post },
}))

const { copilotReadingApi } = await import('./api')

describe('the doors of the offer to keep a reading (BackOffice 3686; ticket 892)', () => {
  beforeEach(() => post.mockReset().mockResolvedValue({}))

  it('keepAndNotNow_postTheConversationAndTheOfferId_toTheirOwnDoors', async () => {
    const body = { conversationId: 'c-0001', offerId: '0123456789abcdef0123456789abcdef' }
    await copilotReadingApi.keep(body)
    await copilotReadingApi.notNow(body)
    expect(post.mock.calls).toEqual([
      ['Copilot/Readings/Keep', body],
      ['Copilot/Readings/NotNow', body],
    ])
  })
})
