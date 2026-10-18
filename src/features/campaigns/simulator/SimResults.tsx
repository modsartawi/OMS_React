import { useMemo, useState, type ReactNode } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { AgGridReact } from 'ag-grid-react'
import type { ColDef, ICellRendererParams } from 'ag-grid-community'
// Side-effect import: registers AG Grid Community modules within this chunk.
import '@/core/ag-grid-setup'
import { OMS_GRID_HEADER_HEIGHT, OMS_GRID_ROW_HEIGHT, omsGridTheme } from '@/core/theme/ag-grid-theme'
import { OMS_GRID_BASE_COL_DEF } from '@/core/theme/grid-base'
import { formatMoneyIn } from '@/core/money'
import { RULE_TRACE_CODES, RULE_TRACE_STATUSES, type RuleNearMiss, type RuleSimulation, type RuleTraceEntry, type Says } from '@/core/models/rule-campaign'
import type { RulePointsEffect } from '@/core/models/rule-session'
import { moneyText } from '@/core/rules/sentence'
import SaysBoth from '@/core/rules/SaysBoth'
import Ltr from '@/core/ui/Ltr'
import StatusBadge from '@/core/ui/StatusBadge'
import type { Severity } from '@/core/ui/severity'
import { fsi } from '@/core/util/bidi'
import { formatNumber } from '@/core/util/number-format'
import { shapeSimulation, type LineEffect, type ShapedLine } from './sim-result'

const STATUS_SEV: Record<string, Severity> = { applied: 'ok', notTriggered: 'mute', skipped: 'mute', lost: 'warn' }

/** The unit effects HQ names, each read by its own key; any other reads as `effect.other`. */
const KNOWN_EFFECTS = new Set([
  'discountItems',
  'discountSession',
  'discountPerItem',
  'freeUnits',
  'freeProduct',
  'bundlePrice',
  'bundleDiscount',
  'discountCheapestInBundle',
])

type Tab = 'lines' | 'trace'

/**
 * HQ's dry-run answer (tickets 514, 525): what it ran on, the totals, the near misses with their
 * gaps, what lands on the whole sale (points, coupons it will create, messages, prompts, offers,
 * refusals), then the effects per line or the trace per campaign. Everything here is HQ's; the page
 * only groups and sums it (`shapeSimulation`).
 */
