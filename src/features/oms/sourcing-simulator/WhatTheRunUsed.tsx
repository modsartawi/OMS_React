import { USED_STATES } from '@/core/models/sourcing-run'
import Ltr from '@/core/ui/Ltr'
import { TD, TH } from '@/core/ui/sheet-table'
import { fsi } from '@/core/util/bidi'
import { formatFigure } from '@/core/util/number-format'
import { wireClock } from './promise-bar-model'
import type { SimulatorTabProps } from './SimulatorTabs'
import SourcePill from './SourcePill'
import { runMarks, usedFactors, type RunMark } from './used-factors-model'
import { usePlanWords } from './use-plan-words'

const PILL = 'inline-block rounded-full border px-1.5 py-px text-[11px] whitespace-nowrap'

/** How a factor ran, in a pill: an assumption wears the attention look; nothing is green or red. */
const STATE_PILL: Record<string, string> = {
  REAL_DATA: `${PILL} border-border text-foreground`,
  NEUTRAL_DEFAULT: `${PILL} border-dashed border-border text-muted-foreground`,
  ASSUMED: `${PILL} border-attention-border bg-attention-050 text-attention-800`,
  SWITCHED_OFF: `${PILL} border-border bg-muted text-muted-foreground`,
}

/**
 * The tab "What the run used" (ticket 965, BackOffice spec 4354 §12, story 35; SIMT decision 11): four counts on top —
 * real data, a neutral default, an assumption, switched off — the marks of the run, and every factor with how it
 * enters, how it ran and its source. The run's, not the plan's: the same for every plan in the strip.
 */
export default function WhatTheRunUsed({ reply }: SimulatorTabProps) {
  const w = usePlanWords()
  const { t } = w
  const used = usedFactors(reply)
  const marks = runMarks(reply)
  return (
    <div className="flex flex-col gap-4 text-xs" data-used="">
      <h3 className="text-sm font-semibold">{t('used.title')}</h3>
      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4" data-used-counts="">
        {USED_STATES.map((s) => (
          <div key={s} className="flex flex-col gap-0.5 rounded-md border border-border px-3 py-2" data-used-count={s}>
            <dt className="text-muted-foreground">{t(`used.count.${s}`)}</dt>
            <dd className="text-lg font-semibold tabular-nums">
              <Ltr>{formatFigure(used.counts[s])}</Ltr>
            </dd>
          </div>
        ))}
      </dl>

      <section className="flex flex-col gap-1.5">
        <h4 className="font-semibold text-muted-foreground">{t('used.marks.title')}</h4>
        {marks.length === 0 ? (
          <p className="text-muted-foreground" data-used-marks-none="">
            {t('used.marks.none')}
          </p>
        ) : (
          <ul className="flex flex-col gap-1" data-used-marks="">
            {marks.map((m) => (
              <li key={m.key === 'solve' ? `solve-${m.code}` : m.key} className="flex flex-wrap items-baseline gap-1.5" data-used-mark={m.key === 'solve' ? m.code : m.key}>
                <MarkText mark={m} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-1.5">
        <h4 className="font-semibold text-muted-foreground">{t('used.factors')}</h4>
        {used.rows.length === 0 ? (
          <p className="text-muted-foreground">{t('used.noneSent')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full" data-used-table="">
              <thead className="border-b border-border text-muted-foreground">
                <tr>
                  <th className={TH}>{t('used.column.factor')}</th>
                  <th className={TH}>{t('used.column.entersAs')}</th>
                  <th className={TH}>{t('used.column.ranOn')}</th>
                  <th className={TH}>{t('used.column.source')}</th>
                </tr>
              </thead>
              <tbody>
                {used.rows.map((r) => (
                  <tr key={r.factor} className="border-b border-border/60 last:border-b-0" data-used-factor={r.factor} data-used-state={r.state}>
                    <td className={TD}>{t(`used.factor.${r.factor}`, { defaultValue: r.factor })}</td>
                    <td className={TD}>{r.entersAs ? t(`used.entersAs.${r.entersAs}`, { defaultValue: r.entersAs }) : t('dash')}</td>
                    <td className={TD}>
                      <span className={STATE_PILL[r.state] ?? STATE_PILL.REAL_DATA}>{t(`used.state.${r.state}`, { defaultValue: r.state })}</span>
                    </td>
                    <td className={`${TD} whitespace-normal`}>
                      <SourcePill source={r.source} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}

function MarkText({ mark }: { mark: RunMark }) {
  const { t } = usePlanWords()
  if (mark.key === 'solve') {
    return (
      <>
        <span className="font-semibold">{t(`used.solveMark.${mark.code}`, { defaultValue: mark.code })}</span>
        <code className="font-mono text-[11px] text-muted-foreground">
          <Ltr>{mark.code}</Ltr>
        </code>
      </>
    )
  }
  if (mark.key === 'figuresReadAt') {
    return <span className="font-semibold">{t('used.marks.figuresReadAt', { time: fsi(wireClock(mark.at)) })}</span>
  }
  return (
    <>
      <span className="font-semibold">{t(`used.marks.${mark.key}.name`)}</span>
      <span className="text-muted-foreground">{t(`used.marks.${mark.key}.body`)}</span>
    </>
  )
}
