import type { TFunction } from 'i18next'
import type { ColDef, ICellRendererParams, IHeaderParams, ValueFormatterParams } from 'ag-grid-community'
import type {
  DispatchScorecardDrillRow,
  DispatchScorecardFigure,
  DispatchScorecardStaffRow,
  DispatchScorecardStoreRow,
} from '@/core/models/dispatch-scorecard'
import { pinStart } from '@/core/theme/direction'
import Ltr from '@/core/ui/Ltr'
import { formatCount, formatPair } from '@/core/util/bidi'
import { formatDateTime } from '@/core/util/date-format'
import {
  STAFF_COLUMNS,
  STORE_COLUMNS,
  compareRanked,
  directionLabelKey,
  formatMeasure,
  formatSeconds,
  type ScorecardColumn,
} from './figures'

/** Opens the drill drawer for a figure of a row (a store's, or a person's own). */
export type OpenDrill = (figure: DispatchScorecardFigure, who: { store?: string; staff?: string }) => void

/**
 * A ranked column's header: AG Grid's own (so the sort and its arrow stay), with the measure's better
 * direction under its name (2950 point 3: "each labelled with its better direction").
 */
function DirectionHeader(params: IHeaderParams & { direction?: string }) {
  const direction = params.column.getColDef().headerComponentParams?.direction as string | undefined
  return (
    <span className="flex flex-col leading-tight" data-sc-header={params.column.getColId()}>
      <span>{params.displayName}</span>
      {direction && (
        <span className="text-[10.5px] font-normal text-muted-foreground" data-sc-direction="">
          {direction}
        </span>
      )}
    </span>
  )
}

/** A figure that opens the bids behind it: a link-styled button, its whole value isolated. */
function FigureLink({ text, figure, onOpen }: { text: string; figure: string; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="cursor-pointer text-primary underline decoration-dotted underline-offset-2 hover:decoration-solid"
      data-sc-drill={figure}
    >
      <Ltr>{text}</Ltr>
    </button>
  )
}

/** A count as sent, the dash for an absent one. */
const count = (value: unknown, dash: string) => (typeof value === 'number' && Number.isFinite(value) ? String(value) : dash)

/** How a column's value reads (the grid text, the export's text, and the link's). */
function columnText<R>(field: string, row: R | undefined, dash: string): string {
  const r = row as Record<string, unknown> | undefined
  const value = r?.[field] as number | null | undefined
  switch (field) {
    case 'ignoreRate':
    case 'winRate':
    case 'declineRate':
    case 'medianAnswerSeconds':
    case 'slowQuarterAnswerSeconds':
      return formatMeasure(field, value, dash)
    case 'medianKm':
      return typeof value === 'number' ? value.toFixed(1) : dash
    default:
      return count(value, dash)
  }
}

/** One figure column of either tab, from its plan in `figures.ts`. */
function figureColumn<R extends { tooFew: boolean }>(
  t: TFunction,
  col: ScorecardColumn<string>,
  dash: string,
  open: (figure: DispatchScorecardFigure, row: R) => void,
  extra: Partial<ColDef<R>> = {},
): ColDef<R> {
  const label = col.ranked ? t(`measure.${col.field}`) : t(`column.${col.field}`)
  return {
    colId: col.field,
    field: col.field as ColDef<R>['field'],
    headerName: label,
    minWidth: col.ranked ? 118 : 96,
    flex: 1,
    type: 'numericColumn',
    cellClass: 'text-end tabular-nums',
    sortable: col.sortable,
    valueFormatter: ({ data }: ValueFormatterParams<R>) => columnText(col.field, data, dash),
    ...(col.ranked
      ? {
          headerComponentParams: { innerHeaderComponent: DirectionHeader, direction: col.better && t(directionLabelKey(col.better)) },
          comparator: (
            a: number | null | undefined,
            b: number | null | undefined,
            nodeA: { data?: R },
            nodeB: { data?: R },
            isDescending: boolean,
          ) => compareRanked(a ?? null, b ?? null, nodeA.data?.tooFew === true, nodeB.data?.tooFew === true, isDescending),
        }
      : {}),
    ...(col.drill
      ? {
          cellRenderer: ({ data, valueFormatted }: ICellRendererParams<R>) =>
            data ? <FigureLink text={valueFormatted ?? dash} figure={col.drill!} onOpen={() => open(col.drill!, data)} /> : null,
        }
      : {}),
    ...extra,
  }
}

