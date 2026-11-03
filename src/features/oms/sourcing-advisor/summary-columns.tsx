import type { TFunction } from 'i18next'
import type { ColDef, ICellRendererParams, ValueFormatterParams } from 'ag-grid-community'
import { Link } from 'react-router'
import { Trans } from 'react-i18next'
import Ltr from '@/core/ui/Ltr'
import { sar } from './explain-model'
import { explainPath } from './paths'
import type { TopRow } from './summary-model'

/**
 * The top-savings grid's columns (ticket 739, spec 734 D15): each order links to its explanation (738).
 * Store `code · name` pairs and SAR ride the base cell's `<bdi>` (`OMS_GRID_BASE_COL_DEF`); the order
 * link and the reasons have their own renderers, which isolate their own values.
 */
function OrderLink({ data }: ICellRendererParams<TopRow>) {
  if (!data?.orderNo) return null
  return (
    <Link to={explainPath(data.orderNo)} className="font-mono text-primary underline underline-offset-2" data-sourcing-top-link={data.orderNo}>
      <Ltr>{data.orderNo}</Ltr>
    </Link>
  )
}

function Reasons({ data, context }: ICellRendererParams<TopRow> & { context: { t: TFunction } }) {
  const t = context.t
  if (!data || data.reasons.length === 0) return <span className="text-muted-foreground">{t('reasons.none')}</span>
  return (
    <span className="flex flex-col leading-snug" data-sourcing-top-reasons="">
      {data.reasons.map((r) => (
        <span key={r.code} data-reason={r.code}>
          <Trans t={t} i18nKey={r.key} values={{ code: r.code }} components={{ v: <Ltr /> }} />
        </span>
      ))}
    </span>
  )
}

export function topColumns(t: TFunction): ColDef<TopRow>[] {
  const dash = t('dash')
  return [
    { colId: 'orderNo', field: 'orderNo', headerName: t('summary.top.orderNo'), cellRenderer: OrderLink, width: 150 },
    { colId: 'actualStore', field: 'actualStore', headerName: t('summary.top.actualStore'), width: 190 },
    { colId: 'bestStore', field: 'bestStore', headerName: t('summary.top.bestStore'), width: 190 },
    {
      colId: 'saving',
      field: 'saving',
      headerName: t('summary.top.saving'),
      type: 'rightAligned',
      width: 130,
      valueFormatter: ({ value }: ValueFormatterParams<TopRow, number | null>) => sar(value) ?? dash,
    },
    { colId: 'reasons', headerName: t('summary.top.reasons'), cellRenderer: Reasons, flex: 1, minWidth: 280, sortable: false, autoHeight: true, wrapText: true },
  ]
}