export default function SimResults({
  result,
  names,
  flags,
  onFlag,
}: {
  result: RuleSimulation
  /** The typed basket's item names by SKU (a file's lines have none). */
  names: ReadonlyMap<string, string>
  /** The offers' flags the customer says yes to. */
  flags: readonly string[]
  onFlag: (flag: string, yes: boolean) => void
}) {
  const { t } = useTranslation('rule-simulator')
  const [tab, setTab] = useState<Tab>('lines')
  const shaped = useMemo(() => shapeSimulation(result), [result])
  const { reply } = result
  const money = (amount: number) => moneyText({ amount, currency: reply.currency })
  const at = fsi(result.at.replace('T', ' ').slice(0, 16))
  const session: ReactNode[] = [
    ...(reply.points ?? []).map((p, i) => (
      <Row key={`p${i}`} code={p.campaign} data="points" sub={p.effect}>
        <PointsText p={p} />
      </Row>
    )),
    ...(reply.createdCoupons ?? []).map((c, i) => (
      <Row key={`c${i}`} code={c.campaign} data="createdCoupon" says={c.label}>
        <Trans t={t} i18nKey="coupon.created" values={{ template: c.template }} components={{ v: <bdi dir="ltr" /> }} />
      </Row>
    )),
    ...(reply.messages ?? []).map((m, i) => <Row key={`m${i}`} code={m.campaign} data="message" says={m.text} />),
    ...(reply.prompts ?? []).map((m, i) => <Row key={`q${i}`} code={m.campaign} data="prompt" says={m.text} />),
    ...(reply.offers ?? []).map((o, i) => (
      <Row key={`o${i}`} code={o.campaign} data="offer" says={o.text}>
        <label className="inline-flex items-center gap-1.5" title={t('result.offer.hint')}>
          <input type="checkbox" checked={flags.includes(o.flag)} onChange={(e) => onFlag(o.flag, e.target.checked)} data-sim-offer-yes={o.flag} />
          {t('result.offer.yes')}
        </label>
      </Row>
    )),
    ...(reply.refusals ?? []).map((r, i) => (
      <Row key={`r${i}`} code={r.campaign ?? ''} data="refusal" sub={r.code} says={r.reason}>
        {t('refusal.title')}
      </Row>
    )),
    ...shaped.stray.map((e, i) => (
      <Row key={`s${i}`} code={e.campaign} data="stray" sub={String(e.line)} says={e.label}>
        <span className="me-1.5 text-muted-foreground">{t('result.stray', { line: fsi(String(e.line)) })}</span>
        <EffectText effect={e} currency={reply.currency} />
      </Row>
    )),
  ]

  return (
    <div className="flex flex-col gap-3" data-sim-result="">
      <p className="text-xs text-muted-foreground" data-sim-based={result.basedOnVersion}>
        {result.basedOnVersion > 0 ? t('result.based', { version: fsi(String(result.basedOnVersion)), at }) : t('result.basedNothing', { at })}
        {result.campaign && <> {t('result.basedDraft', { campaign: fsi(result.campaign) })}</>}
      </p>
      <dl className="grid grid-cols-3 gap-3 rounded-lg border border-border bg-card p-4" data-sim-totals="">
        {(['net', 'discount', 'netAfter'] as const).map((k) => (
          <div key={k} className="flex flex-col gap-0.5" data-sim-total={k}>
            <dt className="text-xs text-muted-foreground">{t(`result.totals.${k}`)}</dt>
            <dd className={k === 'netAfter' ? 'text-lg font-semibold' : 'text-sm font-medium'}>
              <Ltr>{money(shaped.totals[k])}</Ltr>
            </dd>
          </div>
        ))}
      </dl>

      <NearMisses near={reply.nearMisses ?? []} />

      <section className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4" data-sim-session="">
        <h2 className="text-sm font-semibold">{t('result.session.title')}</h2>
        {session.length === 0 ? <p className="text-xs text-muted-foreground">{t('result.session.none')}</p> : <ul className="flex flex-col gap-2">{session}</ul>}
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
      {tab === 'lines' ? (
        <LinesGrid lines={shaped.lines} currency={reply.currency} names={names} />
      ) : (
        <Trace trace={reply.trace ?? []} counts={shaped.counts} currency={reply.currency} />
      )}
    </div>
  )
}

/** One thing on the whole sale: its campaign's code, what it is, and HQ's text in both languages. */
function Row({ code, data, sub, says, children }: { code: string; data: string; sub?: string; says?: Says | null; children?: ReactNode }) {
  return (
    <li className="flex flex-col gap-0.5 text-xs" data-sim-effect={data} data-sim-effect-code={code} data-sim-effect-sub={sub}>
      <span>
        {code && (
          <code className="me-1.5 font-mono font-semibold">
            <Ltr>{code}</Ltr>
          </code>
        )}
        {sub && data === 'refusal' && (
          <code className="me-1.5 font-mono text-muted-foreground">
            <Ltr>{sub}</Ltr>
          </code>
        )}
        {children}
      </span>
      {says && <SaysBoth says={says} />}
    </li>
  )
}

/** Points earned or taken: in points, or as money in the unit HQ counts them in (`SAR`). */
function PointsText({ p }: { p: RulePointsEffect }) {
  const { t } = useTranslation('rule-simulator')
  const figure = p.unit === 'PTS' ? t('points.pts', { count: p.amount, n: formatNumber(p.amount) }) : moneyText({ amount: p.amount, currency: p.unit })
  const key = p.effect === 'awardPoints' ? 'points.awardPoints' : p.effect === 'burnPoints' ? (p.tender ? 'points.burnTender' : 'points.burnPoints') : 'points.other'
  // The figure is a phrase ("7 points") in the points case: isolated, its direction its own (`<w>`).
  return <Trans t={t} i18nKey={key} values={{ figure, effect: p.effect }} components={{ v: <bdi dir="ltr" />, w: <bdi /> }} />
}

