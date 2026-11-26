import { useState, type ReactNode } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import { sequentialFill } from '@/core/charts/sequential'
import { RESULTS_LEFT_OVERS, type ResultsChecksReply, type ResultsPromiseMode, type ResultsRatio } from '@/core/models/sourcing-results'
import Chip from '@/core/ui/Chip'
import Ltr from '@/core/ui/Ltr'
import { TD } from '@/core/ui/sheet-table'
import { formatCount, formatParts, formatRange } from '@/core/util/bidi'
import { readingTabsApi } from './api'
import Drill from './Drill'
import Fig from './Fig'
import { Gauge, PILL, PromiseCheck, STATE_PILL } from './Panels'
import { promisePanel } from './promise-panel-model'
import type { ResultsTabProps } from './ResultsTabs'
import { shelfEvidence, type ShelfCellView } from './shelf-chance-evidence-model'
import TabRead, { Pct, TD_NUM, TD_WRAP, TH_NUM, TH_WRAP } from './TabRead'
import { countText, percentText } from './text'

const SHELF_MODES: readonly ResultsPromiseMode[] = ['DAWAA_NOW', 'SLOT', 'PICK_UP']
type SecondLine = 'PICKS' | 'HALVES'

/** A cell's shade: the sequential weight held under 55% of the hue, so its ink stays readable on it. */
const cellFill = (heat: number) => sequentialFill(Math.round(heat * 0.55))

const ratioText = (r: number | null) => (r == null ? '' : r.toFixed(2))

/**
 * Promise and stock checks (ticket 972, results ticket decisions 6 and 9 and their amendments): the promise check with
 * Dawaa Now by distance band and the express stamp's own share; the stock check; the shelf chance table — 36 cells,
 * a mode switch and a second switch, "Picks" or "Counts by half-year" — with the eight short-figure rows from
 * deliveries, their two ratios, the fixed note on them, each mode's fleet ratio, and the window and number of counts.
 * The promise check reads its rows off the summary; the rest off the checks door. In words; no green and no red.
 */
