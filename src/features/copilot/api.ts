/**
 * The copilot's one question door (ticket 735, spec 734 D10). Through `@/core/api` like every call
 * (`.claude/rules/api-envelope.md`): a refusal (`COPILOT-401` … `COPILOT-406`, D7) arrives as a
 * business `ApiError`, read with `apiErrorCode` / `apiErrorMessage`.
 *
 * Non-streaming (D10): the panel shows its working state for the whole call.
 */
import { api } from '@/core/api'
import type { CopilotAnswer, CopilotAskRequest, CopilotSteps } from '@/core/models/copilot'
import { stepsOrNothing } from './steps'

export const copilotApi = {
  /** `POST Copilot/Ask` `{ question, conversationId? }` → the answer. Aborting `signal` (Stop) ends the
   *  request, and the server stops the model and its tools with it (the door runs on `RequestAborted`). */
  ask(body: CopilotAskRequest, signal?: AbortSignal): Promise<CopilotAnswer> {
    return api.post<CopilotAnswer>('Copilot/Ask', body, undefined, undefined, signal)
  },
  /** `GET Copilot/Ask/{requestId}/Steps` → the question's steps so far (869, BackOffice 3565); `null` on a 404 (nothing
   *  recorded yet, or `Copilot:Speed:Steps` off) or any other failed read. */
  steps(requestId: string): Promise<CopilotSteps | null> {
    return stepsOrNothing(api.get<CopilotSteps>(`Copilot/Ask/${encodeURIComponent(requestId)}/Steps`))
  },
}