/**
 * What a campaign's effect did to a line, its figures isolated through `<Trans>` slots (`<v>`): this
 * text is also drawn inside a grid cell, where `fsi` may not go.
 */
function EffectText({ effect: e, currency }: { effect: LineEffect; currency: string }) {
  const { t } = useTranslation('rule-simulator')
  const free = e.effect === 'freeUnits' || e.effect === 'freeProduct'
  const key = KNOWN_EFFECTS.has(e.effect) ? `effect.${e.effect}` : 'effect.other'
  const amount = moneyText({ amount: e.amount, currency })
  return (
    <>
      <Trans
        t={t}
        i18nKey={key}
        values={{ amount, n: formatNumber(e.freeUnits), effect: e.effect }}
        count={free ? e.freeUnits : undefined}
        components={{ v: <bdi dir="ltr" /> }}
      />{' '}
      <span className="text-muted-foreground">
        <Trans t={t} i18nKey="effect.units" values={{ n: formatNumber(e.units) }} count={e.units} components={{ v: <bdi dir="ltr" /> }} />
      </span>
    </>
  )
}

/** One line's effect: its campaign's code, what it did, and its receipt label in both languages. */
function LineEffectItem({ effect: e, currency }: { effect: LineEffect; currency: string }) {
  return (
    <div className="flex flex-col gap-0.5 text-xs" data-sim-effect={e.effect} data-sim-effect-code={e.campaign}>
      <span>
        <code className="me-1.5 font-mono font-semibold">
          <Ltr>{e.campaign}</Ltr>
        </code>
        <EffectText effect={e} currency={currency} />
      </span>
      {e.label && <SaysBoth says={e.label} />}
    </div>
  )
}

