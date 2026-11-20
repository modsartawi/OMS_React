/**
 * The Mini POS scorecard's one server call (oms 930, BackOffice 4075): SIS.Api's `GET MiniPosScorecard`, behind
 * `BackOfficeScreen[MiniPosScorecard, 03]`. Through `@/core/api` (`api-envelope`). An absent input is not sent, so the
 * server's configured trial calendar answers for it.
 */
import { api } from '@/core/api'
import type { MiniPosScorecard, MiniPosScorecardQuery } from '@/core/models/mini-pos-scorecard'
import { queryParams } from './scorecard'

export const miniPosScorecardApi = {
  /** `GET MiniPosScorecard?trialFrom=&trialTo=&settlingInEnd=&comparisonOffsetDays=&promoterCost=`. */
  read(query: MiniPosScorecardQuery): Promise<MiniPosScorecard> {
    return api.get<MiniPosScorecard>('MiniPosScorecard', queryParams(query))
  },
}
