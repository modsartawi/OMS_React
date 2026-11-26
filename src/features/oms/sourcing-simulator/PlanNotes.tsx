import { useState } from 'react'
import Button from '@/core/ui/Button'
import Ltr from '@/core/ui/Ltr'
import { fsi } from '@/core/util/bidi'
import { formatFigure } from '@/core/util/number-format'
import type { HiddenPlanNote, PlanNotes as Notes } from './plans-list-model'
import { usePlanWords } from './use-plan-words'

const HIDDEN_CODES = new Set(['NEARLY_SAME', 'WORSE_ON_EVERYTHING', 'OVER_MOST_SHOWN'])

/**
 * Under the plans (ticket 962, spec 4354 §3): each goal with no plan, with the server's sentence and its code, and the
 * hidden plans behind a "show" link, each with the screen's sentence for its code.
 */
export default function PlanNotes({ notes }: { notes: Notes }) {
  const w = usePlanWords()
  const { t } = w
  const [open, setOpen] = useState(false)
  if (notes.noPlan.length === 0 && notes.hidden.length === 0) return null
  return (
    <section className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4 text-xs" data-plan-notes="">
      {notes.noPlan.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {notes.noPlan.map((n) => (
            <li key={n.goal} className="flex flex-col" data-no-plan={n.goal} data-no-plan-code={n.code}>
              <span className="font-medium">{t('notes.noPlan', { goal: w.goal(n.goal) })}</span>
              <span className="flex flex-wrap items-center gap-2 text-muted-foreground">
                <bdi>{w.said(n.sentence)}</bdi>
                <code className="font-mono text-[11px]">
                  <Ltr>{n.code}</Ltr>
                </code>
              </span>
            </li>
          ))}
        </ul>
      )}
      {notes.hidden.length > 0 && (
        <div className="flex flex-col gap-1.5" data-hidden-plans={open ? 'open' : 'closed'}>
          <Button variant="text" className="self-start" aria-expanded={open} onClick={() => setOpen(!open)} data-hidden-toggle="">
            {open ? t('notes.hide') : t('notes.show', { count: fsi(formatFigure(notes.hidden.length)) })}
          </Button>
          {open && (
            <ul className="flex flex-col gap-1.5">
              {notes.hidden.map((h) => (
                <HiddenPlan key={h.goal} h={h} />
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  )
}

function HiddenPlan({ h }: { h: HiddenPlanNote }) {
  const w = usePlanWords()
  const { t } = w
  const as = h.as ? w.goal(h.as) : ''
  const why = HIDDEN_CODES.has(h.code)
    ? t(`notes.hiddenAs.${h.code}`, {
        as,
        minutes: fsi(formatFigure(h.minutesApart)),
        riyals: fsi(w.money(h.riyalsApart)),
      })
    : t('notes.hiddenAs.unknown')
  return (
    <li className="flex flex-col" data-hidden-plan={h.goal} data-hidden-code={h.code}>
      <span className="font-medium">{h.plan ? <bdi>{w.said(h.plan.label)}</bdi> : w.goal(h.goal)}</span>
      <span className="flex flex-wrap items-center gap-2 text-muted-foreground">
        <span>{why}</span>
        <code className="font-mono text-[11px]">
          <Ltr>{h.code}</Ltr>
        </code>
      </span>
      {h.plan && (
        <span className="text-muted-foreground">
          <bdi>{w.said(h.plan.promise)}</bdi>
        </span>
      )}
    </li>
  )
}
