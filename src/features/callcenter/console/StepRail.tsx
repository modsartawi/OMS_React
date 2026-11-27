/**
 * The step rail above the item search (spec 983 D3, ticket 984): Caller · Items ·
 * Fulfilment · Payment · Review. Each step shows its own answer, is green when done and
 * amber while missing, and a click focuses its section. The model is `step-rail.ts`;
 * this only draws it, so nothing here decides what "done" means.
 */
import { useTranslation } from 'react-i18next'
import { Check, CircleDashed } from 'lucide-react'
import Ltr from '@/core/ui/Ltr'
import { fsi } from '@/core/util/bidi'
import { formatNumber } from '@/core/util/number-format'
import type { RailSegment, RailStep } from './step-rail'

export default function StepRail({ steps, onStep }: { steps: RailStep[]; onStep: (step: RailStep) => void }) {
  const { t } = useTranslation('callcenter')
  return (
    <nav
      aria-label={t('rail.label')}
      className="shrink-0 border-b border-divider bg-card px-4 py-2"
      data-cc-rail
    >
      <ol className="grid grid-cols-5 gap-1.5">
        {steps.map((step, index) => {
          const done = step.state === 'done'
          return (
            <li key={step.id} className="min-w-0">
              {/* A two-line tile (name over its answer) that moves focus to its
                  section — a picker, not a command. */}
              <button
                type="button"
                onClick={() => onStep(step)}
                data-cc-rail-step={step.id}
                data-cc-rail-state={step.state}
                className={`flex h-full w-full min-w-0 flex-col items-start rounded-md border px-2 py-1 text-start ${
                  done
                    ? 'border-success-border bg-success-050 text-success-800'
                    : 'border-attention-border bg-attention-050 text-attention-800'
                }`}
              >
                <span className="flex w-full min-w-0 items-center gap-1 text-[11px] font-semibold uppercase tracking-wide">
                  {done ? (
                    <Check className="h-3 w-3 shrink-0" aria-hidden />
                  ) : (
                    <CircleDashed className="h-3 w-3 shrink-0" aria-hidden />
                  )}
                  <span className="truncate">
                    <Ltr>{formatNumber(index + 1)}</Ltr> {t(`rail.steps.${step.id}`)}
                  </span>
                  <span className="sr-only">{t(`rail.state.${step.state}`)}</span>
                </span>
                <span className="w-full min-w-0 truncate text-xs text-foreground" data-cc-rail-answer>
                  {step.answer.map((segment, i) => (
                    <span key={i}>
                      {i > 0 && ' · '}
                      <Segment segment={segment} />
                    </span>
                  ))}
                </span>
              </button>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

function Segment({ segment }: { segment: RailSegment }) {
  const { t } = useTranslation('callcenter')
  if (segment.kind === 'text')
    return segment.isolate === 'ltr' ? <Ltr>{segment.text}</Ltr> : <bdi>{segment.text}</bdi>
  // A count interpolated into a sentence is isolated whole (`fsi`, bidi rule).
  return (
    <>
      {segment.count != null
        ? t(segment.key, { count: segment.count, n: fsi(formatNumber(segment.count)) })
        : t(segment.key)}
    </>
  )
}
