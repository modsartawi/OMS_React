import type { ColDef, ICellRendererParams, ValueFormatterParams } from 'ag-grid-community'
import type { TFunction } from 'i18next'
import { Trans } from 'react-i18next'
import { Link } from 'react-router'

import type { StoreDayRow } from '@/core/models/sap-export'
import { OMS_GRID_BASE_COL_DEF } from '@/core/theme/grid-base'
import Ltr from '@/core/ui/Ltr'
import { flagToken, labelToken } from './label-helpers'
import { stateMeaningKey } from './state-helpers'
import { figure, formatHours, inspectorHref } from './storeday-helpers'
import TokenBadgeView from './TokenBadgeView'

/**
 * The store-day grid (ticket 461). Sorting and paging are the door's — worst label first,
 * then the transaction — so no column sorts or filters on the client: a sort over one page of
 * 50 would reorder a page, not the day. The reason is the server's free text and keeps the
 * base cell, which isolates it (`<bdi>`, dir auto).
 */
export const STORE_DAY_DEFAULT_COL_DEF: ColDef = {
  ...OMS_GRID_BASE_COL_DEF,
  sortable: false,
  filter: false,
  resizable: true,
  cellDataType: false,
}

const MONO = 'font-mono text-[12px]'

export function buildStoreDayColumns(t: TFunction, code: string): ColDef<StoreDayRow>[] {
  return [
    {
      // 🔑 The way into the IDoc inspector — a URL only; 462 makes the inspector open on it.
      headerName: t('grid.columns.trxNumber'),
      field: 'trxNumber',
      width: 150,
      cellClass: MONO,
      cellRenderer: (p: ICellRendererParams<StoreDayRow>) =>
        p.data ? (
          <Link
            to={inspectorHref(code, p.data.trxNumber)}
            className="font-medium text-primary underline-offset-2 hover:underline"
            title={t('grid.openInspector')}
            data-inspector-link={p.data.trxNumber}
          >
            <Ltr>{p.data.trxNumber}</Ltr>
          </Link>
        ) : null,
    },
    { headerName: t('grid.columns.machineCode'), field: 'machineCode', width: 100, cellClass: MONO },
    {
      headerName: t('grid.columns.rail'),
      field: 'rail',
      width: 100,
      valueFormatter: (p: ValueFormatterParams<StoreDayRow, string>) => (p.value ? t(`rails.${p.value}`, { defaultValue: p.value }) : ''),
    },
    {
      headerName: t('grid.columns.state'),
      field: 'state',
      width: 230,
      cellRenderer: (p: ICellRendererParams<StoreDayRow>) => {
        if (!p.data) return null
        const key = stateMeaningKey(p.data.state)
        return (
          <span className="inline-flex items-baseline gap-1.5" data-state={p.data.state}>
            <span className={MONO}>
              <Ltr>{p.data.state}</Ltr>
            </span>
            {key && <span className="truncate text-muted-foreground">{t(key)}</span>}
          </span>
        )
      },
    },
    {
      headerName: t('grid.columns.label'),
      field: 'label',
      width: 150,
      cellRenderer: (p: ICellRendererParams<StoreDayRow>) =>
        p.data ? (
          <span data-label={p.data.label}>
            <TokenBadgeView badge={labelToken(p.data.label)} value={p.data.label} />
          </span>
        ) : null,
    },
    {
      headerName: t('grid.columns.version'),
      field: 'version',
      width: 90,
      cellClass: MONO,
      valueFormatter: (p: ValueFormatterParams<StoreDayRow, string | null>) => p.value ?? t('grid.noVersion'),
    },
    {
      // A legacy row carries the store's counter watermark beside its counter: the pair that
      // says whether the uploader has passed it.
      headerName: t('grid.columns.counter'),
      field: 'counter',
      width: 180,
      cellRenderer: (p: ICellRendererParams<StoreDayRow>) => {
        if (!p.data) return null
        const { counter, rail, watermark } = p.data
        return (
          <span className="inline-flex items-baseline gap-1.5" data-counter={counter}>
            <span className={MONO}>
              <Ltr>{String(counter)}</Ltr>
            </span>
            {rail === 'legacy' && watermark != null && (
              <span className="text-xs text-muted-foreground" data-watermark={watermark}>
                <Trans t={t} i18nKey="grid.watermark" values={{ n: String(watermark) }} components={{ n: <Ltr /> }} />
              </span>
            )}
          </span>
        )
      },
    },
    {
      headerName: t('grid.columns.hoursPastDayEnd'),
      field: 'hoursPastDayEnd',
      width: 150,
      type: 'rightAligned',
      valueFormatter: (p: ValueFormatterParams<StoreDayRow, number | null>) => formatHours(p.value ?? null),
    },
    {
      // N1 only: "held k of m", and whether the hold is missing rows or a questionable posting
      // (spec 2579 story 19) — which says whether a release is possible.
      headerName: t('grid.columns.held'),
      colId: 'held',
      width: 210,
      cellRenderer: (p: ICellRendererParams<StoreDayRow>) => {
        const held = p.data?.held
        if (!held) return null
        return (
          <span className="inline-flex items-baseline gap-1.5" data-held={held.held} data-held-of={held.of}>
            <span>
              <Trans t={t} i18nKey="grid.held" values={{ held: figure(held.held), of: figure(held.of) }} components={{ n: <Ltr />, m: <Ltr /> }} />
            </span>
            <span className="text-xs text-muted-foreground" data-hold={held.missingRows ? 'missingRows' : 'questionablePosting'}>
              {t(held.missingRows ? 'grid.missingRows' : 'grid.questionablePosting')}
            </span>
          </span>
        )
      },
    },
    {
      headerName: t('grid.columns.flags'),
      colId: 'flags',
      width: 220,
      cellRenderer: (p: ICellRendererParams<StoreDayRow>) =>
        p.data && p.data.flags.length > 0 ? (
          <span className="inline-flex flex-wrap items-center gap-1" data-flags={p.data.flags.join(' ')}>
            {/* Keyed by position too: a door that repeated a flag must not collide two chips. */}
            {p.data.flags.map((flag, i) => (
              <TokenBadgeView key={`${i}-${flag}`} badge={flagToken(flag)} value={flag} />
            ))}
          </span>
        ) : null,
    },
    // Last, and the one column that stretches: the reason is the longest value on the row.
    { headerName: t('grid.columns.reason'), field: 'reason', flex: 1, minWidth: 260 },
  ]
}
