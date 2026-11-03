import { afterEach, describe, expect, it } from 'vitest'
import { ApiError } from '@/core/api'
import { useSession } from '@/core/session'
import type { CopilotAnswer, CopilotAskRequest } from '@/core/models/copilot'
import { createCopilotConversation } from './conversation-store'

const reply = (conversationId: string, questionNo: number): CopilotAnswer => ({
  conversationId,
  questionNo,
  answer: `Answer ${questionNo}.`,
  orderRefs: [],
  trace: [],
  outcome: 'answered',
  stoppedEarly: false,
  servedBy: 'anthropic/claude-opus-5-5',
  askedAt: '2026-11-03T10:15:00',
})

/** A `Copilot/Ask` stand-in whose calls the test answers by hand, in any order. */
function door() {
  const calls: { body: CopilotAskRequest; answer: (r: CopilotAnswer) => void; refuse: (e: unknown) => void }[] = []
  const ask = (body: CopilotAskRequest) =>
    new Promise<CopilotAnswer>((answer, refuse) => {
      calls.push({ body, answer, refuse })
    })
  return { ask, calls }
}

afterEach(() => useSession.getState().clear())

describe('the copilot conversation store (spec 734 D5, review items 1 and 2)', () => {
  it('copilotStore_oneAskInFlight_replyLandsInTheThread', async () => {
    const d = door()
    const store = createCopilotConversation(d.ask)
    const done = store.getState().ask('Why was order 7000123456 late?')
    expect(done).not.toBeNull()
    expect(store.getState().pending).toBe('Why was order 7000123456 late?')
    // A second ask while one is in flight is refused: one ask at a time, whichever panel sent it.
    expect(store.getState().ask('And another?')).toBeNull()
    expect(d.calls).toHaveLength(1)
    d.calls[0].answer(reply('c-0001', 1))
    await done
    expect(store.getState().pending).toBeNull()
    expect(store.getState().conv.id).toBe('c-0001')
    expect(store.getState().conv.turns.map((t) => t.question)).toEqual(['Why was order 7000123456 late?'])
    // The follow-up sends the id back.
    const next = store.getState().ask('And the one before?')
    expect(d.calls[1].body).toEqual({ question: 'And the one before?', conversationId: 'c-0001' })
    d.calls[1].refuse(new ApiError('business', 'No.', 400, [{ errorCode: 'COPILOT-403', internalErrorCode: '', errorMessage: 'No.' }]))
    await next
    expect(store.getState().pending).toBeNull()
    expect(store.getState().conv.turns).toHaveLength(2)
    expect(store.getState().conv.turns[1].reply).toBeNull()
  })

  it('copilotStore_aLateReplyToAClearedConversationIsDropped', async () => {
    const d = door()
    const store = createCopilotConversation(d.ask)
    const late = store.getState().ask('slow question')
    store.getState().startNew()
    expect(store.getState().pending).toBeNull()
    // The new conversation can ask at once; the old reply, arriving after, is dropped.
    const fresh = store.getState().ask('fresh question')
    expect(d.calls[1].body).toEqual({ question: 'fresh question' })
    d.calls[0].answer(reply('c-old', 1))
    await late
    expect(store.getState().conv.turns).toHaveLength(0)
    expect(store.getState().pending).toBe('fresh question')
    d.calls[1].answer(reply('c-new', 1))
    await fresh
    expect(store.getState().conv.id).toBe('c-new')
    expect(store.getState().conv.turns.map((t) => t.question)).toEqual(['fresh question'])
  })

  it('copilotStore_clearsWhenTheUserChangesOrSignsOut', async () => {
    const d = door()
    const store = createCopilotConversation(d.ask)
    useSession.getState().setSession({ userId: 'a.user' })
    const first = store.getState().ask('a question of A')
    d.calls[0].answer(reply('c-a', 1))
    await first
    expect(store.getState().conv.turns).toHaveLength(1)

    // Sign-out empties it.
    useSession.getState().clear()
    expect(store.getState().conv.turns).toHaveLength(0)
    expect(store.getState().conv.id).toBeNull()

    // A's question still in flight when B signs in: B never sees its reply.
    useSession.getState().setSession({ userId: 'a.user' })
    const inFlight = store.getState().ask('another of A')
    useSession.getState().setSession({ userId: 'b.user' })
    expect(store.getState().pending).toBeNull()
    d.calls[1].answer(reply('c-a', 2))
    await inFlight
    expect(store.getState().conv.turns).toHaveLength(0)

    // A store switch for the same user is no change of user: the thread stays.
    const own = store.getState().ask('a question of B')
    d.calls[2].answer(reply('c-b', 1))
    await own
    useSession.getState().setCurrentStore('P002')
    expect(store.getState().conv.turns).toHaveLength(1)
  })
})
