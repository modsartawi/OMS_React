import type { ColDef, ICellRendererParams, ValueFormatterParams } from 'ag-grid-community'
import type { TFunction } from 'i18next'
import { Link } from 'react-router'

import Ltr from '@/core/ui/Ltr'
import { formatDateTime, formatDay } from '@/core/util/date-format'
import type { DoubleSendView } from './double-send-helpers'
import { flagToken } from './label-helpers'
import { stateMeaningKey } from './state-helpers'
import { STORE_DAY_DEFAULT_COL_DEF } from './storeday-columns'
import { inspectorHref, storeDayHref, storeHref } from './storeday-helpers'
import TokenBadgeView from './TokenBadgeView'

/**
 * The double-send list's columns (ticket 465). Sorting and paging are the door's (X1p first, then
 * store, day, transaction), so no column sorts or filters on the client. The same read-only base as
 * the store-day grid. Each row links three ways: its store, its store-day, and the IDoc inspector.
 */
export const DOUBLE_SEND_DEFAULT_COL_DEF: ColDef = STORE_DAY_DEFAULT_COL_DEF

const MONO = 'font-mono text-[12px]'
const LINK = 'font-medium text-primary underline-offset-2 hover:underline'

export function buildDoubleSendColumns(t: TFunction): ColDef<DoubleSendView>[] {
  return [
    {
      // X1p is red AND says it can still be stopped (spec 2579 story 26); X1 is red alone.
      headerName: t('doubleSends.columns.flag'),
      field: 'flag',
      width: 300,
      cellRenderer: (p: ICellRendererParams<DoubleSendView>) =>
        p.data ? (
          <span className="inline-flex items-center gap-1.5" data-flag={p.data.flag}>
            <TokenBadgeView badge={flagToken(p.data.flag)} value={p.data.flag} />
            {p.data.stoppable && (
              <span className="text-xs font-semibold text-danger-800" data-stoppable="">
                {t('doubleSends.stoppable')}
              </span>
            )}
          </span>
        ) : null,
    },
    {
      headerName: t('doubleSends.columns.code'),
      field: 'code',
      width: 90,
      cellClass: MONO,
      cellRenderer: (p: ICellRendererParams<DoubleSendView>) =>
        p.data ? (
          <Link to={storeHref(p.data.code)} className={LINK} data-store-link={p.data.code}>
            <Ltr>{p.data.code}</Ltr>
          </Link>
        ) : null,
    },
    {
      // 🔑 The way into the store-day page that holds it.
      headerName: t('doubleSends.columns.day'),
      field: 'day',
      width: 130,
      cellClass: MONO,
      cellRenderer: (p: ICellRendererParams<DoubleSendView>) =>
        p.data ? (
          <Link to={storeDayHref(p.data.code, p.data.day)} className={LINK} title={t('doubleSends.openDay')} data-day-link={p.data.day}>
            <Ltr>{formatDay(p.data.day)}</Ltr>
          </Link>
        ) : null,
    },
    {
      // 🔑 The way into the IDoc inspector — a URL only; 462 makes the inspector open on it.
      headerName: t('doubleSends.columns.trxNumber'),
      field: 'trxNumber',
      width: 150,
      cellClass: MONO,
      cellRenderer: (p: ICellRendererParams<DoubleSendView>) =>
        p.data ? (
          <Link to={inspectorHref(p.data.code, p.data.trxNumber)} className={LINK} title={t('grid.openInspector')} data-inspector-link={p.data.trxNumber}>
            <Ltr>{p.data.trxNumber}</Ltr>
          </Link>
        ) : null,
    },
    {
      headerName: t('doubleSends.columns.version'),
      field: 'version',
      width: 90,
      cellClass: MONO,
      valueFormatter: (p: ValueFormatterParams<DoubleSendView, string | null>) => p.value ?? t('grid.noVersion'),
    },
    {
      headerName: t('doubleSends.columns.state'),
      field: 'state',
      width: 230,
      cellRenderer: (p: ICellRendererParams<DoubleSendView>) => {
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
      // The new rail's documents exported of those made: 0 / n is what still can be stopped.
      headerName: t('doubleSends.columns.documents'),
      field: 'exportedOf',
      width: 160,
      type: 'rightAligned',
      cellClass: MONO,
    },
    {
      headerName: t('doubleSends.columns.legacyUploadedAt'),
      field: 'legacyUploadedAt',
      width: 160,
      cellClass: MONO,
      valueFormatter: (p: ValueFormatterParams<DoubleSendView, string | null>) => formatDateTime(p.value),
    },
    // Last, and the one column that stretches: a file name is the longest value on the row.
    { headerName: t('doubleSends.columns.legacyFile'), field: 'legacyFile', flex: 1, minWidth: 220, cellClass: MONO },
  ]
}
