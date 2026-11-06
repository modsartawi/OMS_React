import { useCallback, useMemo, useReducer } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import type { AnalyticsReport } from '@/core/models/analytics'
import { analyticsAccessQuery, canAuthorAnalytics } from './access'
import { analyticsApi, analyticsWordsKey } from './api'
import { NO_WAVE } from './board'
import type { ParamNotice } from './BoardPanel'
import type { BoardContext } from './effective-query'
import { noticeReducer, streamReducer, stripNotices } from './panel-notices'
import type { ParamValues } from './params'
import { runValues, wordsAsked } from './report'

/**
 * One run of a report (827): what its panels ask with — the report's parameters, bindings and the values on
 * screen, by item (`{ itemId, revision, panelId, values }`) and with no cross-filter — and its Words: the live
 * figures and the summary for exactly these values (`POST Analytics/Report/{id}/Words`), asked only when the
 * report has a figure or a summary. The previous Words stay shown while a value change asks again.
 *
 * Shared by the runner's page and the print page; the designer (828) runs its preview through it too.
 */
export function useReportRun(report: AnalyticsReport, values: ParamValues, linkFellBack: readonly string[] = []) {
  const { params, bindings } = report.definition
  const item = useMemo(() => ({ id: report.id, revision: report.revision }), [report.id, report.revision])
  const context: BoardContext = useMemo(() => ({ params, bindings, values, crossFilter: null, item }), [params, bindings, values, item])

  const [notices, notice] = useReducer(noticeReducer, new Map<string, ParamNotice>())
  const onParamNotice = useCallback((id: string, n: ParamNotice) => notice([id, n]), [])
  const { fellBack, invalid } = stripNotices(params, linkFellBack, notices)
  const [stream, report_] = useReducer(streamReducer, { fetching: new Set<string>(), wave: NO_WAVE })
  const onFetching = useCallback((id: string, on: boolean) => report_([id, on]), [])

  // 823: the author reads every "not filtered by …" line; a runner only those for parameters moved off their defaults.
  const access = useQuery(analyticsAccessQuery())
  const role: 'author' | 'runner' = canAuthorAnalytics(access.data) ? 'author' : 'runner'

  const body = useMemo(() => ({ revision: report.revision, values: runValues(params, values) }), [report.revision, params, values])
  const asked = useMemo(() => wordsAsked(report.definition), [report.definition])
  const words = useQuery({
    queryKey: analyticsWordsKey(report.id, body),
    queryFn: () => analyticsApi.words(report.id, body),
    enabled: asked,
    placeholderData: keepPreviousData,
    retry: false,
  })

  return { context, role, onParamNotice, onFetching, wave: stream.wave, fellBack, invalid, words }
}

export type ReportWordsState = ReturnType<typeof useReportRun>['words']
