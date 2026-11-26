import { STAGE_NAMES, type AdviseReply } from '@/core/models/sourcing-run'
import Ltr from '@/core/ui/Ltr'
import { fsi } from '@/core/util/bidi'
import { formatFigure } from '@/core/util/number-format'
import type { PlanNotes } from './plans-list-model'
import { usePlanWords } from './use-plan-words'

/**
 * The run in a few lines (ticket 962): its number, the time it planned for, the weight set, the ending in words, the
 * banner when the simple plan answered, and the time each stage took, read from the reply (4281 decision 8: no
 * progress stream, so the stages are told after).
 */
export default function RunSummary({ reply, notes }: { reply: AdviseReply; notes: PlanNotes }) {
  const w = usePlanWords()
  const { t } = w
  return (
    <section className="flex flex-col gap-3" data-run-summary="">
      {notes.fallbackAnswered && (
        <div className="flex flex-col gap-1 rounded-md border border-attention-border bg-attention-050 px-3 py-2 text-xs text-attention-800" data-run-fallback="">
          <span className="font-semibold">{t('fallback.title')}</span>
          <span>{t('fallback.body')}</span>
          {notes.why && (
            <span className="flex flex-wrap gap-1">
              <span>{t('fallback.why')}</span>
              <bdi>{notes.why}</bdi>
            </span>
          )}
        </div>
      )}
      {notes.missingLines.length > 0 && (
        <div className="flex flex-col gap-1 rounded-md border border-attention-border bg-attention-050 px-3 py-2 text-xs text-attention-800" data-run-no-plan-possible="">
          <span className="font-semibold">{t('noPlanPossible')}</span>
          <ul className="flex flex-col gap-0.5">
            {notes.missingLines.map((m) => (
              <li key={m.lineNo} className="flex flex-wrap gap-2">
                <bdi>{w.said(m.sentence)}</bdi>
                <code className="font-mono text-[11px]">
                  <Ltr>{m.code}</Ltr>
                </code>
              </li>
            ))}
          </ul>
        </div>
      )}
      <dl className="flex flex-wrap gap-x-5 gap-y-1 text-xs">
        <div className="flex gap-1.5">
          <dt className="text-muted-foreground">{t('ending.label')}</dt>
          <dd className="font-medium" data-run-ending={notes.ending}>
            {t(`ending.${notes.ending}`, { defaultValue: notes.ending })}
          </dd>
        </div>
        <div className="flex gap-1.5">
          <dt className="text-muted-foreground">{t('runInfo.run')}</dt>
          <dd className="font-mono" data-run-id={reply.runId}>
            <Ltr>{reply.runId}</Ltr>
          </dd>
        </div>
        <div className="flex gap-1.5">
          <dt className="text-muted-foreground">{t('runInfo.plannedFor')}</dt>
          <dd>
            <Ltr>{reply.plannedFor}</Ltr>
          </dd>
        </div>
        <div className="flex gap-1.5">
          <dt className="text-muted-foreground">{t('runInfo.weightSet')}</dt>
          <dd>{t('runInfo.weightSetName', { name: fsi(reply.weightSet.name), version: fsi(reply.weightSet.version) })}</dd>
        </div>
        <div className="flex gap-1.5">
          <dt className="text-muted-foreground">{t('runInfo.plansChecked')}</dt>
          <dd>
            <Ltr>{formatFigure(reply.solve.plansChecked)}</Ltr>
          </dd>
        </div>
      </dl>
      <div className="flex flex-col gap-1 text-xs" data-run-stages="">
        <h3 className="font-semibold text-muted-foreground">{t('stages.title')}</h3>
        <dl className="flex flex-wrap gap-x-4 gap-y-1">
          {STAGE_NAMES.map((s) => (
            <div key={s} className="flex gap-1.5" data-run-stage={s}>
              <dt className="text-muted-foreground">{t(`stages.${s}`)}</dt>
              <dd className={s === 'total' ? 'font-semibold' : ''}>
                <Ltr>{t('stages.ms', { ms: formatFigure(reply.solve.ms[s]) })}</Ltr>
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  )
}
