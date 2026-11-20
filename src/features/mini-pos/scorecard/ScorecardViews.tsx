import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, CheckCircle2, OctagonX, PauseCircle } from 'lucide-react'
import type {
  MiniPosScorecard,
  MiniPosScorecardInputs,
  MiniPosScorecardMoney,
  MiniPosScorecardSupporting,
  MiniPosWeeklyPaidShare,
} from '@/core/models/mini-pos-scorecard'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Ltr from '@/core/ui/Ltr'
import StatusBadge from '@/core/ui/StatusBadge'
import { SEVERITY_BADGE } from '@/core/ui/severity'
import { TD, TH } from '@/core/ui/sheet-table'
import { formatCount, formatRange, fsi } from '@/core/util/bidi'
import {
  BAND_SEVERITY,
  GO_BAR,
  MEDIAN_READ_TRIGGER_MS,
  NO_GO_BAR,
  TYPED_SHARE_TRIGGER,
  count,
  day,
  duration,
  figure,
  meterGeometry,
  money,
  offListByWeek,
  percent,
  points,
  ratioCost,
  ratioBand,
  settlingInWeek,
  times,
  verdictKey,
  weekCellSeverity,
  weeklyGrid,
  type RatioBand,
  type ScorecardFailure,
} from './scorecard'

/**
 * The Mini POS scorecard's drawn parts (oms 930, BackOffice 4075): the money test, the settling-in week, the supporting
 * measures and the weekly view. Props in, markup out, so the component tests render them as static markup; the page owns
 * the call. Every figure is the server's, drawn as sent (a machine value, `Ltr`); nothing is re-derived here.
 */

const NS = 'mini-pos-scorecard'

/** A figure the server could not compute (`null`) reads as "not computable", never as zero. */
function Fig({ children, na }: { children: string; na: string }) {
  return children === '' ? <span className="text-muted-foreground">{na}</span> : <Ltr>{children}</Ltr>
}

function Section({ title, children, id }: { title: string; children: ReactNode; id: string }) {
  return (
    <section className="flex flex-col gap-2" data-minipos-scorecard-section={id}>
      <h2 className="text-base font-semibold">{title}</h2>
      {children}
    </section>
  )
}

function Table({ head, children }: { head: ReactNode; children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border/60">
      <table className="w-full text-[0.8125rem]">
        <thead className="text-xs text-muted-foreground">
          <tr>{head}</tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  )
}

const NUM = `${TD} text-end tabular-nums`
const NUM_H = `${TH} text-end`

/** The two standing notes: what the money is, and which cost it is net of. */
export function ScorecardNotes() {
  const { t } = useTranslation(NS)
  return (
    <ul className="list-disc ps-5 text-xs text-muted-foreground" data-minipos-scorecard-notes="">
      <li>{t('notes.money')}</li>
      <li>{t('notes.cost')}</li>
    </ul>
  )
}

/** The windows the answer counted: the trial, its settling-in week (excluded), the counted days and last year's. */
export function TrialWindow({ inputs }: { inputs: MiniPosScorecardInputs }) {
  const { t } = useTranslation(NS)
  const settling = settlingInWeek(inputs)
  const range = (a: string, b: string) => fsi(formatRange(day(a), day(b)))
  return (
    <div className="flex flex-col gap-1.5 rounded-lg border border-border/60 bg-card/40 p-3 text-sm" data-minipos-trial-window="">
      <p>{t('window.trial', { range: range(inputs.trialFrom, inputs.trialTo) })}</p>
      {settling ? (
        <p className="flex flex-wrap items-center gap-2" data-minipos-settling-in="excluded">
          <span className="text-muted-foreground line-through decoration-muted-foreground/60">
            {t('window.settlingIn', { range: range(settling.from, settling.to) })}
          </span>
          <StatusBadge sev="mute">{t('window.excluded')}</StatusBadge>
        </p>
      ) : (
        <p className="text-muted-foreground" data-minipos-settling-in="none">
          {t('window.noSettlingIn')}
        </p>
      )}
      <p data-minipos-counted={`${day(inputs.upliftFrom)}..${day(inputs.upliftTo)}`}>
        {t('window.counted', { range: range(inputs.upliftFrom, inputs.upliftTo) })}
      </p>
      <p className="text-muted-foreground">
        {t('window.lastYear', { range: range(inputs.lastYearFrom, inputs.lastYearTo), days: fsi(count(inputs.comparisonOffsetDays)) })}
      </p>
      {inputs.nonPharmacyCategories?.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {t('window.categories', { list: fsi(inputs.nonPharmacyCategories.join(', ')) })}
        </p>
      )}
    </div>
  )
}

