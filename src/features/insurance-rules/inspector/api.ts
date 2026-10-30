/**
 * The inspector's doors (BackOffice spec 3271, door 3298; oms ticket 710). 🚩 Paths guessed, 711 reconciles:
 *   GET InsuranceRules/Decisions/{id}          → the decision, its facts, the replay, the message's reference and hash
 *   GET InsuranceRules/Decisions/{id}/Message  → the kept copy, else a re-fetch, checked against the hash (logged)
 * Both sit behind the decision-log read grant: a session without it is answered a bare 403.
 */
import { api } from '@/core/api'
import { INSURANCE_RULES_BASE, INSURANCE_RULES_KEY } from '@/core/insurance-rules/api'
import type { DecisionMessage, DecisionView } from './decision'

const door = (id: string) => `${INSURANCE_RULES_BASE}/Decisions/${encodeURIComponent(id)}`

export const inspectorApi = {
  decision: (id: string) => api.get<DecisionView>(door(id)),
  message: (id: string) => api.get<DecisionMessage | null>(`${door(id)}/Message`),
}

export const decisionQuery = (id: string) =>
  ({ queryKey: [...INSURANCE_RULES_KEY, 'decisions', id], queryFn: () => inspectorApi.decision(id), retry: false }) as const
