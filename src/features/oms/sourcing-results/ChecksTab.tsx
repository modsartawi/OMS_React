import type { ReactNode } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import type { BarQuery, ResultsChecksReply } from '@/core/models/sourcing-results'
import Ltr from '@/core/ui/Ltr'
import { formatCount, formatParts } from '@/core/util/bidi'
import { sourcingResultsApi } from './api'
import { Word } from './codes'
import Fig from './Fig'
import { Gauge, PILL, PromiseCheck } from './Panels'
import { promisePanel } from './promise-panel-model'
import type { ResultsTabProps } from './ResultsTabs'
import { shelfEvidence, type ShelfEvidenceRow } from './shelf-chance-evidence-model'
import TabRead, { Pct, TD_NUM, TD_WRAP, TH_NUM, TH_WRAP } from './TabRead'
import { countText } from './text'

/** The phase 2 bar's default reading: the shelf chance evidence rides on it, the same for every period and group. */
export const DEFAULT_BAR_QUERY: BarQuery = { channelGroup: 'APP_SITE', step: 'STORES_ONLY' }
export const barKey = (q: BarQuery) => ['sourcing-results', 'phase-2-bar', q] as const

const ratioText = (r: number | null) => (r == null ? '' : r.toFixed(2))

/**
 * Promise and stock checks (ticket 972, results ticket decisions 6 and 9 and their amendments): the promise check with
 * Dawaa Now by distance band and the express stamp's own share, and the stock check by mode (BO 4393 `Results/Checks`);
 * then the shelf chance figures with their evidence and each mode's fleet ratio, which BO 4396 reads on the phase 2
 * bar (`Results/Phase2Bar`). In words; no green and no red.
 *
 * SERVER GAP (spec 4354) — the orders door has no figure for a distance band or a stock check row, so their counts are
 * plain; and see `./shelf-chance-evidence-model` for what the shelf chance evidence lacks.
 */
export default function ChecksTab({ query }: ResultsTabProps) {
  const { t } = useTranslation('sourcing-results')
  const read = useQuery({
    queryKey: ['sourcing-results', 'checks', query],
    queryFn: () => sourcingResultsApi.checks(query),
    placeholderData: keepPreviousData,
    retry: false,
  })
  const bar = useQuery({ queryKey: barKey(DEFAULT_BAR_QUERY), queryFn: () => sourcingResultsApi.bar(DEFAULT_BAR_QUERY), retry: false })
  return (
    <div className="flex flex-col gap-6" data-reading-tab="checks">
      <TabRead read={read}>
        {(reply) => (
          <div className="grid items-start gap-6 lg:grid-cols-2">
            <Section title={t('checks.promiseTitle')} data="promise">
              <PromiseCheck rows={reply.promiseCheck} />
              <DistanceBands reply={reply} />
            </Section>
            <Section title={t('checks.stock.title')} data="stock">
              <StockCheck reply={reply} />
            </Section>
          </div>
        )}
      </TabRead>
      <TabRead read={bar}>{(reply) => <ShelfEvidence rows={shelfEvidence(reply.reading)} />}</TabRead>
    </div>
  )
}

function Section({ title, data, children }: { title: string; data: string; children: ReactNode }) {
  return (
    <section className="flex min-w-0 flex-col gap-3" data-checks-section={data}>
      <h3 className="text-sm font-semibold">{title}</h3>
      {children}
    </section>
  )
}