const BAND_FILL: Record<RatioBand, string> = { go: 'bg-success', panel: 'bg-attention', 'no-go': 'bg-danger', none: 'bg-muted' }

/**
 * The payback ratio against the trial's two bars (3710 M10): coloured go at 1.2× and above, the panel's call from 1.0×
 * up to it, no-go below 1.0×. The words carry the band too, so the colour is never the only signal. The verdict is the
 * server's.
 */
export function PaybackRatio({ ratio, verdict }: { ratio: number | null; verdict: string }) {
  const { t } = useTranslation(NS)
  const band = ratioBand(ratio)
  const geo = meterGeometry(ratio)
  const sev = BAND_SEVERITY[band]
  const vKey = verdictKey(verdict)
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border/60 p-3" data-minipos-ratio-band={band} data-minipos-verdict={vKey}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-sm text-muted-foreground">{t('money.ratio')}</span>
        <span className={`rounded-md px-2 py-0.5 text-2xl font-semibold tabular-nums ${SEVERITY_BADGE[sev]}`} data-minipos-ratio="">
          <Fig na={t('na')}>{times(ratio)}</Fig>
        </span>
      </div>
      {band !== 'none' && (
        <div className="relative h-3 rounded-full bg-muted" role="img" aria-label={t(`band.${band}`, { ratio: fsi(times(ratio)) })}>
          <div className={`absolute inset-y-0 start-0 rounded-full ${BAND_FILL[band]}`} style={{ width: `${geo.fill}%` }} />
          <div className="absolute -inset-y-1 w-0.5 bg-foreground" style={{ insetInlineStart: `${geo.noGo}%` }} data-minipos-bar="1.0" />
          <div className="absolute -inset-y-1 w-0.5 bg-foreground" style={{ insetInlineStart: `${geo.go}%` }} data-minipos-bar="1.2" />
        </div>
      )}
      <p className="text-xs text-muted-foreground">{t('money.bars', { go: fsi(times(GO_BAR)), noGo: fsi(times(NO_GO_BAR)) })}</p>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <StatusBadge sev={vKey === 'go' ? 'ok' : vKey === 'panel' ? 'warn' : vKey === 'no-go' ? 'bad' : 'mute'}>{t(`verdict.${vKey}`)}</StatusBadge>
        <span className="text-muted-foreground">{t(`verdictHint.${vKey}`)}</span>
      </div>
    </div>
  )
}

