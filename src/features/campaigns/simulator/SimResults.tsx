import { useMemo, useState } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { AgGridReact } from 'ag-grid-react'
import type { ColDef, ICellRendererParams } from 'ag-grid-community'
import { Check, X } from 'lucide-react'
// Side-effect import: registers AG Grid Community modules within this chunk.
import '@/core/ag-grid-setup'
import { OMS_GRID_HEADER_HEIGHT, OMS_GRID_ROW_HEIGHT, omsGridTheme } from '@/core/theme/ag-grid-theme'
import { OMS_GRID_BASE_COL_DEF } from '@/core/theme/grid-base'
import { formatMoneyIn } from '@/core/money'
import type { RuleSimEffect, RuleSimNearMiss, RuleSimOutcome, RuleSimResult, RuleSimTrace, Says } from '@/core/models/rule-campaign'
import { moneyText } from '@/core/rules/sentence'
import Ltr from '@/core/ui/Ltr'
import StatusBadge from '@/core/ui/StatusBadge'
import type { Severity } from '@/core/ui/severity'
import { fsi } from '@/core/util/bidi'
import { formatNumber } from '@/core/util/number-format'
import { SIM_OUTCOMES, shapeSimResult, type ShapedLine } from './sim-result'

const OUTCOME_SEV: Record<RuleSimOutcome, Severity> = { applied: 'ok', notMet: 'mute', skipped: 'mute', budget: 'warn', lost: 'warn' }

type Tab = 'lines' | 'trace'

/**
 * HQ's dry-run answer (ticket 514): the totals, the near misses with their gap, the effects on the
 * whole sale, then the effects per line or the trace per campaign. Everything here is HQ's; the
 * page only groups it (`shapeSimResult`).
 */
