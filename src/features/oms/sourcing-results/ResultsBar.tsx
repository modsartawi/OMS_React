import { Trans, useTranslation } from 'react-i18next'
import type { ResultsSegment, ResultsTopReply } from '@/core/models/sourcing-results'
import Ltr from '@/core/ui/Ltr'
import { fsi } from '@/core/util/bidi'
import Drill, { useDrill } from './Drill'
import Fig from './Fig'
import { HATCH } from './inks'
import { resultsBar } from './results-bar-model'
import { countText, percentText } from './text'

/**
 * The top (ticket 971, spec 4354 §17): the sentence, the bar of seven segments with its two brackets, the legend with a
 * count per segment, and the line of orders landed, run and not ended yet, not run. Every segment opens its orders.
 *
 * The bar is a grid that follows the page's direction: under Arabic the first segment, and both brackets, stand at
 * the right, where the reading starts. Widths are geometry from the counts as sent.
 */
export default function ResultsBar({ top }: { top: ResultsTopReply }) {
  const { t } = useTranslation('sourcing-results')
  const open = useDrill()
  const bar = resultsBar(top)
  const columns = bar.segments.map((s) => `minmax(4px, ${s.count}fr)`).join(' ')
  const segmentName = (segment: ResultsSegment) => t(`top.segments.${segment}`)
  const span = (b: { start: number; columns: number }) => `${b.start} / span ${b.columns}`
  const { stores, plan } = bar.brackets

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4" data-results-top="">
      <p className="max-w-[70ch] text-base leading-relaxed" data-results-sentence="">
        <Trans
          t={t}
          i18nKey="top.sentence"
          components={{
            orders: <Fig bold value={countText(bar.sentence.orders)} />,
            stores: <Fig bold value={percentText(bar.sentence.storesPercent)} />,
            plan: <Fig bold value={percentText(bar.sentence.planPercent)} />,
          }}
        />
      </p>

      {bar.empty ? (
        <p className="text-sm text-muted-foreground" data-results-empty="">
          {t('top.empty')}
        </p>
      ) : (
        <div className="grid gap-y-1" style={{ gridTemplateColumns: columns }} role="group" aria-label={t('top.barLabel')} data-results-bar="">
          {stores && (
            <>
              <div className="text-xs font-semibold whitespace-nowrap" style={{ gridColumn: span(stores), gridRow: 1 }} data-bracket="stores">
                <Trans t={t} i18nKey="top.storesBracket" components={{ p: <Fig value={percentText(stores.percent)} /> }} />
              </div>
              <div className="h-2 rounded-t-md border border-b-0 border-input" style={{ gridColumn: span(stores), gridRow: 2 }} aria-hidden />
            </>
          )}
          {bar.segments.map((s, i) => (
            <button
              key={s.segment}
              type="button"
              className="h-8 min-w-1 cursor-pointer hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              style={{ gridColumn: i + 1, gridRow: 3, backgroundColor: s.ink, backgroundImage: s.hatched ? HATCH : undefined }}
              title={`${segmentName(s.segment)}: ${fsi(countText(s.count))}`}
              aria-label={t('top.segmentLabel', {
                segment: segmentName(s.segment),
                count: fsi(countText(s.count)),
                percent: fsi(percentText(s.percent)),
              })}
              data-segment={s.segment}
              onClick={() => open({ kind: 'segment', segment: s.segment })}
            />
          ))}
          {plan && (
            <>
              <div className="h-2 rounded-b-md border border-t-0 border-input" style={{ gridColumn: span(plan), gridRow: 4 }} aria-hidden />
              <div className="text-xs font-semibold whitespace-nowrap" style={{ gridColumn: span(plan), gridRow: 5 }} data-bracket="plan">
                <Trans t={t} i18nKey="top.planBracket" components={{ p: <Fig value={percentText(plan.percent)} /> }} />
              </div>
            </>
          )}
        </div>
      )}

      {bar.segments.length > 0 && (
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs" data-results-legend="">
          {bar.segments.map((s) => (
            <li key={s.segment} className="inline-flex items-center gap-1.5" data-legend={s.segment}>
              <i className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: s.ink, backgroundImage: s.hatched ? HATCH : undefined }} aria-hidden />
              <span>{segmentName(s.segment)}</span>
              <Drill figure={{ kind: 'segment', segment: s.segment }} count={s.count} />
              <span className="text-muted-foreground">
                (<Ltr>{percentText(s.percent)}</Ltr>)
              </span>
            </li>
          ))}
        </ul>
      )}

      {(!bar.addsUp || !bar.bracketsMatch) && (
        <p className="rounded-md border border-attention-border bg-attention-050 px-3 py-2 text-xs text-attention-800" data-results-mismatch="">
          {t('top.mismatch')}
        </p>
      )}

      <p className="text-xs text-muted-foreground" data-results-runs="">
        <Trans
          t={t}
          i18nKey="top.runs"
          components={{
            landed: <Fig value={countText(top.landed)} />,
            // SERVER GAP (spec 4354): no orders door answers these two figures (they are not on the summary rows), so they open nothing.
            open: <Fig value={countText(top.runNotEnded)} />,
            notRun: <Fig value={countText(top.notRun)} />,
          }}
        />
      </p>
    </section>
  )
}
