import { useMemo } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { AgGridReact } from 'ag-grid-react'
import type { ColDef, ICellRendererParams } from 'ag-grid-community'
// Side-effect import: registers AG Grid Community modules within this chunk.
import '@/core/ag-grid-setup'
import { OMS_GRID_HEADER_HEIGHT, OMS_GRID_ROW_HEIGHT, omsGridTheme } from '@/core/theme/ag-grid-theme'
import { OMS_GRID_BASE_COL_DEF } from '@/core/theme/grid-base'
import { formatMoneyIn } from '@/core/money'
import type { RuleSessionLookup } from '@/core/models/rule-session'
import { moneyText } from '@/core/rules/sentence'
import Ltr from '@/core/ui/Ltr'
import { formatNumber } from '@/core/util/number-format'
import SaysBoth from '@/core/rules/SaysBoth'
import { cartRows, type CartRow } from './session-read'

interface GridContext {
  currency: string
}

/** The line's article over its category: machine values, so `Ltr`. */
function ItemCell({ data }: ICellRendererParams<CartRow>) {
  const { t } = useTranslation('rule-sessions')
  if (!data) return null
  return (
    <div className="flex flex-col py-1.5 leading-snug">
      <code className="font-mono font-medium">
        <Ltr>{data.article}</Ltr>
      </code>
      {data.category && (
        <code className="font-mono text-[11px] text-muted-foreground">
          <Ltr>{data.category}</Ltr>
        </code>
      )}
      {data.fee && <span className="text-[11px] text-muted-foreground">{t('cart.fee')}</span>}
    </div>
  )
}

/** A line's effects, each with its campaign's id; labels in both languages. */
function EffectsCell({ data, context }: ICellRendererParams<CartRow, unknown, GridContext>) {
  const { t } = useTranslation('rule-sessions')
  if (!data) return null
  return (
    <div className="flex flex-col gap-1.5 py-1.5 leading-snug whitespace-normal" data-session-line-effects={data.line}>
      {data.effects.length === 0 && <span className="text-muted-foreground">{t('cart.noEffects')}</span>}
      {data.effects.map((e, i) => (
        <div key={i} className="flex flex-col gap-0.5" data-session-effect={e.effect} data-session-effect-code={e.campaign}>
          <span>
            <code className="me-1.5 font-mono font-semibold">
              <Ltr>{e.campaign}</Ltr>
            </code>
            <Trans
              t={t}
              i18nKey={e.freeUnits > 0 ? 'cart.effectFree' : 'cart.effect'}
              count={e.freeUnits}
              values={{ amount: moneyText({ amount: e.amount, currency: context.currency }), n: formatNumber(e.freeUnits) }}
              components={{ v: <bdi dir="ltr" /> }}
            />
          </span>
          {e.label && <SaysBoth says={e.label} />}
        </div>
      ))}
    </div>
  )
}

/** Past this many units, a line lists only the units something happened to. */
const UNITS_SHOWN = 12

/** Each unit of the line and the discount on it — what a return rolls back first. */
function UnitsCell({ data, context }: ICellRendererParams<CartRow, unknown, GridContext>) {
  const { t } = useTranslation('rule-sessions')
  if (!data) return null
  const many = data.units.length > UNITS_SHOWN
  const shown = many ? data.units.filter((u) => u.campaigns.length > 0 || u.returned) : data.units
  const untouched = data.units.length - shown.length
  return (
    <ul className="flex flex-col gap-0.5 py-1.5 leading-snug whitespace-normal" data-session-units={data.line}>
      {shown.map((u) => (
        <li key={u.unit} className="flex flex-wrap items-baseline gap-x-1.5" data-session-unit={u.unit} data-returned={u.returned}>
          <span>
            <Trans
              t={t}
              i18nKey={u.campaigns.length > 0 ? 'cart.unit' : 'cart.unitBare'}
              // The wire's unit index is 0-based; a person counts from 1.
              values={{ n: formatNumber(u.unit + 1), amount: moneyText({ amount: u.discount, currency: context.currency }) }}
              components={{ v: <bdi dir="ltr" /> }}
            />
          </span>
          {u.campaigns.map((c) => (
            <code key={c} className="font-mono font-semibold">
              <Ltr>{c}</Ltr>
            </code>
          ))}
          {u.returned && <span className="text-muted-foreground">{t('cart.returned')}</span>}
        </li>
      ))}
      {untouched > 0 && (
        <li className="text-muted-foreground" data-session-units-untouched={untouched}>
          <Trans t={t} i18nKey="cart.untouched" count={untouched} values={{ n: formatNumber(untouched) }} components={{ v: <bdi dir="ltr" /> }} />
        </li>
      )}
    </ul>
  )
}

const COL_DEF: ColDef<CartRow> = { ...OMS_GRID_BASE_COL_DEF, sortable: false, resizable: true, suppressHeaderMenuButton: true }

/** Cart items (tickets 518, 527): each cart line with its effects and its units, as HQ answered them. */
export default function SessionCart({ session }: { session: RuleSessionLookup }) {
  const { t } = useTranslation('rule-sessions')
  const rows = useMemo(() => cartRows(session), [session])
  const columns = useMemo<ColDef<CartRow>[]>(() => {
    const money: ColDef<CartRow>['valueFormatter'] = ({ value, context }) => formatMoneyIn(value as number, (context as GridContext).currency)
    return [
      { colId: 'line', field: 'line', headerName: t('cart.columns.line'), width: 55 },
      { colId: 'item', headerName: t('cart.columns.item'), cellRenderer: ItemCell, flex: 1, minWidth: 150, autoHeight: true },
      { colId: 'qty', field: 'quantity', headerName: t('cart.columns.qty'), width: 65, type: 'rightAligned' },
      { colId: 'net', field: 'netBeforePromotion', headerName: t('cart.columns.net'), width: 110, type: 'rightAligned', valueFormatter: money },
      { colId: 'discount', field: 'discount', headerName: t('cart.columns.discount'), width: 100, type: 'rightAligned', valueFormatter: money },
      { colId: 'netAfter', field: 'netAfter', headerName: t('cart.columns.netAfter'), width: 110, type: 'rightAligned', valueFormatter: money },
      { colId: 'effects', headerName: t('cart.columns.effects'), cellRenderer: EffectsCell, flex: 2, minWidth: 260, autoHeight: true },
      { colId: 'units', headerName: t('cart.columns.units'), cellRenderer: UnitsCell, flex: 1, minWidth: 220, autoHeight: true },
    ]
  }, [t])
  const context = useMemo(() => ({ currency: session.session.currency }), [session.session.currency])
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">{t('cart.none')}</p>
  return (
    <div data-session-cart="">
      <AgGridReact<CartRow>
        theme={omsGridTheme}
        rowData={rows}
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
