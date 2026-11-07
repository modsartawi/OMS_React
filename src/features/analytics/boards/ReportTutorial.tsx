import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Circle, CircleCheck, GraduationCap, Sparkles, X } from 'lucide-react'
import { useCopilotPanel } from '@/core/copilot-panel'
import type { AnalyticsModel } from '@/core/models/analytics'
import Button from '@/core/ui/Button'
import IconButton from '@/core/ui/IconButton'
import Ltr from '@/core/ui/Ltr'
import { formatCount } from '@/core/util/bidi'
import { currentStep, TUTORIAL_STEPS, tutorialChecks, type TutorialDraft } from './tutorial'

/**
 * The designer's tutorial (spec 819 §E, ticket 831): a checklist at the top of the inspector, opened by the
 * "Tutorial" action. Each step ticks itself from the draft (`./tutorial`); the step to do next says how.
 * "Load the finished report" is the way out (one undoable step). The last line is "Or ask the copilot": the
 * acceptance sentence, and — when the copilot is there for this user (832) — a button that asks it.
 */
export default function ReportTutorial({ draft, model, onLoad, onClose }: { draft: TutorialDraft; model: AnalyticsModel; onLoad: () => void; onClose: () => void }) {
  const { t } = useTranslation('boards')
  const [open, setOpen] = useState(true)
  const copilot = useCopilotPanel((s) => s.available)
  const ask = useCopilotPanel((s) => s.openPanel)
  const done = tutorialChecks(draft, model)
  const current = currentStep(done)
  const count = TUTORIAL_STEPS.filter((s) => done[s]).length
  return (
    <section className="flex flex-col rounded-lg border border-primary-border bg-card" aria-label={t('designer.tutorial.title')} data-designer-tutorial={current ?? 'done'}>
      <header className="flex items-center gap-2 border-b border-border p-3">
        <GraduationCap className="size-4 shrink-0 text-primary" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{t('designer.tutorial.title')}</p>
          <p className="text-[11px] text-muted-foreground">
            {t('designer.tutorial.progress')}{' '}
            <span data-designer-tutorial-progress>
              <Ltr>{formatCount(count, TUTORIAL_STEPS.length)}</Ltr>
            </span>
          </p>
        </div>
        <Button variant="text" onClick={() => setOpen(!open)} aria-expanded={open} data-designer-tutorial-toggle>
          {open ? t('designer.tutorial.hide') : t('designer.tutorial.show')}
        </Button>
        <IconButton label={t('designer.tutorial.close')} onClick={onClose} data-designer-tutorial-close>
          <X className="size-3.5" aria-hidden />
        </IconButton>
      </header>
      {open && (
        <div className="flex flex-col gap-1 p-3">
          {current === null && (
            <p className="mb-2 rounded-md bg-success-050 p-2 text-xs text-success-800" role="status" data-designer-tutorial-finished>
              {t('designer.tutorial.finished')}
            </p>
          )}
          <ol className="flex flex-col gap-1">
            {TUTORIAL_STEPS.map((s) => (
              <li key={s} className={`rounded-md p-1.5 ${s === current ? 'bg-primary-050' : ''}`} data-designer-tutorial-step={s} data-done={done[s] ? 'yes' : 'no'}>
                <p className="flex items-start gap-2 text-xs font-medium">
                  {done[s] ? <CircleCheck className="mt-px size-3.5 shrink-0 text-success-800" aria-hidden /> : <Circle className="mt-px size-3.5 shrink-0 text-muted-foreground" aria-hidden />}
                  <span className={done[s] ? 'text-muted-foreground line-through' : ''}>{t(`designer.tutorial.steps.${s}.title`)}</span>
                </p>
                {s === current && <p className="mt-1 ps-5 text-[11px] leading-snug text-muted-foreground">{t(`designer.tutorial.steps.${s}.how`)}</p>}
              </li>
            ))}
            <li className="rounded-md p-1.5" data-designer-tutorial-step="ask">
              <p className="flex items-start gap-2 text-xs font-medium">
                <Sparkles className="mt-px size-3.5 shrink-0 text-primary" aria-hidden />
                <span>{t('designer.tutorial.askTitle')}</span>
              </p>
              <p className="mt-1 ps-5 text-[11px] leading-snug text-muted-foreground">{t('designer.tutorial.askHow')}</p>
              <blockquote className="mt-1 ms-5 border-s-2 border-primary-border ps-2 text-[11px] leading-snug" data-designer-tutorial-sentence>
                {t('designer.tutorial.sentence')}
              </blockquote>
              {copilot && (
                <div className="mt-1 ps-5">
                  <Button variant="link" onClick={() => ask(t('designer.tutorial.sentence'))} data-designer-tutorial-ask>
                    {t('designer.tutorial.ask')}
                  </Button>
                </div>
              )}
            </li>
          </ol>
          <div className="mt-2 border-t border-border pt-2">
            <Button variant="outlined" onClick={onLoad} data-designer-tutorial-load>
              {t('designer.tutorial.load')}
            </Button>
            <p className="mt-1 text-[11px] text-muted-foreground">{t('designer.tutorial.loadHint')}</p>
          </div>
        </div>
      )}
    </section>
  )
}