/** The Stores tab's columns: Store (opens the card), the five ranked measures, then the context. */
export function storeColumns(
  t: TFunction,
  openCard: (store: string) => void,
  openDrill: OpenDrill,
): ColDef<DispatchScorecardStoreRow>[] {
  const dash = t('dash')
  const drill = (figure: DispatchScorecardFigure, row: DispatchScorecardStoreRow) => openDrill(figure, { store: row.store })
  return [
    {
      colId: 'store',
      headerName: t('column.store'),
      pinned: pinStart,
      minWidth: 200,
      sortable: false,
      valueGetter: ({ data }) => formatPair(data?.store, data?.name),
      cellRenderer: ({ data }: ICellRendererParams<DispatchScorecardStoreRow>) =>
        data ? (
          <span className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => openCard(data.store)}
              className="cursor-pointer truncate text-start font-medium text-primary hover:underline"
              data-sc-store={data.store}
            >
              <Ltr>{formatPair(data.store, data.name)}</Ltr>
            </button>
            {data.tooFew && <TooFew t={t} />}
          </span>
        ) : null,
    },
    ...STORE_COLUMNS.map((col) =>
      figureColumn<DispatchScorecardStoreRow>(t, col, dash, drill, contextExtra(t, col.field, dash)),
    ),
  ]
}

/** The context columns that read more than their own count. */
function contextExtra(t: TFunction, field: string, dash: string): Partial<ColDef<DispatchScorecardStoreRow>> {
  switch (field) {
    case 'lostRaces':
      // Near misses (≤ 10 s after the award: poll luck, not slowness) ride beside lost races.
      return {
        headerName: t('column.lostRacesNearMisses'),
        headerTooltip: t('columnHint.lostRaces'),
        valueFormatter: ({ data }) => (data ? `${count(data.lostRaces, dash)} (${count(data.nearMisses, dash)})` : dash),
      }
    case 'unseen':
      return {
        headerTooltip: t('columnHint.unseen'),
        valueFormatter: ({ data }) =>
          data ? `${count(data.unseen, dash)} (${formatPair(count(data.unseenNobodySignedIn, dash), count(data.unseenOldBuild, dash))})` : dash,
      }
    case 'releasedAfterAward':
      return {
        headerTooltip: t('columnHint.releasedAfterAward'),
        tooltipValueGetter: ({ data }) => {
          const reasons = Object.entries(data?.releasedByReason ?? {})
          return reasons.length ? reasons.map(([reason, n]) => `${reason}: ${n}`).join('\n') : undefined
        },
      }
    default:
      return {}
  }
}

/** The Staff tab's columns: the person, their stores, then their own figures (two ranked). */
export function staffColumns(t: TFunction, openDrill: OpenDrill): ColDef<DispatchScorecardStaffRow>[] {
  const dash = t('dash')
  const drill = (figure: DispatchScorecardFigure, row: DispatchScorecardStaffRow) => openDrill(figure, { staff: row.staff })
  return [
    {
      colId: 'staff',
      field: 'staff',
      headerName: t('column.staff'),
      pinned: pinStart,
      minWidth: 160,
      sortable: false,
      cellRenderer: ({ data }: ICellRendererParams<DispatchScorecardStaffRow>) =>
        data ? (
          <span className="flex items-center gap-1.5" data-sc-staff={data.staff}>
            <bdi>{data.staff}</bdi>
            {data.tooFew && <TooFew t={t} />}
          </span>
        ) : null,
    },
    {
      colId: 'stores',
      headerName: t('column.stores'),
      minWidth: 120,
      sortable: false,
      valueGetter: ({ data }) => (data?.stores ?? []).join(', '),
    },
    ...STAFF_COLUMNS.map((col) => figureColumn<DispatchScorecardStaffRow>(t, col, dash, drill)),
  ]
}

