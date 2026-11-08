import type { ColDef, ICellRendererParams, ValueFormatterParams } from 'ag-grid-community'
import type { TFunction } from 'i18next'
import { Lock } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { courierQuoteView } from '@/core/dispatch/courier-quote'
import SearchRadius, { searchRadiusText } from '@/core/dispatch/SearchRadius'
import { countdownLeft, formatClock, outcomeView } from '@/core/dispatch/view'
import type { DispatchCallout } from '@/core/models/dispatch-board'
import { OMS_GRID_BASE_COL_DEF } from '@/core/theme/grid-base'
import Ltr from '@/core/ui/Ltr'
import { useSecondClock } from '@/core/ui/second-clock'
import StatusBadge from '@/core/ui/StatusBadge'
import { formatPair, fsi } from '@/core/util/bidi'
import { formatTimeOfDay } from '@/core/util/date-format'
import { formatMoney } from '@/core/util/number-format'
import { CourierFlag } from './CourierQuote'

/** A board row: the callout and the client time its read arrived (the countdown's origin). */
export type BoardRow = DispatchCallout & { fetchedAt: number }

/** Read-only grids: the door orders both lists (soonest to expire, latest ended). */
export const BOARD_DEFAULT_COL_DEF: ColDef = {
  ...OMS_GRID_BASE_COL_DEF,
  sortable: false,
  filter: false,
  resizable: true,
  cellDataType: false,
}

const MONO = 'font-mono text-[12px]'

/** The live countdown: the door's `secondsLeft`, moved by the shared 1 s clock (one interval for every cell), never below 0. */
export function Countdown({ secondsLeft, fetchedAt }: { secondsLeft: number | null; fetchedAt: number }) {
  const { t } = useTranslation('dispatch-board')
  const now = useSecondClock()
  const left = countdownLeft(secondsLeft, fetchedAt, now)
  if (left == null) return null
  return (
    <span className={'tabular-nums ' + (left < 60 ? 'text-danger-800' : '')} data-countdown={left}>
      <span className="font-mono font-medium">
        <Ltr>{formatClock(left)}</Ltr>
      </span>{' '}
      <span className="text-muted-foreground">{t('countdown.left')}</span>
    </span>
  )
}

function CountdownCell(p: ICellRendererParams<BoardRow>) {
  return p.data ? <Countdown secondsLeft={p.data.secondsLeft} fetchedAt={p.data.fetchedAt} /> : null
}

function OutcomeCell(p: ICellRendererParams<BoardRow>) {
  const { t } = useTranslation('dispatch-board')
  if (!p.data) return null
  const c = p.data
  const view = outcomeView(c.outcome)
  const store = c.awardedParty || c.fallbackParty
  return (
    <span className="inline-flex items-center gap-1.5" data-outcome={c.outcome}>
      <StatusBadge sev={view.sev}>{view.key ? t(view.key) : <Ltr>{view.raw}</Ltr>}</StatusBadge>
      {store && (
        <span className="font-mono text-[12px]">
          <Ltr>{store}</Ltr>
        </span>
      )}
      {c.locked && <Lock className="h-3 w-3 text-attention-800" aria-label={t('inspector.lockedShort')} data-locked="" />}
    </span>
  )
}

function DeliveryCell(p: ICellRendererParams<BoardRow>) {
  return p.data ? (
    <span className="font-medium" data-delivery={p.data.deliveryNumber}>
      <Ltr>{p.data.deliveryNumber}</Ltr>
    </span>
  ) : null
}

/** Spec 3326: the radius behind the result, quiet; empty for a callout read before 3326. */
function RadiusCell(p: ICellRendererParams<BoardRow>) {
  return p.data ? <SearchRadius callout={p.data} className="text-muted-foreground" /> : null
}

const time = (p: ValueFormatterParams<BoardRow, string | null>) => formatTimeOfDay(p.value ?? null)

function common(t: TFunction): ColDef<BoardRow>[] {
  return [
    { headerName: t('columns.delivery'), colId: 'delivery', field: 'deliveryNumber', width: 130, cellClass: MONO, cellRenderer: DeliveryCell },
    { headerName: t('columns.opened'), field: 'openedAt', width: 80, cellClass: MONO, valueFormatter: time },
    { headerName: t('columns.channel'), field: 'channel', width: 90, cellClass: MONO },
    // District · city is free text in either script: the base cell isolates the whole pair.
    { headerName: t('columns.place'), colId: 'place', width: 180, valueGetter: (p) => formatPair(p.data?.district, p.data?.city) },
    {
      headerName: t('columns.value'),
      field: 'value',
      width: 100,
      type: 'rightAligned',
      cellClass: MONO,
      valueFormatter: (p: ValueFormatterParams<BoardRow, number>) => formatMoney(p.value),
    },
    { headerName: t('columns.bids'), colId: 'bids', width: 70, type: 'rightAligned', cellClass: MONO, valueGetter: (p) => p.data?.bids.length ?? 0 },
    // 858: the value is the label in words (km, measure, fallback reason, widened), so copy and filter read it and any
    // change to one of them refreshes the cell. The tooltip carries the whole label for a cut-off cell; fsi there only.
    {
      headerName: t('columns.radius'),
      colId: 'radius',
      width: 240,
      valueGetter: (p) => searchRadiusText(t, p.data),
      tooltipValueGetter: (p) => searchRadiusText(t, p.data, fsi) || null,
      cellRenderer: RadiusCell,
    },
    // 712: the courier quote's flag, NoCourier / Failed only. The value is what the cell reads (the flag and the
    // check's time of day, one pair; empty otherwise), so copy and filter see words, and a new check refreshes it.
    {
      headerName: t('columns.courier'),
      colId: 'courier',
      width: 230,
      valueGetter: (p) => {
        const view = courierQuoteView(p.data?.courierQuote)
        return view.kind === 'flag' ? formatPair(t(view.key), formatTimeOfDay(view.checkedAt)) : ''
      },
      cellRenderer: CourierCell,
    },
  ]
}

function CourierCell(p: ICellRendererParams<BoardRow>) {
  return p.data ? <CourierFlag quote={p.data.courierQuote} /> : null
}

/** On callout now: the callout and its live countdown. */
export function buildOpenColumns(t: TFunction): ColDef<BoardRow>[] {
  return [
    ...common(t),
    {
      headerName: t('columns.countdown'),
      colId: 'countdown',
      width: 120,
      // The value changes with every read, so a fresh `secondsLeft` refreshes the cell.
      valueGetter: (p) => `${p.data?.secondsLeft ?? ''}@${p.data?.fetchedAt ?? ''}`,
      cellRenderer: CountdownCell,
    },
  ]
}

/** Closed · last 60 min: the outcome, the store it went to, the lock, and when it ended. */
export function buildClosedColumns(t: TFunction): ColDef<BoardRow>[] {
  return [
    ...common(t),
    {
      headerName: t('columns.outcome'),
      colId: 'outcome',
      width: 190,
      valueGetter: (p) => `${p.data?.outcome}|${p.data?.locked}|${p.data?.awardedParty || p.data?.fallbackParty}`,
      cellRenderer: OutcomeCell,
    },
    { headerName: t('columns.ended'), field: 'endedAt', width: 80, cellClass: MONO, valueFormatter: time },
  ]
}