function NearMisses({ near }: { near: RuleNearMiss[] }) {
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
          {near.map((n, i) => (
            <li key={`${n.campaign}|${n.rule}|${i}`} className="flex flex-col gap-1 text-xs" data-sim-near-miss={n.campaign} data-sim-near-rule={n.rule}>
              <span className="flex flex-wrap items-start gap-1.5">
                <code className="font-mono font-semibold">
                  <Ltr>{n.campaign}</Ltr>
                </code>
                {n.text && <SaysBoth says={n.text} />}
              </span>
              <ul className="flex flex-col gap-1 ps-3">
                {(n.gaps ?? []).map((g, j) => (
                  <li key={j} className="flex flex-col gap-0.5 border-s border-border ps-2" data-sim-gap={g.check} data-sim-gap-path={g.path}>
                    {g.text && <SaysBoth says={g.text} />}
                    {g.says && (
                      <span className="flex flex-wrap gap-1 text-muted-foreground" data-sim-gap-says="">
                        <span>{t('result.near.says')}</span>
                        <SaysBoth says={g.says} />
                      </span>
                    )}
                    <code className="font-mono text-[11px] text-muted-foreground">
                      <Ltr>{g.path}</Ltr>
                    </code>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

interface GridContext {
  currency: string
  names: ReadonlyMap<string, string>
}

/** A line's effects, each with its campaign's code; labels in both languages. */
function EffectsCell({ data, context }: ICellRendererParams<ShapedLine, unknown, GridContext>) {
  if (!data) return null
  return (
    <div className="flex flex-col gap-1.5 py-1.5 leading-snug whitespace-normal" data-sim-line-effects={data.lineNumber}>
      {data.grouped.map((e, i) => (
        <LineEffectItem key={i} effect={e} currency={context.currency} />
      ))}
    </div>
  )
}

/** The line's article over the name the typed basket gave it: free text, so a `<bdi>`. */
function ItemCell({ data, context }: ICellRendererParams<ShapedLine, unknown, GridContext>) {
  if (!data) return null
  const name = context.names.get(data.article)
  return (
    <div className="flex flex-col py-1.5 leading-snug">
      <code className="font-mono text-[11px] text-muted-foreground">
        <Ltr>{data.article}</Ltr>
      </code>
      {name && <bdi className="whitespace-normal">{name}</bdi>}
    </div>
  )
}

const LINE_COL_DEF: ColDef<ShapedLine> = { ...OMS_GRID_BASE_COL_DEF, sortable: false, resizable: true }

function LinesGrid({ lines, currency, names }: { lines: ShapedLine[]; currency: string; names: ReadonlyMap<string, string> }) {
  const { t } = useTranslation('rule-simulator')
  const columns = useMemo<ColDef<ShapedLine>[]>(() => {
    const money: ColDef<ShapedLine>['valueFormatter'] = ({ value, context }) => formatMoneyIn(value as number, (context as GridContext).currency)
    return [
      { colId: 'line', field: 'lineNumber', headerName: t('result.columns.line'), width: 50 },
      { colId: 'item', headerName: t('result.columns.name'), cellRenderer: ItemCell, flex: 1, minWidth: 160, autoHeight: true },
      { colId: 'qty', field: 'quantity', headerName: t('result.columns.qty'), width: 60, type: 'rightAligned' },
      { colId: 'net', field: 'net', headerName: t('result.columns.net'), width: 90, type: 'rightAligned', valueFormatter: money },
      { colId: 'discount', field: 'discount', headerName: t('result.columns.discount'), width: 90, type: 'rightAligned', valueFormatter: money },
      { colId: 'netAfter', field: 'netAfter', headerName: t('result.columns.netAfter'), width: 90, type: 'rightAligned', valueFormatter: money },
      { colId: 'effects', headerName: t('result.columns.effects'), cellRenderer: EffectsCell, flex: 2, minWidth: 260, autoHeight: true },
    ]
  }, [t])
  const context = useMemo(() => ({ currency, names }), [currency, names])
  return (
    <div data-sim-lines="">
      <AgGridReact<ShapedLine>
        theme={omsGridTheme}
        rowData={lines}
        columnDefs={columns}
        defaultColDef={LINE_COL_DEF}
        getRowId={({ data }) => String(data.lineNumber)}
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

const KNOWN_CODES: ReadonlySet<string> = new Set(RULE_TRACE_CODES)

/** Every campaign, in HQ's evaluation order: how it came out, why, its group, and HQ's reason. */
function Trace({ trace, counts, currency }: { trace: RuleTraceEntry[]; counts: Record<string, number>; currency: string }) {
  const { t } = useTranslation('rule-simulator')
  if (trace.length === 0) return <p className="text-xs text-muted-foreground">{t('trace.none')}</p>
  const summary = Object.fromEntries(RULE_TRACE_STATUSES.map((s) => [s, fsi(formatNumber(counts[s] ?? 0))]))
  return (
    <div className="flex flex-col gap-2" data-sim-trace="">
      <p className="text-xs text-muted-foreground" data-sim-trace-summary="">
        {t('trace.summary', summary)}
      </p>
      <ol className="flex flex-col gap-2">
        {trace.map((c, i) => (
          <li key={`${c.campaign}|${i}`} className="rounded-md border border-border bg-card p-3 text-xs" data-sim-trace-campaign={c.campaign} data-sim-status={c.status} data-sim-code={c.code ?? ''}>
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge sev={STATUS_SEV[c.status] ?? 'mute'}>{RULE_TRACE_STATUSES.includes(c.status as never) ? t(`trace.status.${c.status}`) : <Ltr>{c.status}</Ltr>}</StatusBadge>
              <code className="font-mono font-semibold">
                <Ltr>{c.campaign}</Ltr>
              </code>
              {c.code && (
                <span className="text-muted-foreground" data-sim-trace-code="">
                  {KNOWN_CODES.has(c.code) ? t(`trace.code.${c.code}`) : <Ltr>{c.code}</Ltr>}
                </span>
              )}
              {c.status === 'applied' && c.money > 0 && (
                <span className="ms-auto font-medium" data-sim-trace-money="">
                  {t('trace.gave', { money: fsi(moneyText({ amount: c.money, currency })) })}
                </span>
              )}
            </div>
            <p className="mt-1.5 text-muted-foreground" data-sim-trace-group="">
              {c.group ? t('trace.group', { group: fsi(c.group) }) : t('trace.base')}
            </p>
            {c.reason && (
              <div className="mt-1" data-sim-trace-reason="">
                <SaysBoth says={c.reason} />
              </div>
            )}
          </li>
        ))}
      </ol>
    </div>
  )
}