function TooFew({ t }: { t: TFunction }) {
  return (
    <span className="rounded-full border border-border px-1.5 text-[10.5px] text-muted-foreground" data-sc-too-few="">
      {t('tooFew')}
    </span>
  )
}

/** The drill drawer's columns: one row per bid (or callout), each opening its delivery. */
export function drillColumns(t: TFunction, rate: boolean): ColDef<DispatchScorecardDrillRow>[] {
  const dash = t('dash')
  const text = (value: string | null | undefined) => (value ? value : dash)
  return [
    { colId: 'offeredAt', field: 'offeredAt', headerName: t('drill.column.offeredAt'), minWidth: 150, valueFormatter: ({ value }) => text(formatDateTime(value)) },
    { colId: 'subjectId', field: 'subjectId', headerName: t('drill.column.delivery'), minWidth: 120, cellClass: 'font-mono text-[12px]' },
    { colId: 'party', field: 'party', headerName: t('drill.column.store'), minWidth: 80, cellClass: 'font-mono text-[12px]' },
    {
      colId: 'class',
      field: 'class',
      headerName: t('drill.column.class'),
      minWidth: 150,
      valueFormatter: ({ data }) => {
        if (!data) return dash
        const label = t(`class.${data.class}`, { defaultValue: data.class })
        const why = data.ignoreReason ? t(`ignoreReason.${data.ignoreReason}`, { defaultValue: data.ignoreReason }) : ''
        const near = data.nearMiss ? t('drill.nearMiss') : ''
        const release = data.releaseReason ? data.releaseReason : ''
        return [label, why, near, release].filter(Boolean).join(' · ')
      },
    },
    ...(rate
      ? [
          {
            colId: 'counted',
            field: 'counted',
            headerName: t('drill.column.counted'),
            headerTooltip: t('drill.countedHint'),
            minWidth: 90,
            // Not AG Grid's inferred boolean checkbox: the column reads as the formatter words it.
            cellDataType: false,
            valueFormatter: ({ value }) => (value ? t('drill.counted') : t('drill.notCounted')),
          } as ColDef<DispatchScorecardDrillRow>,
        ]
      : []),
    {
      colId: 'answerSeconds',
      field: 'answerSeconds',
      headerName: t('drill.column.answer'),
      type: 'numericColumn',
      minWidth: 90,
      valueFormatter: ({ value }) => (typeof value === 'number' ? formatSeconds(value) : dash),
    },
    { colId: 'answeredBy', field: 'answeredBy', headerName: t('drill.column.staff'), minWidth: 110, valueFormatter: ({ value }) => text(value) },
    {
      colId: 'distanceKm',
      field: 'distanceKm',
      headerName: t('drill.column.km'),
      type: 'numericColumn',
      minWidth: 70,
      valueFormatter: ({ value }) => (typeof value === 'number' ? value.toFixed(1) : dash),
    },
    {
      colId: 'atp',
      field: 'atp',
      headerName: t('drill.column.atp'),
      minWidth: 90,
      valueFormatter: ({ value }) => (value ? t(`atp.${value}`, { defaultValue: value }) : dash),
    },
    {
      colId: 'tills',
      headerName: t('drill.column.tills'),
      headerTooltip: t('drill.tillsHint'),
      minWidth: 90,
      valueGetter: ({ data }) => (data ? formatCount(data.onlineTills, data.signedInTills) : dash),
    },
  ]
}
