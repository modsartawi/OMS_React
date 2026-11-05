/**
 * The house-rules doors (ticket 790, BackOffice 3395), apart from `./api` so the copilot panel's chunk
 * does not carry them. Through `@/core/api` like every call (`.claude/rules/api-envelope.md`): a refusal
 * (`COPILOT-410` no curator grant, `COPILOT-411` saved first, `COPILOT-412` the text refused) arrives
 * as a business `ApiError`, read with `apiErrorCode` / `apiErrorMessage`.
 *
 * ⚠ 3395 is not minted: the paths and shapes are this client's proposal (ticket 790's comments).
 */
import { api } from '@/core/api'
import type {
  CopilotAnswer,
  CopilotPrompt,
  CopilotPromptRevertRequest,
  CopilotPromptSaveRequest,
  CopilotPromptTryRequest,
  CopilotPromptVersion,
} from '@/core/models/copilot'

export const COPILOT_PROMPT_KEY = ['copilot', 'prompt'] as const
export const COPILOT_PROMPT_HISTORY_KEY = ['copilot', 'prompt', 'history'] as const

export const copilotRulesApi = {
  /** `GET Copilot/Prompt` → the locked core and the active house rules. */
  prompt(): Promise<CopilotPrompt> {
    return api.get<CopilotPrompt>('Copilot/Prompt')
  },
  /** `GET Copilot/Prompt/History` → the last 20 versions, newest first. */
  history(): Promise<CopilotPromptVersion[]> {
    return api.get<CopilotPromptVersion[]>('Copilot/Prompt/History')
  },
  /** `POST Copilot/Prompt` `{ text, note, baseVersion }` → the version it saved. */
  save(body: CopilotPromptSaveRequest): Promise<CopilotPromptVersion> {
    return api.post<CopilotPromptVersion>('Copilot/Prompt', body)
  },
  /** `POST Copilot/Prompt/Try` `{ question, text }` → an answer under the draft; kept in no conversation. */
  tryDraft(body: CopilotPromptTryRequest): Promise<CopilotAnswer> {
    return api.post<CopilotAnswer>('Copilot/Prompt/Try', body)
  },
  /** `POST Copilot/Prompt/Revert` `{ version, baseVersion }` → the new version the restore made. */
  revert(body: CopilotPromptRevertRequest): Promise<CopilotPromptVersion> {
    return api.post<CopilotPromptVersion>('Copilot/Prompt/Revert', body)
  },
}