export default function ChecksTab({ query, summary }: ResultsTabProps) {
  const { t } = useTranslation('sourcing-results')
  const read = useQuery({
    queryKey: ['sourcing-results', 'checks', query],
    queryFn: () => readingTabsApi.checks(query),
    placeholderData: keepPreviousData,
    retry: false,
  })
  return (
    <div className="flex flex-col gap-4" data-reading-tab="checks">
      <TabRead read={read}>
        {(reply) => (
          <div className="flex flex-col gap-6">
            <div className="grid items-start gap-6 lg:grid-cols-2">
              <Section title={t('checks.promiseTitle')} data="promise">
                <PromiseCheck rows={summary.promise} />
                <DistanceBands reply={reply} />
              </Section>
              <Section title={t('checks.stock.title')} data="stock">
                <StockCheck reply={reply} />
              </Section>
            </div>
            <ShelfTable shelf={reply.shelf} />
          </div>
        )}
      </TabRead>
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
  const { dawaaNow } = reply
  const rows = promisePanel(dawaaNow.bands.map((b) => ({ mode: 'DAWAA_NOW', channelGroup: null, count: b.count, percent: b.percent, band: dawaaNow.band })))
  return (
    <div className="flex flex-col gap-2" data-distance-bands="">
      {dawaaNow.expressStampPercent != null && (
        <p className="text-xs text-muted-foreground" data-express-stamp="">
          <Trans t={t} i18nKey="checks.distance.expressStamp" components={{ p: <Fig value={percentText(dawaaNow.expressStampPercent)} /> }} />
        </p>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-border text-xs text-muted-foreground">
            <tr>
              <th className={TH_WRAP}>{t('checks.distance.cols.band')}</th>
              <th className={TH_NUM}>{t('checks.distance.cols.shipments')}</th>
              <th className={TH_NUM}>{t('checks.distance.cols.within')}</th>
              <th className={`${TH_WRAP} w-[36%]`} aria-hidden />
            </tr>
          </thead>
          <tbody>
            {dawaaNow.bands.map((b, i) => (
              <tr key={b.band} className="border-b border-border/60" data-distance-band={b.band} data-promise-state={rows[i].state}>
                <td className={TD_WRAP}>{t(`checks.distance.bands.${b.band}`)}</td>
                <td className={TD_NUM}>
                  <Drill figure={{ kind: 'distanceBand', band: b.band }} count={b.count} />
                </td>
                <td className={TD_NUM}>
                  <span className="inline-flex items-center gap-2">
                    <Ltr>{percentText(b.percent)}</Ltr>
                    <span className={STATE_PILL[rows[i].state]}>{t(`checks.distance.states.${rows[i].state}`)}</span>
                  </span>
                </td>
                <td className={TD_WRAP}>
                  <Gauge row={rows[i]} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">{t('checks.distance.note')}</p>
    </div>
  )
}

function StockCheck({ reply }: { reply: ResultsChecksReply }) {
  const { t } = useTranslation('sourcing-results')
  const rows = [
    { covered: true, row: reply.stock.covered },
    { covered: false, row: reply.stock.notCovered },
  ]
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-muted-foreground">{t('checks.stock.lede')}</p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-border text-xs text-muted-foreground">
            <tr>
              <th className={TH_WRAP}>{t('checks.stock.cols.read')}</th>
              <th className={`${TH_NUM} whitespace-normal`}>{t('checks.stock.cols.ended')}</th>
              <th className={`${TH_NUM} whitespace-normal`}>{t('checks.stock.cols.noStock')}</th>
              <th className={TH_NUM}>{t('checks.stock.cols.share')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ covered, row }) => (
              <tr key={String(covered)} className="border-b border-border/60" data-stock-check={covered ? 'covered' : 'not-covered'}>
                <td className={TD_WRAP}>{t(covered ? 'checks.stock.coveredLong' : 'checks.stock.notCoveredLong')}</td>
                <td className={TD_NUM}>
                  <Drill figure={{ kind: 'stockCheck', covered, noStock: false }} count={row.ended} />
                </td>
                <td className={TD_NUM}>
                  <Drill figure={{ kind: 'stockCheck', covered, noStock: true }} count={row.noStock} />
                </td>
                <td className={TD_NUM}>
                  <Pct value={row.percent} />
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

function ShelfTable({ shelf }: { shelf: ResultsChecksReply['shelf'] }) {
  const { t } = useTranslation('sourcing-results')
  const [mode, setMode] = useState<ResultsPromiseMode>('DAWAA_NOW')
  const [line, setLine] = useState<SecondLine>('PICKS')
  const view = shelfEvidence(shelf, mode)
  return (
    <section className="flex flex-col gap-3" data-shelf={mode} data-shelf-line={line}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-semibold">{t('checks.shelf.title')}</h3>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex flex-wrap items-center gap-1" role="group" aria-label={t('checks.shelf.modeLabel')}>
            {SHELF_MODES.map((m) => (
              <Chip key={m} on={mode === m} onClick={() => setMode(m)} data-shelf-mode={m}>
                {t(`modes.${m}`)}
              </Chip>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-1" role="group" aria-label={t('checks.shelf.lineLabel')}>
            {(['PICKS', 'HALVES'] as const).map((l) => (
              <Chip key={l} on={line === l} onClick={() => setLine(l)} data-shelf-second={l}>
                {t(`checks.shelf.lines.${l}`)}
              </Chip>
            ))}
          </div>
        </div>
      </div>
      <p className="max-w-[90ch] text-xs text-muted-foreground">
        <Trans t={t} i18nKey="checks.shelf.bold" components={{ set: <bdi>{view.set.name}</bdi>, version: <Fig value={String(view.set.version)} /> }} />{' '}
        {line === 'PICKS' ? (
          t('checks.shelf.picksLine')
        ) : (
          <Trans
            t={t}
            i18nKey="checks.shelf.halvesLine"
            components={{
              h1: <Fig value={view.halves[0] ? formatRange(view.halves[0].from, view.halves[0].to) : ''} />,
              h2: <Fig value={view.halves[1] ? formatRange(view.halves[1].from, view.halves[1].to) : ''} />,
              h3: <Fig value={view.halves[2] ? formatRange(view.halves[2].from, view.halves[2].to) : ''} />,
            }}
          />
        )}{' '}
        {t('checks.shelf.tooFewRule')}
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[56rem] border-separate border-spacing-0.5 text-sm" data-shelf-table="">
          <thead className="text-xs text-muted-foreground">
            <tr>
              <th rowSpan={2} className={`${TH_WRAP} align-bottom`}>
                {t('checks.shelf.asked')}
              </th>
              <th colSpan={RESULTS_LEFT_OVERS.length} className={`${TH_WRAP} text-center`}>
                {t('checks.shelf.leftOverTitle')}
              </th>
            </tr>
            <tr>
              {RESULTS_LEFT_OVERS.map((lo) => (
                <th key={lo} className={`${TH_WRAP} text-center`}>
                  {t(`checks.shelf.leftOver.${lo}`)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {view.grid.map((r) => (
              <tr key={r.asked}>
                <th className={TH_WRAP} scope="row">
                  {r.asked === 6 ? t('checks.shelf.sixOrMore') : <Ltr>{String(r.asked)}</Ltr>}
                </th>
                {r.cells.map((c, i) => (
                  <ShelfCell key={c?.key ?? i} cell={c} line={line} />
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-xs" data-fleet-ratios="">
        <span className="text-muted-foreground">{t('checks.shelf.fleetRatio')}</span>
        {view.fleetRatios.map((f) => (
          <span key={f.mode} className={f.mode === mode ? 'font-semibold' : ''} data-fleet-ratio={f.mode}>
            {t(`modes.${f.mode}`)} <Ltr>{f.ratio == null ? t('dash') : ratioText(f.ratio)}</Ltr>
          </span>
        ))}
        <span className="text-muted-foreground" data-shelf-window="">
          <Trans
            t={t}
            i18nKey="checks.shelf.window"
            components={{ counts: <Fig value={countText(view.window.counts)} />, from: <Fig value={view.window.from} />, to: <Fig value={view.window.to} /> }}
          />
        </span>
      </div>
      <ShortFigureRows view={view} />
    </section>
  )
}

function ShelfCell({ cell, line }: { cell: ShelfCellView | null; line: SecondLine }) {
  const { t } = useTranslation('sourcing-results')
  if (!cell)
    return (
      <td className={`${TD} text-center text-muted-foreground`} data-shelf-cell="none">
        {t('dash')}
      </td>
    )
  return (
    <td
      className="rounded-sm px-2 py-1.5 text-center align-top"
      style={{ background: cellFill(cell.heat) }}
      data-shelf-cell={cell.key}
      data-reading={cell.reading}
    >
      <b className="block">
        <Ltr>{`${cell.chance.toFixed(2)}%`}</Ltr>
      </b>
      {line === 'PICKS' ? (
        <>
          <span className="block text-xs" data-shelf-picks="">
            <Ltr>{formatParts([formatCount(countText(cell.failed), countText(cell.lines)), cell.failedPercent == null ? '' : percentText(cell.failedPercent)])}</Ltr>
          </span>
          <span className="block text-[11px] text-muted-foreground" data-shelf-reading="">
            {t(`checks.reading.${cell.reading}`)}
          </span>
        </>
      ) : (
        <span className="block text-xs" data-shelf-halves="">
          <Ltr>{formatParts(cell.halves.map((h) => (h == null ? t('dash') : `${h.toFixed(2)}%`)))}</Ltr>
        </span>
      )}
    </td>
  )
}

function RatioCell({ ratio }: { ratio: ResultsRatio }) {
  const { t } = useTranslation('sourcing-results')
  return (
    <div className="flex flex-col items-end">
      <b>
        <Ltr>{ratio.ratio == null ? t('dash') : ratioText(ratio.ratio)}</Ltr>
      </b>
      <span className="text-[11px] text-muted-foreground">
        <Trans t={t} i18nKey="checks.rows.linesBehind" components={{ lines: <Fig value={countText(ratio.lines)} />, failed: <Fig value={countText(ratio.failed)} /> }} />
      </span>
    </div>
  )
}

function ShortFigureRows({ view }: { view: ReturnType<typeof shelfEvidence> }) {
  const { t } = useTranslation('sourcing-results')
  return (
    <div className="flex flex-col gap-2" data-short-rows="">
      <h4 className="text-sm font-semibold">{t('checks.rows.title')}</h4>
      <p className="max-w-[90ch] rounded-md border border-border bg-muted/40 px-3 py-2 text-xs" data-ratio-note="">
        {t('checks.rows.note')}
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[60rem] text-sm">
          <thead className="border-b border-border text-xs text-muted-foreground">
            <tr>
              <th className={TH_WRAP}>{t('checks.rows.cols.row')}</th>
              <th className={TH_WRAP}>{t('checks.rows.cols.mode')}</th>
              <th className={TH_NUM}>{t('checks.rows.cols.figure')}</th>
              <th className={`${TH_NUM} whitespace-normal`}>{t('checks.rows.cols.oneLine')}</th>
              <th className={`${TH_NUM} whitespace-normal`}>{t('checks.rows.cols.every')}</th>
              <th className={TH_WRAP}>{t('checks.rows.cols.groups')}</th>
              <th className={TH_WRAP}>{t('checks.rows.cols.reading')}</th>
            </tr>
          </thead>
          <tbody>
            {view.rows.map((r) => (
              <tr key={r.key} className="border-b border-border/60" data-short-row={r.key} data-reading={r.reading}>
                <td className={TD_WRAP}>
                  {t(`stockClasses.${r.stockClass}`)}{' '}
                  <span className={`${PILL} border-border bg-muted text-muted-foreground`} data-row-source="">
                    {t('checks.rows.fromDeliveries')}
                  </span>
                </td>
                <td className={TD_WRAP}>{t(`modes.${r.mode}`)}</td>
                <td className={TD_NUM}>
                  <Ltr>{percentText(r.chance)}</Ltr>
                </td>
                <td className={TD_NUM}>
                  <RatioCell ratio={r.oneLine} />
                </td>
                <td className={TD_NUM}>
                  <RatioCell ratio={r.everyDelivery} />
                </td>
                <td className={`${TD_WRAP} text-xs`}>
                  <ul className="flex flex-col gap-0.5">
                    {r.groups.map((g) => (
                      <li key={g.group} data-row-group={g.group}>
                        <Trans
                          t={t}
                          i18nKey="checks.rows.groupLine"
                          values={{ group: t(`checks.rows.groups.${g.group}`) }}
                          components={{ one: <Fig value={countText(g.oneLineLines)} />, every: <Fig value={countText(g.everyLines)} /> }}
                        />
                      </li>
                    ))}
                  </ul>
                </td>
                <td className={`${TD_WRAP} text-xs`}>{t(`checks.reading.${r.reading}`)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
