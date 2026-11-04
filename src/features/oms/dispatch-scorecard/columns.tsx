import type { TFunction } from 'i18next'
import type { ColDef, ICellRendererParams, IHeaderParams, ValueFormatterParams } from 'ag-grid-community'
import { Trans } from 'react-i18next'
import type {
  CalloutOfferedLine,
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
  afterTakeKey,
  afterTakeReason,
  attemptsSwept,
  itemText,
  itemsText,
  attemptText,
  plainText,
  shortLineParts,
  showsAfterTake,
} from './after-take'
import {
  STAFF_COLUMNS,
  STORE_COLUMNS,
  compareRanked,
  directionLabelKey,
  formatMeasure,
  formatSeconds,
  isRate,
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
    case 'failedTakeRate':
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

/** The Stores tab's columns: Store (opens the card), the six ranked measures, then the context. */
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
    case 'failedTakeRate':
      return { headerTooltip: t('columnHint.failedTakeRate') }
    case 'fallbackCancels':
      return { headerTooltip: t('columnHint.fallbackCancels') }
    case 'refusedCloses':
      return { headerTooltip: t('columnHint.refusedCloses') }
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

/**
 * The drill drawer's columns: one row per bid (or callout), each opening its delivery. A rate's drill marks
 * Counted; a failed-take, fallback-cancel or refused-close drill (spec 3326) reads what happened after the
 * take (taker, closer, time, outcome, the reason exactly as given, courier, items, stock at offer) and a
 * refused-close drill its refused attempts.
 */
export function drillColumns(t: TFunction, figure: DispatchScorecardFigure): ColDef<DispatchScorecardDrillRow>[] {
  const dash = t('dash')
  const text = (value: string | null | undefined) => (value ? value : dash)
  const rate = isRate(figure)
  const afterTake = showsAfterTake(figure)
  const atpLabel = (atp: string | undefined) => (atp ? t(`atp.${atp}`, { defaultValue: atp }) : dash)
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
    // A refused close's attempts sit right after its outcome, where they are read first.
    ...(figure === 'refusedCloses' ? [refusedAttemptsColumn(t, dash)] : []),
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
    {
      colId: 'answeredBy',
      field: 'answeredBy',
      // On an after-take drill the person who answered is the taker, beside the closer.
      headerName: afterTake ? t('drill.column.takenBy') : t('drill.column.staff'),
      minWidth: 110,
      valueFormatter: ({ value }) => text(value),
    },
    ...(afterTake ? afterTakeColumns(t, dash, text) : []),
    {
      colId: 'distanceKm',
      field: 'distanceKm',
      headerName: t('drill.column.km'),
      type: 'numericColumn',
      minWidth: 70,
      valueFormatter: ({ value }) => (typeof value === 'number' ? value.toFixed(1) : dash),
    },
    afterTake
      ? atpAtOfferColumn(t, dash)
      : ({
          colId: 'atp',
          field: 'atp',
          headerName: t('drill.column.atp'),
          minWidth: 90,
          valueFormatter: ({ value }) => atpLabel(value),
        } as ColDef<DispatchScorecardDrillRow>),
    {
      colId: 'tills',
      headerName: t('drill.column.tills'),
      headerTooltip: t('drill.tillsHint'),
      minWidth: 90,
      valueGetter: ({ data }) => (data ? formatCount(data.onlineTills, data.signedInTills) : dash),
    },
  ]
}

/**
 * Stock at offer, and its short lines when the snapshot has any (spec 3326). "Unknown" = the check did not
 * run; a short line with no stock row reads "Not on record". Shared by the after-take drill and the closes report.
 */
export function atpAtOfferColumn(t: TFunction, dash: string): ColDef<DispatchScorecardDrillRow> {
  const atpLabel = (atp: string | undefined) => (atp ? t(`atp.${atp}`, { defaultValue: atp }) : dash)
  const shortLineValues = (line: CalloutOfferedLine) => {
    const parts = shortLineParts(line)
    return { material: parts.material, needed: parts.needed, available: parts.available ?? t('drill.notOnRecord') }
  }
  return {
    colId: 'atp',
    headerName: t('drill.column.atp'),
    minWidth: 240,
    autoHeight: true,
    valueGetter: ({ data }) =>
      data
        ? [atpLabel(data.atp), ...(data.atpShortLines ?? []).map((line) => plainText(t('drill.shortLine', shortLineValues(line))))].join('; ')
        : dash,
    cellRenderer: ({ data }: ICellRendererParams<DispatchScorecardDrillRow>) =>
      data ? (
        <div className="flex flex-col py-1 leading-5" data-sc-atp={data.atp}>
          <bdi>{atpLabel(data.atp)}</bdi>
          {(data.atpShortLines ?? []).map((line) => (
            <span key={line.line} className="text-[12px] text-muted-foreground" data-sc-short-line={line.material}>
              <Trans
                t={t}
                i18nKey="drill.shortLine"
                values={shortLineValues(line)}
                components={{ m: <Ltr />, n: <Ltr />, a: line.availableBase == null ? <span data-sc-not-on-record="" /> : <Ltr /> }}
              />
            </span>
          ))}
        </div>
      ) : null,
  }
}

