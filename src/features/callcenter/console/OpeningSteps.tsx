/**
 * *This order is ready for its caller* — the sequence card 175's variant 4 asks
 * for, drawn while the item gate is shut and gone the moment it opens.
 *
 * It sits under the chip row, in the centre column, in the space the item search
 * would otherwise occupy on an order nothing may go into yet. Two properties it
 * exists to hold, and both are about what it is NOT:
 *
 * 1. 🚩 **It is not furniture.** `opening-steps.ts` returns an empty list the
 *    instant the door will accept an item, and this component draws nothing for
 *    an empty list. An agent on their ninth hour sees it on the first seconds of
 *    a call and never again until the next one — which is the whole objection to
 *    v1's permanent ladder.
 * 2. 🚩 **It states no rule of its own.** Every tick is the door's
 *    `submitBlockers`; every row's words are the same act the surface it points
 *    at performs. It has no controls: the rail is where a caller is attached and
 *    the chip above is where a store is chosen, and a third door into either
 *    would be a second place for the same act to be got wrong.
 */
import { useTranslation } from 'react-i18next'
import { Check } from 'lucide-react'
import type { OpeningStep } from './opening-steps'

export default function OpeningSteps({ steps }: { steps: OpeningStep[] }) {
  const { t } = useTranslation('callcenter')
  if (steps.length === 0) return null
  return (
    <div className="shrink-0 border-b border-divider bg-card-2 px-4 py-4" data-cc-steps>
      <h2 className="mb-3 text-sm font-semibold tracking-tight">{t('steps.title')}</h2>
      <ol className="space-y-2">
        {steps.map((step, index) => (
          <li
            key={step.id}
            className="flex items-baseline gap-2.5"
            data-cc-step={step.id}
            data-cc-step-done={step.done ? '' : undefined}
          >
            <span
              aria-hidden
              className={`flex size-5 shrink-0 translate-y-0.5 items-center justify-center rounded-full text-[11px] font-semibold ${
                step.done ? 'bg-success-050 text-success-800' : 'bg-muted text-muted-foreground'
              }`}
            >
              {step.done ? <Check className="h-3 w-3" /> : index + 1}
            </span>
            {/* 🚩 A done step keeps its words rather than disappearing: the card
                is a sequence, and a sequence that loses its first row as it is
                followed re-numbers itself under the agent's eye. */}
            <span
              className={`text-sm ${step.done ? 'text-muted-foreground line-through' : 'font-medium'}`}
            >
              {t(`steps.${step.key}.label`)}
            </span>
            <span className="text-xs text-muted-foreground">{t(`steps.${step.key}.hint`)}</span>
          </li>
        ))}
      </ol>
    </div>
  )
}
