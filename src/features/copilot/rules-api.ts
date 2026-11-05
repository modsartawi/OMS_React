/**
 * The house-rules doors (ticket 790, BackOffice 3395), apart from `./api` so the copilot panel's chunk
 * does not carry them. Through `@/core/api` like every call (`.claude/rules/api-envelope.md`): a refusal
 * (`COPILOT-411` saved first, `COPILOT-412` the text refused) arrives as a business `ApiError`, read with
 * `apiErrorCode` / `apiErrorMessage`. A caller without the curator grant gets the grant filter's bare 403
 * first and `COPILOT-410` second (`curatorRefused`).
 *
 * The wire (`houseRules`, a flat active view, `""` for none) is read into the screen's models by `./rules`.
 */
import { api } from '@/core/api'
import type {
  CopilotAnswer,
  CopilotPrompt,
  CopilotPromptRevertRequest,
  CopilotPromptSaveRequest,
  CopilotPromptTryRequest,
  CopilotPromptVersion,
  CopilotPromptVersionWire,
  CopilotPromptWire,
} from '@/core/models/copilot'
import { HISTORY_MAX, fromPromptWire, fromVersionWire } from './rules'

export const COPILOT_PROMPT_KEY = ['copilot', 'prompt'] as const
export const COPILOT_PROMPT_HISTORY_KEY = ['copilot', 'prompt', 'history'] as const

export const copilotRulesApi = {
  /** `GET Copilot/Prompt` → `{ core, houseRules, version, savedBy, savedAt, note, maxLength }`. */
  async prompt(): Promise<CopilotPrompt> {
    return fromPromptWire(await api.get<CopilotPromptWire>('Copilot/Prompt'))
  },
  /** `GET Copilot/Prompt/History?take=20` → the last 20 versions, newest first, each with its text. */
  async history(): Promise<CopilotPromptVersion[]> {
    const rows = await api.get<CopilotPromptVersionWire[]>('Copilot/Prompt/History', { take: HISTORY_MAX })
    return Array.isArray(rows) ? rows.map(fromVersionWire) : []
  },
  /** `POST Copilot/Prompt` `{ houseRules, note, baseVersion }` → the version it saved. */
  async save(body: CopilotPromptSaveRequest): Promise<CopilotPromptVersion> {
    return fromVersionWire(await api.post<CopilotPromptVersionWire>('Copilot/Prompt', body))
  },
  /** `POST Copilot/Prompt/Try` `{ houseRules, question }` → an answer under the draft (`promptVersion: null`). */
  tryDraft(body: CopilotPromptTryRequest): Promise<CopilotAnswer> {
    return api.post<CopilotAnswer>('Copilot/Prompt/Try', body)
  },
  /** `POST Copilot/Prompt/Revert` `{ version }` → the new version the restore made. */
  async revert(body: CopilotPromptRevertRequest): Promise<CopilotPromptVersion> {
    return fromVersionWire(await api.post<CopilotPromptVersionWire>('Copilot/Prompt/Revert', body))
  },
}
