import { create } from 'zustand'
import { useSession } from '@/core/session'
import type { CopilotAnswer, CopilotAskRequest } from '@/core/models/copilot'
import { copilotApi } from './api'
import { EMPTY_CONVERSATION, askBody, canAskMore, withAnswer, withRefusal, type CopilotConversation } from './conversation'

/**
 * The copilot's conversation, held outside the panel (ticket 736): the top bar's sheet closes when an
 * answer's order link navigates, which unmounts the panel. Reopening it shows the same thread and
 * keeps the `conversationId`, because the turns and the id live here, not in the panel's state.
 *
 * The question in flight lives here too (review item 2), not in a panel's mutation: ONE ask at a time
 * for every mounted panel (the sheet and `/copilot` together), and a reply that arrives after its panel
 * unmounted still lands in the thread. A conversation cleared while a question was in flight ("New
 * conversation", or the user changing) drops that question's late reply: each clear moves `epoch` on.
 *
 * 🚩 Privacy: in memory only — never storage: a reload starts a new conversation. The session's user
 * changing (sign-out, a 401, another user) empties it too, as the sync console's replay draft does.
 */
export interface CopilotConversationState {
  conv: CopilotConversation
  /** The question in flight, or null: at most one. */
  pending: string | null
  /** Moves on at every clear, so a reply to a cleared conversation is recognised and dropped. */
  epoch: number
  /** Sends a question; `null` (nothing sent) while one is in flight or the conversation is closed. */
  ask: (question: string) => Promise<void> | null
  /** "New conversation": no id, no thread, nothing in flight. */
  startNew: () => void
}

export function createCopilotConversation(send: (body: CopilotAskRequest) => Promise<CopilotAnswer>) {
  const store = create<CopilotConversationState>((set, get) => ({
    conv: EMPTY_CONVERSATION,
    pending: null,
    epoch: 0,
    ask: (question) => {
      const { conv, pending, epoch } = get()
      if (pending !== null || !canAskMore(conv) || question.trim() === '') return null
      set({ pending: question })
      const landed = (next: (c: CopilotConversation) => CopilotConversation) => {
        if (get().epoch !== epoch) return
        set((s) => ({ conv: next(s.conv), pending: null }))
      }
      return send(askBody(conv, question)).then(
        (reply) => landed((c) => withAnswer(c, question, reply)),
        (err: unknown) => landed((c) => withRefusal(c, question, err)),
      )
    },
    startNew: () => set((s) => ({ conv: EMPTY_CONVERSATION, pending: null, epoch: s.epoch + 1 })),
  }))
  useSession.subscribe((now, before) => {
    if (now.userId !== before.userId) store.getState().startNew()
  })
  return store
}

export const useCopilotConversation = createCopilotConversation((body) => copilotApi.ask(body))
