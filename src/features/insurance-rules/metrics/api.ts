/**
 * The Metrics screen's doors (BackOffice spec 3126; door ticket 3141, oms ticket 615). All reads but the flag
 * thresholds' `PUT` (review 3126 P5).
 *
 * ⚠️ Stubbed until oms 618 (`tools/insurance-rules-stubs.mjs`, section 615): no door here has met a real SIS.Api.
 * The brief names the data, not every field; the guessed spellings sit in `./model` and 615's ## Comments.
 * No access probe yet — a session without the grant is answered a bare 403 (`isBareDenial`).
 */
import { api } from '@/core/api'
import { INSURANCE_RULES_BASE, INSURANCE_RULES_KEY } from '@/core/insurance-rules/api'
import type { FlagRow, FlagSettings, MetricsRow, RejectionRow } from './model'
import { metricsParams, type MetricsQuery } from './query'

export const metricsApi = {
  /** `GET InsuranceRules/Metrics?by=rule|store|pharmacist|day&from&to` — one row per rule, store, pharmacist or day. */
  async metrics(q: MetricsQuery): Promise<MetricsRow[]> {
    return (await api.get<MetricsRow[] | null>(`${INSURANCE_RULES_BASE}/Metrics`, metricsParams(q))) ?? []
  },
  /** `GET InsuranceRules/Flags` — the current flags (a flag never pauses a rule). */
  async flags(): Promise<FlagRow[]> {
    return (await api.get<FlagRow[] | null>(`${INSURANCE_RULES_BASE}/Flags`)) ?? []
  },
  /** `GET InsuranceRules/Settings/Flags` — the thresholds the flag job uses. */
  flagSettings(): Promise<FlagSettings | null> {
    return api.get<FlagSettings | null>(`${INSURANCE_RULES_BASE}/Settings/Flags`)
  },
  /** `PUT InsuranceRules/Settings/Flags` — sets the thresholds. GUESS: answers the settings as saved. */
  saveFlagSettings(s: FlagSettings): Promise<FlagSettings | null> {
    return api.put<FlagSettings | null>(`${INSURANCE_RULES_BASE}/Settings/Flags`, s)
  },
  /** `GET InsuranceRules/Rejections?payer&from&to` — payer rejections by code (or words), payer and same kind. */
  async rejections(q: MetricsQuery): Promise<RejectionRow[]> {
    return (await api.get<RejectionRow[] | null>(`${INSURANCE_RULES_BASE}/Rejections`, metricsParams(q, true))) ?? []
  },
}

export const METRICS_KEY = [...INSURANCE_RULES_KEY, 'metrics'] as const

export function metricsQuery(q: MetricsQuery) {
  const p = metricsParams(q)
  return { queryKey: [...METRICS_KEY, 'rows', p.by, p.from, p.to], queryFn: () => metricsApi.metrics(q), retry: false } as const
}

export function flagsQuery() {
  return { queryKey: [...METRICS_KEY, 'flags'], queryFn: () => metricsApi.flags(), retry: false } as const
}

export const FLAG_SETTINGS_KEY = [...METRICS_KEY, 'flag-settings'] as const

export function flagSettingsQuery() {
  return { queryKey: FLAG_SETTINGS_KEY, queryFn: () => metricsApi.flagSettings(), retry: false } as const
}

export function rejectionsQuery(q: MetricsQuery) {
  const p = metricsParams(q, true)
  return { queryKey: [...METRICS_KEY, 'rejections', p.payer ?? '', p.from, p.to], queryFn: () => metricsApi.rejections(q), retry: false } as const
}
