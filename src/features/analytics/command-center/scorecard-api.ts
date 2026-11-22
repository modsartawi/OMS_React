/**
 * The scorecard panel's server call (oms 947; spec 4165 "one pharmacy's scorecard", BO route unbuilt — the shape is
 * `@/core/models/command-center`'s proposal). Through `@/core/api` (`.claude/rules/api-envelope.md`).
 */
import { api } from '@/core/api'
import type { CcLang, CcScorecard } from '@/core/models/command-center'

/** Keyed by pharmacy and language: an answer in one language never stands for the other. */
export const SCORECARD_KEYS = {
  scorecard: (storeCode: string, lang: CcLang) => ['command-center', 'scorecard', storeCode, lang] as const,
}

export const scorecardApi = {
  /** `GET CommandCenter/Scorecard?storeCode=&lang=` — the pharmacy's six measures as stored last night. */
  scorecard: (storeCode: string, lang: CcLang): Promise<CcScorecard> => api.get<CcScorecard>('CommandCenter/Scorecard', { storeCode, lang }),
}

export const scorecardQuery = (storeCode: string, lang: CcLang) => ({
  queryKey: SCORECARD_KEYS.scorecard(storeCode, lang),
  queryFn: () => scorecardApi.scorecard(storeCode, lang),
  retry: false,
})
