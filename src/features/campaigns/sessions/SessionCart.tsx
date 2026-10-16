import { useMemo } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { AgGridReact } from 'ag-grid-react'
import type { ColDef, ICellRendererParams } from 'ag-grid-community'
// Side-effect import: registers AG Grid Community modules within this chunk.
import '@/core/ag-grid-setup'
import { OMS_GRID_HEADER_HEIGHT, OMS_GRID_ROW_HEIGHT, omsGridTheme } from '@/core/theme/ag-grid-theme'
import { OMS_GRID_BASE_COL_DEF } from '@/core/theme/grid-base'
import { formatMoneyIn } from '@/core/money'
import type { RuleSession, RuleSessionLine } from '@/core/models/rule-campaign'
import { moneyText } from '@/core/rules/sentence'
import Ltr from '@/core/ui/Ltr'
import { formatNumber } from '@/core/util/number-format'
import { Both, EffectText } from './session-ui'

interface GridContext {
  currency: string
}

/** The line's SKU over its name: free text, so a `<bdi>`. */
function ItemCell({ data }: ICellRendererParams<RuleSessionLine>) {
  if (!data) return null
  return (
    <div className="flex flex-col py-1.5 leading-snug">
      <code className="font-mono text-[11px] text-muted-foreground">
        <Ltr>{data.sku}</Ltr>
      </code>
      <bdi className="whitespace-normal">{data.name}</bdi>
    </div>
  )
}

/** A line's effects, each with its campaign's code; labels in both languages. */
function EffectsCell({ data, context }: ICellRendererParams<RuleSessionLine, unknown, GridContext>) {
  const { t } = useTranslation('rule-sessions')
  if (!data) return null
  return (
    <div className="flex flex-col gap-1.5 py-1.5 leading-snug whitespace-normal" data-session-line-effects={data.line}>
      {data.effects.length === 0 && <span className="text-muted-foreground">{t('cart.noEffects')}</span>}
      {data.effects.map((e, i) => (
        <div key={i} className="flex flex-col gap-0.5" data-session-effect={e.kind} data-session-effect-code={e.campaignCode}>
          <span>
            <code className="me-1.5 font-mono font-semibold">
              <Ltr>{e.campaignCode}</Ltr>
            </code>
            <EffectText effect={e} currency={context.currency} />
          </span>
          {e.label && <Both says={e.label} />}
        </div>
      ))}
    </div>
  )
}

/** Each unit of the line and the discount allocated to it — what a return rolls back first. */
function UnitsCell({ data, context }: ICellRendererParams<RuleSessionLine, unknown, GridContext>) {
  const { t } = useTranslation('rule-sessions')
  if (!data) return null
  return (
    <ul className="flex flex-col gap-0.5 py-1.5 leading-snug whitespace-normal" data-session-units={data.line}>
      {data.units.map((u) => (
        <li key={u.unit} data-session-unit={u.unit} data-returned={u.returned}>
          <Trans
            t={t}
            i18nKey={u.campaignCode ? 'cart.unit' : 'cart.unitBare'}
            values={{ n: formatNumber(u.unit), code: u.campaignCode ?? '', amount: moneyText({ amount: u.discount, currency: context.currency }) }}
            components={{ v: <bdi dir="ltr" /> }}
          />
          {u.returned && <span className="ms-1.5 text-muted-foreground">{t('cart.returned')}</span>}
        </li>
      ))}
    </ul>
  )
}

const COL_DEF: ColDef<RuleSessionLine> = { ...OMS_GRID_BASE_COL_DEF, sortable: false, resizable: true, suppressHeaderMenuButton: true }

/** Cart items (ticket 518): each line with its effects and its unit allocation, as HQ answered them. */
export default function SessionCart({ session }: { session: RuleSession }) {
  const { t } = useTranslation('rule-sessions')
  const columns = useMemo<ColDef<RuleSessionLine>[]>(() => {
    const money: ColDef<RuleSessionLine>['valueFormatter'] = ({ value, context }) => formatMoneyIn(value as number, (context as GridContext).currency)
    return [
      { colId: 'line', field: 'line', headerName: t('cart.columns.line'), width: 55 },
      { colId: 'item', headerName: t('cart.columns.item'), cellRenderer: ItemCell, flex: 1, minWidth: 180, autoHeight: true },
      { colId: 'qty', field: 'qty', headerName: t('cart.columns.qty'), width: 65, type: 'rightAligned' },
      { colId: 'gross', field: 'gross', headerName: t('cart.columns.gross'), width: 100, type: 'rightAligned', valueFormatter: money },
      { colId: 'discount', field: 'discount', headerName: t('cart.columns.discount'), width: 100, type: 'rightAligned', valueFormatter: money },
      { colId: 'net', field: 'net', headerName: t('cart.columns.net'), width: 100, type: 'rightAligned', valueFormatter: money },
      { colId: 'effects', headerName: t('cart.columns.effects'), cellRenderer: EffectsCell, flex: 2, minWidth: 260, autoHeight: true },
      { colId: 'units', headerName: t('cart.columns.units'), cellRenderer: UnitsCell, flex: 1, minWidth: 220, autoHeight: true },
    ]
  }, [t])
  const context = useMemo(() => ({ currency: session.currency }), [session.currency])
  if (session.lines.length === 0) return <p className="text-sm text-muted-foreground">{t('cart.none')}</p>
  return (
    <div data-session-cart="">
      <AgGridReact<RuleSessionLine>
        theme={omsGridTheme}
        rowData={session.lines}
        columnDefs={columns}
        defaultColDef={COL_DEF}
        getRowId={({ data }) => String(data.line)}
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