export default function SimResults({ result }: { result: RuleSimResult }) {
  const { t } = useTranslation('rule-simulator')
  const [tab, setTab] = useState<Tab>('lines')
  const shaped = useMemo(() => shapeSimResult(result), [result])
  const money = (amount: number) => moneyText({ amount, currency: result.currency })

  return (
    <div className="flex flex-col gap-3" data-sim-result="">
      {result.engine === 'BonusBuy' && (
        <p className="rounded-md border border-attention-border bg-attention-050 px-3 py-2 text-xs text-attention-800" data-sim-bonus-buy="">
          {t('result.bonusBuy')}
        </p>
      )}
      <dl className="grid grid-cols-3 gap-3 rounded-lg border border-border bg-card p-4" data-sim-totals="">
        {(['gross', 'discount', 'net'] as const).map((k) => (
          <div key={k} className="flex flex-col gap-0.5" data-sim-total={k}>
            <dt className="text-xs text-muted-foreground">{t(`result.totals.${k}`)}</dt>
            <dd className={k === 'net' ? 'text-lg font-semibold' : 'text-sm font-medium'}>
              <Ltr>{money(result.totals[k])}</Ltr>
            </dd>
          </div>
        ))}
      </dl>

      <NearMisses near={result.nearMisses ?? []} money={money} />

      <section className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4" data-sim-session="">
        <h2 className="text-sm font-semibold">{t('result.session.title')}</h2>
        {shaped.session.length === 0 ? (
          <p className="text-xs text-muted-foreground">{t('result.session.none')}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {shaped.session.map((e, i) => (
              <li key={i}>
                <Effect effect={e} currency={result.currency} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <div role="tablist" aria-label={t('result.tabs.label')} className="flex gap-1 border-b border-border">
        {(['lines', 'trace'] as const).map((k) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={tab === k}
            className={`-mb-px border-b-2 px-3 py-1.5 text-xs font-medium ${tab === k ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
            onClick={() => setTab(k)}
            data-sim-tab={k}
          >
            {t(`result.tabs.${k}`)}
          </button>
        ))}
      </div>
      {tab === 'lines' ? <LinesGrid lines={shaped.lines} currency={result.currency} /> : <Trace trace={result.trace ?? []} outcomes={shaped.outcomes} />}
    </div>
  )
}

/** A text in both languages, both shown: the English, then the Arabic right to left. */
function Both({ says }: { says: Says }) {
  return (
    <span className="flex flex-col" data-says="">
      <bdi lang="en" data-says-en="">
        {says.en}
      </bdi>
      <bdi dir="rtl" lang="ar" data-says-ar="">
        {says.ar}
      </bdi>
    </span>
  )
}

/** One effect: its campaign's code, what it does, and its label or message in both languages. */
function Effect({ effect: e, currency }: { effect: RuleSimEffect; currency: string }) {
  return (
    <div className="flex flex-col gap-0.5 text-xs" data-sim-effect={e.kind} data-sim-effect-code={e.code}>
      <span>
        <code className="me-1.5 font-mono font-semibold">
          <Ltr>{e.code}</Ltr>
        </code>
        <EffectText effect={e} currency={currency} />
      </span>
      {e.label && <Both says={e.label} />}
    </div>
  )
}

/**
 * What an effect does, its figures isolated through `<Trans>` slots (`<v>`): this text is also
 * drawn inside a grid cell, where `fsi` may not go. An absent figure reads as a dash, never as 0.
 */
function EffectText({ effect: e, currency }: { effect: RuleSimEffect; currency: string }) {
  const { t } = useTranslation('rule-simulator')
  const money = (n: number | null) => (n === null ? '—' : moneyText({ amount: n, currency }))
  const values: Record<string, string | number> =
    e.kind === 'freeUnit'
      ? { count: e.quantity ?? 1, n: formatNumber(e.quantity ?? 1), amount: money(e.amount) }
      : e.kind === 'points'
        ? { points: e.points === null ? '—' : formatNumber(e.points) }
        : e.kind === 'createCoupon'
          ? { coupon: e.coupon ?? e.code }
          : { amount: money(e.amount) }
  return <Trans t={t} i18nKey={`effect.${e.kind}`} values={values} count={e.kind === 'freeUnit' ? (e.quantity ?? 1) : undefined} components={{ v: <bdi dir="ltr" /> }} />
}

function NearMisses({ near, money }: { near: RuleSimNearMiss[]; money: (n: number) => string }) {
  const { t } = useTranslation('rule-simulator')
  return (
    <section className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4" data-sim-near="">
      <div>
        <h2 className="text-sm font-semibold">{t('result.near.title')}</h2>
        <p className="text-xs text-muted-foreground">{t('result.near.hint')}</p>
      </div>
      {near.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t('result.near.none')}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {near.map((n) => (
            <li key={n.campaignId} className="flex flex-col gap-0.5 text-xs" data-sim-near-miss={n.code}>
              <span>
                <code className="me-1.5 font-mono font-semibold">
                  <Ltr>{n.code}</Ltr>
                </code>
                <span data-sim-gap="">
                  {n.gap.kind === 'money'
                    ? t('result.near.money', { gap: fsi(money(n.gap.amount)), offer: fsi(n.offer.en) })
                    : t('result.near.items', { count: n.gap.count, n: fsi(formatNumber(n.gap.count)), of: fsi(n.gap.of), offer: fsi(n.offer.en) })}
                </span>
              </span>
              <bdi dir="rtl" lang="ar" className="text-muted-foreground" data-says-ar="">
                {n.offer.ar}
              </bdi>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

interface GridContext {
  currency: string
}

/** A line's effects, each with its campaign's code; labels in both languages. */
function EffectsCell({ data, context }: ICellRendererParams<ShapedLine, unknown, GridContext>) {
  if (!data) return null
  return (
    <div className="flex flex-col gap-1.5 py-1.5 leading-snug whitespace-normal" data-sim-line-effects={data.line}>
      {data.effects.map((e, i) => (
        <Effect key={i} effect={e} currency={context.currency} />
      ))}
    </div>
  )
}

/** The line's SKU over its name: free text, so a `<bdi>`. */
function ItemCell({ data }: ICellRendererParams<ShapedLine>) {
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

const LINE_COL_DEF: ColDef<ShapedLine> = { ...OMS_GRID_BASE_COL_DEF, sortable: false, resizable: true }

function LinesGrid({ lines, currency }: { lines: ShapedLine[]; currency: string }) {
  const { t } = useTranslation('rule-simulator')
  const columns = useMemo<ColDef<ShapedLine>[]>(() => {
    const money: ColDef<ShapedLine>['valueFormatter'] = ({ value, context }) => formatMoneyIn(value as number, (context as GridContext).currency)
    return [
      { colId: 'line', field: 'line', headerName: t('result.columns.line'), width: 50 },
      { colId: 'item', headerName: t('result.columns.name'), cellRenderer: ItemCell, flex: 1, minWidth: 160, autoHeight: true },
      { colId: 'qty', field: 'qty', headerName: t('result.columns.qty'), width: 60, type: 'rightAligned' },
      { colId: 'gross', field: 'gross', headerName: t('result.columns.gross'), width: 90, type: 'rightAligned', valueFormatter: money },
      { colId: 'discount', field: 'discount', headerName: t('result.columns.discount'), width: 90, type: 'rightAligned', valueFormatter: money },
      { colId: 'net', field: 'net', headerName: t('result.columns.net'), width: 90, type: 'rightAligned', valueFormatter: money },
      { colId: 'effects', headerName: t('result.columns.effects'), cellRenderer: EffectsCell, flex: 2, minWidth: 260, autoHeight: true },
    ]
  }, [t])
  const context = useMemo(() => ({ currency }), [currency])
  return (
    <div data-sim-lines="">
      <AgGridReact<ShapedLine>
        theme={omsGridTheme}
        rowData={lines}
        columnDefs={columns}
        defaultColDef={LINE_COL_DEF}
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

function Trace({ trace, outcomes }: { trace: RuleSimTrace[]; outcomes: Record<RuleSimOutcome, number> }) {
  const { t } = useTranslation('rule-simulator')
  if (trace.length === 0) return <p className="text-xs text-muted-foreground">{t('trace.none')}</p>
  const counts = Object.fromEntries(SIM_OUTCOMES.map((o) => [o, fsi(formatNumber(outcomes[o]))]))
  return (
    <div className="flex flex-col gap-2" data-sim-trace="">
      <p className="text-xs text-muted-foreground" data-sim-trace-summary="">
        {t('trace.summary', counts)}
      </p>
      <ul className="flex flex-col gap-2">
        {trace.map((c) => (
          <li key={c.campaignId} className="rounded-md border border-border bg-card p-3 text-xs" data-sim-trace-campaign={c.code} data-sim-outcome={c.outcome}>
            <div className="flex flex-wrap items-start gap-2">
              <StatusBadge sev={OUTCOME_SEV[c.outcome]}>{t(`trace.outcome.${c.outcome}`)}</StatusBadge>
              <code className="font-mono font-semibold">
                <Ltr>{c.code}</Ltr>
              </code>
              <Both says={c.name} />
            </div>
            <p className="mt-1.5 text-muted-foreground" data-sim-trace-group="">
              {c.group
                ? t(c.outcome === 'lost' && c.lostTo ? 'trace.groupLost' : c.outcome === 'applied' && c.group.mode !== 'stackable' ? 'trace.groupWon' : 'trace.group', {
                    group: fsi(c.group.name),
                    mode: t(`trace.modes.${c.group.mode}`),
                    code: fsi(c.lostTo ?? ''),
                  })
                : t('trace.base')}
            </p>
            {c.reason && (
              <p className="mt-1" data-sim-trace-reason="">
                <bdi>{c.reason}</bdi>
              </p>
            )}
            {c.rules.length > 0 && (
              <ul className="mt-2 flex flex-col gap-1.5">
                {c.rules.map((r) => (
                  <li key={r.ruleId} className="rounded border border-border/60 bg-card-2 px-2 py-1.5" data-sim-trace-rule={r.ruleId} data-ran={r.ran}>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">
                        {t('trace.rule')} <bdi>{r.name}</bdi>
                      </span>
                      {!r.ran && <span className="text-muted-foreground">{t('trace.notReached')}</span>}
                    </div>
                    {r.ran &&
                      (r.conditions.length === 0 ? (
                        <p className="mt-1 text-muted-foreground">{t('trace.noConditions')}</p>
                      ) : (
                        <ul className="mt-1 flex flex-col gap-1">
                          {r.conditions.map((k) => (
                            <li key={k.conditionId} className="flex items-start gap-1.5" data-sim-condition={k.conditionId} data-met={k.met}>
                              {k.met ? (
                                <Check className="mt-0.5 size-3.5 shrink-0 text-success-800" aria-label={t('trace.met')} />
                              ) : (
                                <X className="mt-0.5 size-3.5 shrink-0 text-danger-800" aria-label={t('trace.notMetCondition')} />
                              )}
                              <Both says={k.says} />
                            </li>
                          ))}
                        </ul>
                      ))}
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