/** The money test: trial and control side by side, the uplift, the gross margin on it, and the payback ratio. */
export function MoneyTest({ money: m, inputs }: { money: MiniPosScorecardMoney; inputs: MiniPosScorecardInputs }) {
  const { t } = useTranslation(NS)
  const na = t('na')
  const sides = [
    { id: 'trial', sales: m.trialSales, lastYear: m.trialLastYearSales, growth: m.trialGrowth },
    { id: 'control', sales: m.controlSales, lastYear: m.controlLastYearSales, growth: m.controlGrowth },
  ] as const
  const cost = ratioCost(inputs)
  const rows: { key: string; value: string; empty?: string; note?: string }[] = [
    { key: 'upliftSales', value: money(m.upliftSales) },
    { key: 'marginRate', value: percent(m.trialMarginRate) },
    { key: 'grossMargin', value: money(m.grossMarginOnUplift) },
    {
      key: 'countedCost',
      value: cost.entered ? money(cost.counted) : '',
      empty: cost.entered ? t('money.countedCostNotSent') : t('money.noCost'),
      note: cost.days ? t('money.countedDays', { days: fsi(cost.days) }) : undefined,
    },
    { key: 'fullCost', value: cost.entered ? money(cost.full) : '', empty: t('money.noCost') },
  ]
  return (
    <Section id="money" title={t('money.title')}>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <div className="flex flex-col gap-3">
          <Table
            head={
              <>
                <th className={TH} />
                {sides.map((s) => (
                  <th key={s.id} className={NUM_H}>
                    {t(`money.${s.id}`)}
                  </th>
                ))}
              </>
            }
          >
            {(['sales', 'lastYear', 'growth'] as const).map((k) => (
              <tr key={k} className="border-t border-border/40">
                <th scope="row" className={`${TH} text-muted-foreground`}>
                  {t(`money.${k}`)}
                </th>
                {sides.map((s) => (
                  <td key={s.id} className={NUM} data-minipos-side={`${s.id}.${k}`}>
                    <Fig na={na}>{k === 'growth' ? percent(s.growth) : money(s[k])}</Fig>
                  </td>
                ))}
              </tr>
            ))}
          </Table>
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-lg border border-border/60 p-3" data-minipos-uplift="">
            <span className="text-sm text-muted-foreground">{t('money.uplift')}</span>
            <span className="text-xl font-semibold tabular-nums">
              <Fig na={na}>{points(m.uplift)}</Fig>
            </span>
            {m.uplift !== null && <span className="text-sm text-muted-foreground">{t('money.pts')}</span>}
            <span className="basis-full text-xs text-muted-foreground">{t('money.upliftHint')}</span>
          </div>
          <Table head={<th className={TH} colSpan={2} />}>
            {rows.map((r) => (
              <tr key={r.key} className="border-t border-border/40" data-minipos-money={r.key}>
                <th scope="row" className={`${TH} text-muted-foreground`}>
                  {t(`money.${r.key}`)}
                  {r.note && <div className="text-[11px] font-normal">{r.note}</div>}
                </th>
                <td className={NUM}>
                  <Fig na={r.empty ?? na}>{r.value}</Fig>
                </td>
              </tr>
            ))}
          </Table>
        </div>
        <PaybackRatio ratio={m.paybackRatio} verdict={m.verdict} />
      </div>
      <PharmaciesTable pharmacies={m.pharmacies} />
    </Section>
  )
}

/** Every trial and control pharmacy's own figures, trial first. */
export function PharmaciesTable({ pharmacies }: { pharmacies: MiniPosScorecardMoney['pharmacies'] }) {
  const { t } = useTranslation(NS)
  const na = t('na')
  const roleKey = (r: string) => (r === 'Trial' ? 'trial' : r === 'Control' ? 'control' : 'other')
  const shown = [...pharmacies].sort((a, b) => roleKey(b.trialRole).localeCompare(roleKey(a.trialRole)) || a.storeCode.localeCompare(b.storeCode))
  if (shown.length === 0) return <p className="text-sm text-muted-foreground">{t('pharmacies.empty')}</p>
  return (
    <Table
      head={
        <>
          <th className={TH}>{t('pharmacies.store')}</th>
          <th className={TH}>{t('pharmacies.role')}</th>
          <th className={NUM_H}>{t('money.sales')}</th>
          <th className={NUM_H}>{t('pharmacies.cost')}</th>
          <th className={NUM_H}>{t('money.lastYear')}</th>
          <th className={NUM_H}>{t('money.growth')}</th>
        </>
      }
    >
      {shown.map((p) => (
        <tr key={p.storeCode} className="border-t border-border/40" data-minipos-pharmacy={p.storeCode}>
          <td className={`${TD} font-mono`}>
            <Ltr>{p.storeCode}</Ltr>
          </td>
          <td className={TD}>{t(`pharmacies.roles.${roleKey(p.trialRole)}`)}</td>
          <td className={NUM}>
            <Fig na={na}>{money(p.sales)}</Fig>
          </td>
          <td className={NUM}>
            <Fig na={na}>{money(p.cost)}</Fig>
          </td>
          <td className={NUM}>
            <Fig na={na}>{money(p.lastYearSales)}</Fig>
          </td>
          <td className={NUM}>
            <Fig na={na}>{percent(p.growth)}</Fig>
          </td>
        </tr>
      ))}
    </Table>
  )
}