function DistanceBands({ reply }: { reply: ResultsChecksReply }) {
  const { t } = useTranslation('sourcing-results')
  const band = reply.promiseCheck.find((p) => p.mode === 'DAWAA_NOW')
  return (
    <div className="flex flex-col gap-2" data-distance-bands="">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-border text-xs text-muted-foreground">
            <tr>
              <th className={TH_WRAP}>{t('checks.distance.cols.band')}</th>
              <th className={TH_NUM}>{t('checks.distance.cols.shipments')}</th>
              <th className={TH_NUM}>{t('checks.distance.cols.within')}</th>
              <th className={TH_NUM}>{t('checks.distance.cols.stamp')}</th>
              <th className={`${TH_WRAP} w-[32%]`} aria-hidden />
            </tr>
          </thead>
          <tbody>
            {reply.dawaaNowByBand.map((b) => {
              // The band shaded on the gauge is Dawaa Now's (85% to 95%); the server judges no band against it.
              const [row] = promisePanel([
                {
                  mode: 'DAWAA_NOW',
                  channelGroup: null,
                  checked: b.checked,
                  within: b.within,
                  percent: b.percent,
                  pill: b.checked > 0 ? 'NO_BAND' : 'NONE_CHECKED',
                  bandLow: band?.bandLow ?? null,
                  bandHigh: band?.bandHigh ?? null,
                  withinExpressStamp: b.withinExpressStamp,
                  expressStampPercent: b.expressStampPercent,
                },
              ])
              return (
                <tr key={b.band} className="border-b border-border/60" data-distance-band={b.band}>
                  <td className={TD_WRAP}>
                    <Word k={`checks.distance.bands.${b.band}`} family="DISTANCE_BAND" code={b.band} />
                  </td>
                  <td className={TD_NUM}>
                    <Ltr>{countText(b.checked)}</Ltr>
                  </td>
                  <td className={TD_NUM}>
                    <Pct value={b.checked > 0 ? b.percent : null} />
                  </td>
                  <td className={TD_NUM}>
                    <Pct value={b.checked > 0 ? b.expressStampPercent : null} />
                  </td>
                  <td className={TD_WRAP}>
                    <Gauge row={row} />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">{t('checks.distance.note')}</p>
    </div>
  )
}

function StockCheck({ reply }: { reply: ResultsChecksReply }) {
  const { t } = useTranslation('sourcing-results')
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-muted-foreground">{t('checks.stock.lede')}</p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-border text-xs text-muted-foreground">
            <tr>
              <th className={TH_WRAP}>{t('checks.stock.cols.mode')}</th>
              <th className={`${TH_NUM} whitespace-normal`}>{t('checks.stock.cols.deliveries')}</th>
              <th className={`${TH_NUM} whitespace-normal`}>{t('checks.stock.cols.stockChecked')}</th>
              <th className={`${TH_NUM} whitespace-normal`}>{t('checks.stock.cols.covered')}</th>
              <th className={`${TH_NUM} whitespace-normal`}>{t('checks.stock.cols.failedPicks')}</th>
            </tr>
          </thead>
          <tbody>
            {reply.stockCheck.map((r) => (
              <tr key={r.mode} className="border-b border-border/60" data-stock-check={r.mode}>
                <td className={TD_WRAP}>{t(`modes.${r.mode}`)}</td>
                <td className={TD_NUM}>
                  <Ltr>{countText(r.deliveries)}</Ltr>
                </td>
                <td className={TD_NUM}>
                  <Ltr>{countText(r.stockChecked)}</Ltr>
                </td>
                <td className={TD_NUM}>
                  <Ltr>{countText(r.covered)}</Ltr>
                </td>
                <td className={TD_NUM}>
                  <Ltr>{countText(r.failedPicks)}</Ltr>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">{t('checks.stock.thin')}</p>
    </div>
  )
}

function ShelfEvidence({ rows }: { rows: ReturnType<typeof shelfEvidence> }) {
  const { t } = useTranslation('sourcing-results')
  return (
    <section className="flex flex-col gap-3" data-shelf="">
      <h3 className="text-sm font-semibold">{t('checks.shelf.title')}</h3>
      <p className="max-w-[90ch] text-xs text-muted-foreground">{t('checks.shelf.lede')}</p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[60rem] text-sm" data-shelf-table="">
          <thead className="border-b border-border text-xs text-muted-foreground">
            <tr>
              <th className={TH_WRAP}>{t('checks.shelf.cols.mode')}</th>
              <th className={TH_WRAP}>{t('checks.shelf.cols.stockClass')}</th>
              <th className={`${TH_NUM} whitespace-normal`}>{t('checks.shelf.cols.lines')}</th>
              <th className={`${TH_NUM} whitespace-normal`}>{t('checks.shelf.cols.expected')}</th>
              <th className={`${TH_NUM} whitespace-normal`}>{t('checks.shelf.cols.ratio')}</th>
              <th className={`${TH_NUM} whitespace-normal`}>{t('checks.shelf.cols.halves')}</th>
              <th className={`${TH_NUM} whitespace-normal`}>{t('checks.shelf.cols.days')}</th>
              <th className={TH_WRAP}>{t('checks.shelf.cols.verdict')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.rows.map((r) => (
              <ShelfRow key={r.key} row={r} />
            ))}
          </tbody>
        </table>
      </div>
      <p className="max-w-[90ch] rounded-md border border-border bg-muted/40 px-3 py-2 text-xs" data-ratio-note="">
        {t('checks.shelf.rule')}
      </p>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-xs" data-fleet-ratios="">
        <span className="text-muted-foreground">{t('checks.shelf.fleetRatio')}</span>
        {rows.fleetRatios.map((f) => (
          <span key={f.mode} data-fleet-ratio={f.mode}>
            {t(`modes.${f.mode}`)} <Ltr>{f.ratio == null ? t('dash') : ratioText(f.ratio)}</Ltr>{' '}
            <span className="text-muted-foreground">
              <Trans t={t} i18nKey="checks.shelf.fleetLines" components={{ lines: <Fig value={countText(f.lines)} /> }} />
            </span>
          </span>
        ))}
      </div>
    </section>
  )
}

function ShelfRow({ row: r }: { row: ShelfEvidenceRow }) {
  const { t } = useTranslation('sourcing-results')
  return (
    <tr className="border-b border-border/60" data-shelf-row={r.key} data-verdict={r.verdict}>
      <td className={TD_WRAP}>{t(`modes.${r.mode}`)}</td>
      <td className={TD_WRAP}>
        <Word k={`stockClasses.${r.stockClass}`} family="STOCK_CLASS" code={r.stockClass} />
      </td>
      <td className={TD_NUM}>
        <Ltr>{formatCount(countText(r.failedLines), countText(r.lines))}</Ltr>
      </td>
      <td className={TD_NUM}>
        <Ltr>{r.expected.toFixed(1)}</Ltr>
      </td>
      <td className={TD_NUM}>
        {r.ratio == null ? t('dash') : <Ltr>{ratioText(r.ratio)}</Ltr>}
        <div className="text-[11px] text-muted-foreground">
          <Trans t={t} i18nKey="checks.shelf.fits" components={{ fits: <Fig value={ratioText(r.fits)} />, gap: <Fig value={r.chanceGap.toFixed(3)} /> }} />
        </div>
      </td>
      <td className={TD_NUM}>
        <Ltr>{formatParts([r.firstHalf, r.secondHalf].map((h) => (h == null ? t('dash') : ratioText(h))))}</Ltr>
      </td>
      <td className={TD_NUM}>
        <Ltr>{countText(r.daysCounted)}</Ltr>
      </td>
      <td className={`${TD_WRAP} text-xs`}>
        <span className={`${PILL} border-border bg-muted text-muted-foreground`}>
          <Word k={`checks.reading.${r.verdict}`} family="SHELF_CHANCE_VERDICT" code={r.verdict} />
        </span>
        {r.awaitsRuling && <div className="mt-0.5 text-attention-800">{t('checks.shelf.awaitsRuling')}</div>}
        {r.ruling && <div className="mt-0.5 text-muted-foreground">{t('checks.shelf.ruled')}</div>}
      </td>
    </tr>
  )
}

