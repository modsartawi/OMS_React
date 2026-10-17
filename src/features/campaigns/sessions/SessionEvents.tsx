import { useMemo } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { AgGridReact } from 'ag-grid-react'
import type { ColDef, ICellRendererParams } from 'ag-grid-community'
// Side-effect import: registers AG Grid Community modules within this chunk.
import '@/core/ag-grid-setup'
import { OMS_GRID_HEADER_HEIGHT, OMS_GRID_ROW_HEIGHT, omsGridTheme } from '@/core/theme/ag-grid-theme'
import { OMS_GRID_BASE_COL_DEF } from '@/core/theme/grid-base'
import { RULE_SESSION_STATES, RULE_SESSION_VERBS, type RuleSessionLookup } from '@/core/models/rule-session'
import Ltr from '@/core/ui/Ltr'
import StatusBadge from '@/core/ui/StatusBadge'
import type { Severity } from '@/core/ui/severity'
import { BudgetEventText, MovementText, RefusalText } from './session-ui'
import { momentText, sessionTimeline, type TimelineEntry, type TimelineKind } from './timeline'

const KIND_SEV: Record<TimelineKind, Severity> = { call: 'go', movement: 'mute', budgetEvent: 'warn' }

/** The verbs a session call is written under (2760); one HQ names otherwise is shown in its own word. */
const VERBS: readonly string[] = RULE_SESSION_VERBS
const STATES: readonly string[] = RULE_SESSION_STATES

function KindCell({ data }: ICellRendererParams<TimelineEntry>) {
  const { t } = useTranslation('rule-sessions')
  return data ? <StatusBadge sev={KIND_SEV[data.kind]}>{t(`events.kind.${data.kind}`)}</StatusBadge> : null
}

/**
 * What happened: a call's verb, the state it left the session in, a support cancel's person and
 * reason (free text) and the refusals its reply carried; a journal line or a budget event in a
 * sentence.
 */
function WhatCell({ data }: ICellRendererParams<TimelineEntry>) {
  const { t } = useTranslation('rule-sessions')
  if (!data) return null
  const body = (() => {
    switch (data.kind) {
      case 'call': {
        const c = data.call
        const refusals = c.reply?.refusals ?? []
        return (
          <>
            <span className="flex flex-wrap items-center gap-2">
              <span className="font-medium" data-event-verb={c.verb}>
                {VERBS.includes(c.verb) ? t(`events.verb.${c.verb}`) : <Ltr>{c.verb}</Ltr>}
              </span>
              {c.state && (
                <span className="text-muted-foreground" data-event-state={c.state}>
                  {STATES.includes(c.state) ? t('events.leftIn', { state: t(`status.${c.state}`) }) : <Ltr>{c.state}</Ltr>}
                </span>
              )}
              {refusals.length > 0 && <StatusBadge sev="bad">{t('events.refused', { count: refusals.length })}</StatusBadge>}
            </span>
            {c.by && (
              <span className="text-muted-foreground" data-event-by="">
                <Trans t={t} i18nKey="events.by" values={{ by: c.by }} components={{ n: <bdi /> }} />
              </span>
            )}
            {c.note && (
              <span data-event-note="">
                <bdi>{c.note}</bdi>
              </span>
            )}
            {refusals.map((r, i) => (
              <RefusalText key={i} refusal={r} />
            ))}
          </>
        )
      }
      case 'movement':
        return (
          <span data-event-move={data.move.kind}>
            <MovementText move={data.move} />
          </span>
        )
      case 'budgetEvent':
        return <BudgetEventText event={data.event} />
    }
  })()
  return (
    <div className="flex flex-col gap-0.5 py-1.5 leading-snug whitespace-normal" data-event={data.kind}>
      {body}
    </div>
  )
}

const campaignOf = (e: TimelineEntry): string => (e.kind === 'call' ? '' : e.kind === 'movement' ? e.move.campaign : e.event.campaign)

const COL_DEF: ColDef<TimelineEntry> = { ...OMS_GRID_BASE_COL_DEF, sortable: false, resizable: true, suppressHeaderMenuButton: true }

/** Events (tickets 518, 527): every call and the journal lines and budget events, oldest first by local time. */
export default function SessionEvents({ session }: { session: RuleSessionLookup }) {
  const { t } = useTranslation('rule-sessions')
  const entries = useMemo(() => sessionTimeline(session), [session])
  const columns = useMemo<ColDef<TimelineEntry>[]>(
    () => [
      { colId: 'at', field: 'at', headerName: t('events.columns.at'), valueFormatter: ({ value }) => momentText(value as string), width: 170 },
      { colId: 'kind', headerName: t('events.columns.kind'), cellRenderer: KindCell, width: 120 },
      { colId: 'campaign', headerName: t('events.columns.campaign'), valueGetter: ({ data }) => (data ? campaignOf(data) : ''), width: 140 },
      { colId: 'what', headerName: t('events.columns.what'), cellRenderer: WhatCell, flex: 1, minWidth: 320, autoHeight: true },
      { colId: 'requestId', headerName: t('events.columns.requestId'), valueGetter: ({ data }) => (data?.kind === 'call' ? data.call.requestId : ''), width: 150 },
      {
        colId: 'cartVersion',
        headerName: t('events.columns.cartVersion'),
        valueGetter: ({ data }) => (data?.kind === 'call' ? data.call.cartVersion : null),
        type: 'rightAligned',
        width: 110,
      },
    ],
    [t],
  )
  if (entries.length === 0) return <p className="text-sm text-muted-foreground">{t('events.none')}</p>
  return (
    <div data-session-events="">
      <AgGridReact<TimelineEntry>
        theme={omsGridTheme}
        rowData={entries}
        columnDefs={columns}
        defaultColDef={COL_DEF}
        getRowId={({ data }) => data.key}
        rowHeight={OMS_GRID_ROW_HEIGHT}
        headerHeight={OMS_GRID_HEADER_HEIGHT}
        animateRows={false}
        suppressColumnVirtualisation
        domLayout="autoHeight"
      />
    </div>
  )
}