const KNOWN_REASONS = ['category', 'list', 'serialised']
const KNOWN_STAGES = ['scan', 'submit']
const KNOWN_MODES = ['camera', 'typed', 'wedge', 'unknown']

/** A data word from a known set in words, anything else as sent (a machine value). */
function Word({ value, known, prefix }: { value: string; known: readonly string[]; prefix: string }) {
  const { t } = useTranslation(NS)
  return known.includes(value) ? <>{t(`${prefix}.${value}`)}</> : <Ltr>{value}</Ltr>
}

function Card({ title, children, id }: { title: string; children: ReactNode; id: string }) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border/60 p-3" data-minipos-measure={id}>
      <h3 className="text-sm font-semibold">{title}</h3>
      {children}
    </div>
  )
}

function Pairs({ rows }: { rows: { id?: string; label: ReactNode; value: ReactNode; flag?: ReactNode }[] }) {
  return (
    <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 text-sm">
      {rows.map((r) => (
        <div key={r.id ?? String(r.label)} className="contents">
          <dt className="text-muted-foreground">{r.label}</dt>
          <dd className="text-end tabular-nums">
            {r.value}
            {r.flag}
          </dd>
        </div>
      ))}
    </dl>
  )
}

/** 3710 M11's supporting measures, for the panel's call between the bars. */
export function SupportingMeasures({ supporting: s }: { supporting: MiniPosScorecardSupporting }) {
  const { t } = useTranslation(NS)
  const na = t('na')
  const f = (v: string) => <Fig na={na}>{v}</Fig>
  const typedOver = typeof s.entryModes.typedShare === 'number' && s.entryModes.typedShare > TYPED_SHARE_TRIGGER
  const readOver = typeof s.entryModes.medianMsToRead === 'number' && s.entryModes.medianMsToRead > MEDIAN_READ_TRIGGER_MS
  const trigger = (on: boolean, id: string) =>
    on ? (
      <span className="ms-2" data-minipos-trigger={id}>
        <StatusBadge sev="warn">{t('supporting.entry.trigger')}</StatusBadge>
      </span>
    ) : null
  return (
    <Section id="supporting" title={t('supporting.title')}>
      <Card id="perHour" title={t('supporting.perHour.title')}>
        <Pairs
          rows={[
            { label: t('supporting.perHour.hours'), value: f(figure(s.perPromoterHour.plannedHours, 1)) },
            { label: t('supporting.perHour.salesPerHour'), value: f(money(s.perPromoterHour.salesPerHour)) },
            { label: t('supporting.perHour.itemsPerHour'), value: f(figure(s.perPromoterHour.itemsPerHour, 2)) },
          ]}
        />
        {s.perPromoterHour.promoters.length > 0 && (
          <Table
            head={
              <>
                <th className={TH}>{t('supporting.perHour.promoter')}</th>
                <th className={TH}>{t('pharmacies.store')}</th>
                <th className={NUM_H}>{t('supporting.perHour.hours')}</th>
                <th className={NUM_H}>{t('money.sales')}</th>
                <th className={NUM_H}>{t('supporting.perHour.items')}</th>
                <th className={NUM_H}>{t('supporting.perHour.salesPerHour')}</th>
                <th className={NUM_H}>{t('supporting.perHour.itemsPerHour')}</th>
              </>
            }
          >
            {s.perPromoterHour.promoters.map((p) => (
              <tr key={`${p.promoterStaffId}|${p.storeCode}`} className="border-t border-border/40">
                <td className={`${TD} font-mono`}>
                  <Ltr>{p.promoterStaffId}</Ltr>
                </td>
                <td className={`${TD} font-mono`}>
                  <Ltr>{p.storeCode}</Ltr>
                </td>
                <td className={NUM}>{f(figure(p.plannedHours, 1))}</td>
                <td className={NUM}>{f(money(p.sales))}</td>
                <td className={NUM}>{f(figure(p.items, 0))}</td>
                <td className={NUM}>{f(money(p.salesPerHour))}</td>
                <td className={NUM}>{f(figure(p.itemsPerHour, 2))}</td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        <Card id="paidShare" title={t('supporting.paidShare.title')}>
          <Pairs
            rows={[
              { label: t('supporting.paidShare.paid'), value: f(formatCount(count(s.paidShare.paid), count(s.paidShare.orders))) },
              { label: t('supporting.paidShare.share'), value: f(percent(s.paidShare.share)) },
              ...s.paidShare.pharmacies.map((p) => ({
                id: `store|${p.storeCode}`,
                label: <Ltr>{p.storeCode}</Ltr>,
                value: f(percent(p.share)),
              })),
            ]}
          />
        </Card>

        <Card id="holdToBilled" title={t('supporting.holdToBilled.title')}>
          <Pairs
            rows={[
              { label: t('supporting.holdToBilled.orders'), value: f(count(s.holdToBilled.orders)) },
              { label: t('supporting.holdToBilled.median'), value: f(duration(s.holdToBilled.medianSeconds)) },
              { label: t('supporting.holdToBilled.average'), value: f(duration(s.holdToBilled.averageSeconds)) },
            ]}
          />
        </Card>

        <Card id="refusals" title={t('supporting.refusals.title')}>
          {s.refusals.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('supporting.refusals.none')}</p>
          ) : (
            <ul className="flex flex-col gap-1 text-sm">
              {s.refusals.map((r) => (
                <li key={`${r.reason}|${r.stage}`} className="flex justify-between gap-3" data-minipos-refusal={`${r.reason}|${r.stage}`}>
                  <span className="text-muted-foreground">
                    <Word value={r.reason} known={KNOWN_REASONS} prefix="supporting.refusals.reasons" />
                    {' · '}
                    <Word value={r.stage} known={KNOWN_STAGES} prefix="supporting.refusals.stages" />
                  </span>
                  <span className="tabular-nums">{f(count(r.count))}</span>
                </li>
              ))}
            </ul>
          )}
          <Pairs
            rows={[
              {
                label: t('supporting.resubmits.title'),
                value: f(formatCount(count(s.resubmits.resubmits), count(s.resubmits.orders))),
              },
            ]}
          />
        </Card>

        <Card id="entryModes" title={t('supporting.entry.title')}>
          <Pairs
            rows={[
              { label: t('supporting.entry.lines'), value: f(count(s.entryModes.lines)) },
              { label: t('supporting.entry.typedShare'), value: f(percent(s.entryModes.typedShare)), flag: trigger(typedOver, 'typed') },
              { label: t('supporting.entry.medianRead'), value: f(figure(s.entryModes.medianMsToRead, 0)), flag: trigger(readOver, 'read') },
            ]}
          />
          {s.entryModes.modes.length > 0 && (
            <Table
              head={
                <>
                  <th className={TH}>{t('supporting.entry.mode')}</th>
                  <th className={NUM_H}>{t('supporting.entry.lines')}</th>
                  <th className={NUM_H}>{t('supporting.entry.medianRead')}</th>
                </>
              }
            >
              {s.entryModes.modes.map((m) => (
                <tr key={m.entryMode} className="border-t border-border/40">
                  <td className={TD}>
                    <Word value={m.entryMode} known={KNOWN_MODES} prefix="supporting.entry.modes" />
                  </td>
                  <td className={NUM}>{f(count(m.lines))}</td>
                  <td className={NUM}>{f(figure(m.medianMsToRead, 0))}</td>
                </tr>
              ))}
            </Table>
          )}
        </Card>

        <Card id="serialFallbacks" title={t('supporting.serial.title')}>
          <Pairs
            rows={[
              { label: t('supporting.serial.refused'), value: f(count(s.serialFallbacks.refusedAsSerialised)) },
              { label: t('supporting.serial.scannedWithout'), value: f(count(s.serialFallbacks.scannedWithoutSerial)) },
            ]}
          />
        </Card>

        <Card id="returnRate" title={t('supporting.returns.title')}>
          <Pairs
            rows={[
              { label: t('supporting.returns.miniPos'), value: f(percent(s.returnRate.miniPos.rate)) },
              { label: t('supporting.returns.ordinary'), value: f(percent(s.returnRate.ordinary.rate)) },
            ]}
          />
          <p className="text-xs text-muted-foreground">{t('supporting.returns.hint')}</p>
        </Card>
      </div>
    </Section>
  )
}

/**
 * The weekly view (3710 M15): the compliance stop first — any off-list line sold through Mini POS stops it everywhere —
 * then each pharmacy's paid share per trial week, under half flagged, two weeks running flagged to pause.
 */
export function WeeklyView({ weekly, trialFrom }: { weekly: MiniPosScorecard['weekly']; trialFrom: string }) {
  const { t } = useTranslation(NS)
  const weeks = offListByWeek(weekly.offListLines, trialFrom)
  const grid = weeklyGrid(weekly.paidShare)
  const paused = grid.pharmacies.filter((p) => p.pause).map((p) => p.storeCode)
  return (
    <Section id="weekly" title={t('weekly.title')}>
      <p className="text-xs text-muted-foreground">{t('weekly.hint')}</p>

      <h3 className="text-sm font-semibold">{t('weekly.offList.title')}</h3>
      {weekly.offListLines.length === 0 ? (
        <p className="flex items-center gap-2 rounded-lg border border-success-border bg-success-050 p-3 text-sm text-success-800" data-minipos-off-list="clear">
          <CheckCircle2 className="h-4 w-4" aria-hidden />
          {t('weekly.offList.clear')}
        </p>
      ) : (
        <div className="flex flex-col gap-2" data-minipos-off-list="stop">
          <p
            role="alert"
            className="flex items-start gap-2 rounded-lg border border-danger-border bg-danger-050 p-3 text-sm font-semibold text-danger-800"
          >
            <OctagonX className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            {t('weekly.offList.stop', { n: fsi(count(weekly.offListLines.length)) })}
          </p>
          <Table
            head={
              <>
                <th className={TH}>{t('weekly.offList.week')}</th>
                <th className={TH}>{t('pharmacies.store')}</th>
                <th className={TH}>{t('weekly.offList.date')}</th>
                <th className={TH}>{t('weekly.offList.trx')}</th>
                <th className={TH}>{t('weekly.offList.order')}</th>
                <th className={TH}>{t('weekly.offList.item')}</th>
                <th className={TH}>{t('weekly.offList.aCode')}</th>
                <th className={TH}>{t('weekly.offList.reason')}</th>
              </>
            }
          >
            {weeks.flatMap((w) =>
              w.lines.map((l, i) => (
                <tr
                  key={`${l.storeCode}|${l.trxNumber}|${l.itemNumber}|${i}`}
                  className="border-t border-border/40 bg-danger-050 text-danger-800"
                  data-minipos-off-list-line={`${w.week}|${l.storeCode}|${l.itemNumber}`}
                >
                  <td className={`${TD} tabular-nums`}>
                    <Ltr>{String(w.week)}</Ltr>
                  </td>
                  <td className={`${TD} font-mono`}>
                    <Ltr>{l.storeCode}</Ltr>
                  </td>
                  <td className={TD}>
                    <Ltr>{day(l.trxDate)}</Ltr>
                  </td>
                  <td className={`${TD} font-mono`}>
                    <Ltr>{l.trxNumber}</Ltr>
                  </td>
                  <td className={`${TD} font-mono`}>
                    <Ltr>{l.orderNo}</Ltr>
                  </td>
                  <td className={`${TD} font-mono`}>
                    <Ltr>{l.itemNumber}</Ltr>
                  </td>
                  <td className={`${TD} font-mono`}>
                    <Ltr>{l.aCode}</Ltr>
                  </td>
                  <td className={TD}>
                    <Word value={l.reason} known={['category', 'list']} prefix="weekly.offList.reasons" />
                  </td>
                </tr>
              )),
            )}
          </Table>
        </div>
      )}

      <h3 className="text-sm font-semibold">{t('weekly.paid.title')}</h3>
      {paused.length > 0 && (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-danger-border bg-danger-050 p-3 text-sm text-danger-800"
          data-minipos-pause={paused.join(',')}
        >
          <PauseCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          {t('weekly.paid.pauseList', { stores: fsi(paused.join(', ')) })}
        </p>
      )}
      {grid.pharmacies.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('weekly.paid.empty')}</p>
      ) : (
        <Table
          head={
            <>
              <th className={TH}>{t('pharmacies.store')}</th>
              {grid.weeks.map((w) => (
                <th key={w.week} className={NUM_H} title={fsi(formatRange(w.from, w.to))}>
                  {t('weekly.paid.weekHead', { week: fsi(String(w.week)) })}
                </th>
              ))}
            </>
          }
        >
          {grid.pharmacies.map((p) => (
            <tr key={p.storeCode} className="border-t border-border/40" data-minipos-paid-row={p.storeCode}>
              <td className={`${TD} font-mono`}>
                <Ltr>{p.storeCode}</Ltr>
              </td>
              {p.cells.map((c, i) => (
                <td key={grid.weeks[i].week} className={NUM}>
                  <WeekCellView cell={c} />
                </td>
              ))}
            </tr>
          ))}
        </Table>
      )}
      <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <StatusBadge sev="warn">{t('weekly.paid.underHalf')}</StatusBadge>
        <StatusBadge sev="bad">{t('weekly.paid.pause')}</StatusBadge>
        <span>{t('weekly.paid.legend')}</span>
      </p>
    </Section>
  )
}

function WeekCellView({ cell }: { cell: MiniPosWeeklyPaidShare | null }) {
  const { t } = useTranslation(NS)
  if (!cell) return <span className="text-muted-foreground">{t('na')}</span>
  const sev = weekCellSeverity(cell)
  const flag = cell.pause ? 'pause' : cell.underHalf ? 'underHalf' : 'ok'
  return (
    <span className="inline-flex flex-col items-end gap-0.5" data-minipos-week-cell={`${cell.storeCode}|${cell.week}|${flag}`}>
      <span className={`rounded px-1.5 ${sev === 'ok' ? '' : SEVERITY_BADGE[sev]}`}>
        <Ltr>{percent(cell.share)}</Ltr>
      </span>
      <span className="text-[11px] text-muted-foreground">
        <Ltr>{formatCount(count(cell.paid), count(cell.orders))}</Ltr>
      </span>
      {flag !== 'ok' && (
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold">
          {flag === 'pause' ? <PauseCircle className="h-3 w-3" aria-hidden /> : <AlertTriangle className="h-3 w-3" aria-hidden />}
          {t(`weekly.paid.${flag}`)}
        </span>
      )}
    </span>
  )
}

/** A refused or failed read: the 400 `MINIPOS_SCORECARD_INVALID` names the inputs; a bare 403 names the grant. */
export function ScorecardFailureBanner({ failure }: { failure: ScorecardFailure }) {
  const { t } = useTranslation(NS)
  const title = t(`failure.${failure.kind}Title`)
  const message = failure.kind === 'denied' ? t('failure.deniedHint') : failure.message
  return (
    <div data-minipos-scorecard-failure={failure.kind} data-minipos-error-code={failure.code ?? ''}>
      <ErrorBanner className="p-2.5" title={title} message={message} />
      {failure.kind === 'invalid' && <p className="mt-1 text-xs text-muted-foreground">{t('failure.invalidHint')}</p>}
    </div>
  )
}
