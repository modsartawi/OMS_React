import { create } from 'zustand'
import { EMPTY_CONVERSATION, type CopilotConversation } from './conversation'

/**
 * The copilot's conversation, held outside the panel (ticket 736): the top bar's sheet closes when an
 * answer's order link navigates, which unmounts the panel. Reopening it shows the same thread and
 * keeps the `conversationId`, because the turns and the id live here, not in the panel's state.
 *
 * In memory only — never storage: a reload starts a new conversation, as before.
 */
interface CopilotConversationState {
  conv: CopilotConversation
  setConv: (next: CopilotConversation | ((c: CopilotConversation) => CopilotConversation)) => void
}

export const useCopilotConversation = create<CopilotConversationState>((set) => ({
  conv: EMPTY_CONVERSATION,
  setConv: (next) => set((s) => ({ conv: typeof next === 'function' ? next(s.conv) : next })),
}))
