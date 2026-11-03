/**
 * The copilot's one question door (ticket 735, spec 734 D10). Through `@/core/api` like every call
 * (`.claude/rules/api-envelope.md`): a refusal (`COPILOT-401` … `COPILOT-406`, D7) arrives as a
 * business `ApiError`, read with `apiErrorCode` / `apiErrorMessage`.
 *
 * Non-streaming (D10): the panel shows its working state for the whole call.
 */
import { api } from '@/core/api'
import type { CopilotAnswer, CopilotAskRequest } from '@/core/models/copilot'

export const copilotApi = {
  /** `POST Copilot/Ask` `{ question, conversationId? }` → the answer. */
  ask(body: CopilotAskRequest): Promise<CopilotAnswer> {
    return api.post<CopilotAnswer>('Copilot/Ask', body)
  },
}
