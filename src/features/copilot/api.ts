/**
 * The copilot's one question door (ticket 735, spec 734 D10). Through `@/core/api` like every call
 * (`.claude/rules/api-envelope.md`): a refusal (`COPILOT-401` … `COPILOT-406`, D7) arrives as a
 * business `ApiError`, read with `apiErrorCode` / `apiErrorMessage`.
 *
 * Non-streaming (D10): the panel shows its working state for the whole call.
 */
import { api } from '@/core/api'
import type { CopilotAnswer, CopilotAskRequest, CopilotNamedSetKeepRequest, CopilotNamedSetKept, CopilotReadingKept, CopilotReadingNotNow, CopilotReadingOfferRequest, CopilotSteps } from '@/core/models/copilot'
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

/**
 * The offer to keep a reading (ticket 892, BackOffice 3686): Keep stores the reading the SERVER holds for `offerId`, Not
 * now ends offers of its kind for the conversation. A refusal (`COPILOT-437` no longer open, `COPILOT-430` not allowed,
 * `COPILOT-401`) is a business `ApiError`.
 */
export const copilotReadingApi = {
  /** `POST Copilot/Readings/Keep` `{ conversationId, offerId }` -> the kept reading and its confirmation line. */
  keep(body: CopilotReadingOfferRequest): Promise<CopilotReadingKept> {
    return api.post<CopilotReadingKept>('Copilot/Readings/Keep', body)
  },
  /** `POST Copilot/Readings/NotNow` `{ conversationId, offerId }`. */
  notNow(body: CopilotReadingOfferRequest): Promise<CopilotReadingNotNow> {
    return api.post<CopilotReadingNotNow>('Copilot/Readings/NotNow', body)
  },
}

export type CopilotReadingDoors = typeof copilotReadingApi

/**
 * The named-set card's Keep (ticket 893, BackOffice 3687): stores the set the SERVER proposed as `proposalId`. Not now
 * calls nothing. A refusal (`COPILOT-434` at the limit of 10 sets, `COPILOT-435` no longer open, `COPILOT-433`,
 * `COPILOT-401`) is a business `ApiError`.
 */
export const copilotNamedSetApi = {
  /** `POST Copilot/NamedSets/Keep` `{ conversationId, proposalId }` -> the kept set and its confirmation line. */
  keep(body: CopilotNamedSetKeepRequest): Promise<CopilotNamedSetKept> {
    return api.post<CopilotNamedSetKept>('Copilot/NamedSets/Keep', body)
  },
}

export type CopilotNamedSetDoors = typeof copilotNamedSetApi
