/**
 * The playground's door (BackOffice spec 3243, door 3244 guard; oms ticket 677). Writes nothing: HQ reads the scratch
 * document and the data and answers what the engine saw. Shapes are the brief's (`@/core/insurance-rules/playground`)
 * until 691 reconciles them with the door as built.
 *
 * No access probe yet (691): a session without `BackOfficeScreen[InsuranceRulePlayground, 01]` is answered a bare 403
 * (`isBareDenial`); a refusal comes as a `PLAYGROUND_*` code in the rule-request refusal envelope.
 */
import { api } from '@/core/api'
import { INSURANCE_RULES_BASE } from '@/core/insurance-rules/api'
import type { PlaygroundEvaluateBody, PlaygroundEvaluateReply } from '@/core/insurance-rules/playground'

export const playgroundApi = {
  /** `POST InsuranceRules/Playground/Evaluate` `{ kind, data, document, asOf }` → errors, or lines with their trace. */
  async evaluate(body: PlaygroundEvaluateBody): Promise<PlaygroundEvaluateReply | null> {
    return api.post<PlaygroundEvaluateReply | null>(`${INSURANCE_RULES_BASE}/Playground/Evaluate`, body)
  },
}