/** Closed by, Closed at, What happened, Reason (as given), Courier, Items: on an after-take drill only. */
function afterTakeColumns(
  t: TFunction,
  dash: string,
  text: (value: string | null | undefined) => string,
): ColDef<DispatchScorecardDrillRow>[] {
  const reasonText = (row: DispatchScorecardDrillRow) => {
    const reason = afterTakeReason(row)
    return reason.kind === 'text' ? reason.text : reason.kind === 'noReason' ? t('drill.noReason') : dash
  }
  return [
    { colId: 'closedBy', field: 'closedBy', headerName: t('drill.column.closedBy'), minWidth: 110, valueFormatter: ({ value }) => text(value) },
    {
      colId: 'closedAt',
      field: 'closedAt',
      headerName: t('drill.column.closedAt'),
      minWidth: 140,
      valueFormatter: ({ value }) => text(formatDateTime(value)),
    },
    {
      colId: 'afterTake',
      headerName: t('drill.column.afterTake'),
      minWidth: 190,
      valueGetter: ({ data }) => {
        const key = afterTakeKey(data?.afterTakeOutcome)
        return key ? t(key, { defaultValue: data?.afterTakeOutcome }) : dash
      },
    },
    {
      // The reason exactly as sent (the courier's own words, maybe Arabic): no translation, no mapping.
      colId: 'reason',
      headerName: t('drill.column.reason'),
      minWidth: 200,
      wrapText: true,
      autoHeight: true,
      valueGetter: ({ data }) => (data ? reasonText(data) : dash),
      cellRenderer: ({ data }: ICellRendererParams<DispatchScorecardDrillRow>) => {
        if (!data) return null
        const reason = afterTakeReason(data)
        if (reason.kind === 'text')
          return (
            <bdi className="leading-5" data-sc-reason="text">
              {reason.text}
            </bdi>
          )
        return (
          <span className="text-muted-foreground" data-sc-reason={reason.kind}>
            {reason.kind === 'noReason' ? t('drill.noReason') : dash}
          </span>
        )
      },
    },
    { colId: 'courier', field: 'afterTakeCourier', headerName: t('drill.column.courier'), minWidth: 130, valueFormatter: ({ value }) => text(value) },
    {
      colId: 'items',
      headerName: t('drill.column.items'),
      minWidth: 160,
      autoHeight: true,
      valueGetter: ({ data }) => itemsText(data?.items, dash),
      cellRenderer: ({ data }: ICellRendererParams<DispatchScorecardDrillRow>) =>
        data?.items?.length ? (
          <ul className="flex flex-col py-1 leading-5" data-sc-items={data.items.length}>
            {data.items.map((item, i) => (
              <li key={`${item.itemNumber}-${i}`}>
                <Ltr>{itemText(item)}</Ltr>
              </li>
            ))}
          </ul>
        ) : (
          <span>{dash}</span>
        ),
    },
  ]
}

/**
 * A refused-close row's attempts under it, oldest first: each attempt is ONE line (time · who · till · reason,
 * `attemptText`), isolated once — led by its time, so `Ltr`; swept ones read the note.
 */
export function refusedAttemptsColumn(t: TFunction, dash: string): ColDef<DispatchScorecardDrillRow> {
  return {
    colId: 'refusedAttempts',
    headerName: t('drill.column.refusedAttempts'),
    minWidth: 340,
    wrapText: true,
    autoHeight: true,
    valueGetter: ({ data }) =>
      !data
        ? dash
        : attemptsSwept('refusedCloses', data)
          ? t('drill.attemptsSwept')
          : (data.refusedAttempts ?? []).map((a) => attemptText(a, dash)).join('; '),
    cellRenderer: ({ data }: ICellRendererParams<DispatchScorecardDrillRow>) => {
      if (!data) return null
      if (attemptsSwept('refusedCloses', data))
        return (
          <span className="leading-5 text-muted-foreground" data-sc-attempts-swept="">
            {t('drill.attemptsSwept')}
          </span>
        )
      return (
        <ol className="flex flex-col py-1 leading-5" data-sc-attempts={data.refusedAttempts?.length ?? 0}>
          {(data.refusedAttempts ?? []).map((a, i) => (
            <li key={`${a.at}-${i}`} data-sc-attempt="">
              {/* The whole line built once and isolated once: isolating its parts reverses them under RTL. */}
              <Ltr>{attemptText(a, dash)}</Ltr>
            </li>
          ))}
        </ol>
      )
    },
  }
}
