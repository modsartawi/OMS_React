import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { AgGridReact } from 'ag-grid-react'
import type { ColDef, ICellRendererParams } from 'ag-grid-community'
// Side-effect import: registers AG Grid Community modules within this chunk.
import '@/core/ag-grid-setup'
import { OMS_GRID_HEADER_HEIGHT, OMS_GRID_ROW_HEIGHT, omsGridTheme } from '@/core/theme/ag-grid-theme'
import { OMS_GRID_BASE_COL_DEF } from '@/core/theme/grid-base'
import type { RuleSession } from '@/core/models/rule-campaign'
import Ltr from '@/core/ui/Ltr'
import StatusBadge from '@/core/ui/StatusBadge'
import type { Severity } from '@/core/ui/severity'
import { Both, BudgetMoveText, JournalMoveText } from './session-ui'
import { momentText, sessionTimeline, type TimelineEntry, type TimelineKind } from './timeline'

const KIND_SEV: Record<TimelineKind, Severity> = { call: 'go', refusal: 'bad', hold: 'mute', budget: 'mute', journal: 'mute' }

/** The moments a channel calls at (spec 2737); one HQ names otherwise is shown in its own word. */
const MOMENTS = ['attach', 'subtotal', 'onDemand', 'pay', 'close', 'returns', 'cancel', 'lateClose']

interface GridContext {
  currency: string
}

function KindCell({ data }: ICellRendererParams<TimelineEntry>) {
  const { t } = useTranslation('rule-sessions')
  return data ? <StatusBadge sev={KIND_SEV[data.kind]}>{t(`events.kind.${data.kind}`)}</StatusBadge> : null
}

/**
 * What happened: a call's moment and HQ's stored reply (its own words, passed through as free
 * text), a movement in a sentence, a refusal's code and its reason in both languages.
 */
function WhatCell({ data, context }: ICellRendererParams<TimelineEntry, unknown, GridContext>) {
  const { t } = useTranslation('rule-sessions')
  if (!data) return null
  const body = (() => {
    switch (data.kind) {
      case 'call': {
        const c = data.call
        return (
          <>
            <span className="flex flex-wrap items-center gap-2">
              <span className="font-medium" data-event-moment={c.moment}>
                {MOMENTS.includes(c.moment) ? t(`events.moment.${c.moment}`) : <Ltr>{c.moment}</Ltr>}
              </span>
              {!c.ok && <StatusBadge sev="bad">{t('events.refused')}</StatusBadge>}
            </span>
            <span className="text-muted-foreground" data-event-reply="">
              <bdi>{c.reply}</bdi>
            </span>
          </>
        )
      }
      case 'refusal':
        return (
          <>
            <code className="font-mono font-semibold" data-event-refusal={data.refusal.code}>
              <Ltr>{data.refusal.code}</Ltr>
            </code>
            <Both says={data.refusal.reason} />
          </>
        )
      case 'hold':
      case 'budget':
        return (
          <span>
            <BudgetMoveText {...data.move} currency={context.currency} />
          </span>
        )
      case 'journal':
        return (
          <span>
            <JournalMoveText move={data.move} />
          </span>
        )
    }
  })()
  return (
    <div className="flex flex-col gap-0.5 py-1.5 leading-snug whitespace-normal" data-event={data.kind}>
      {body}
    </div>
  )
}

const campaignOf = (e: TimelineEntry): string => (e.kind === 'call' ? '' : e.kind === 'refusal' ? (e.refusal.campaignCode ?? '') : (e.move.campaignCode ?? ''))
const requestOf = (e: TimelineEntry): string => (e.kind === 'call' ? e.call.requestId : e.kind === 'refusal' ? (e.refusal.requestId ?? '') : (e.move.requestId ?? ''))

const COL_DEF: ColDef<TimelineEntry> = { ...OMS_GRID_BASE_COL_DEF, sortable: false, resizable: true, suppressHeaderMenuButton: true }

/** Events (ticket 518): every call and the movements it caused, oldest first by local time. */
export default function SessionEvents({ session }: { session: RuleSession }) {
  const { t } = useTranslation('rule-sessions')
  const entries = useMemo(() => sessionTimeline(session), [session])
  const columns = useMemo<ColDef<TimelineEntry>[]>(
    () => [
      { colId: 'at', field: 'at', headerName: t('events.columns.at'), valueFormatter: ({ value }) => momentText(value as string), width: 170 },
      { colId: 'kind', headerName: t('events.columns.kind'), cellRenderer: KindCell, width: 110 },
      { colId: 'campaign', headerName: t('events.columns.campaign'), valueGetter: ({ data }) => (data ? campaignOf(data) : ''), width: 140 },
      { colId: 'what', headerName: t('events.columns.what'), cellRenderer: WhatCell, flex: 1, minWidth: 320, autoHeight: true },
      { colId: 'requestId', headerName: t('events.columns.requestId'), valueGetter: ({ data }) => (data ? requestOf(data) : ''), width: 150 },
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
  const context = useMemo(() => ({ currency: session.currency }), [session.currency])
  if (entries.length === 0) return <p className="text-sm text-muted-foreground">{t('events.none')}</p>
  return (
    <div data-session-events="">
      <AgGridReact<TimelineEntry>
        theme={omsGridTheme}
        rowData={entries}
        columnDefs={columns}
        defaultColDef={COL_DEF}
        getRowId={({ data }) => data.key}
        context={context}
        rowHeight={OMS_GRID_ROW_HEIGHT}
        headerHeight={OMS_GRID_HEADER_HEIGHT}
        animateRows={false}
        suppressColumnVirtualisation
        domLayout="autoHeight"
      />
    </div>
  )
}
