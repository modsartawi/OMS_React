import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import Textarea from '@/core/ui/Textarea'
import type { ExperimentBox } from './boxes'

/**
 * One JSON box of the experiment (ticket 677): the Data pane's `data`, or the Rule pane's `document`. JSON is a
 * machine value, typed left to right. When it does not parse it is said in words and the page sends nothing.
 * 679 and 682 put the editors and the form beside this box; the box stays the source of truth they sync with.
 * `tabs` draws a tab bar under the title, and `children`, when given, takes the box's place (684's Raw tab).
 */
export function JsonPane({
  box,
  title,
  hint,
  value,
  onChange,
  invalid,
  tabs,
  before,
  after,
  children,
}: {
  box: ExperimentBox
  title: string
  hint: string
  value: string
  onChange: (text: string) => void
  invalid: boolean
  tabs?: ReactNode
  /** Drawn above the box (679's ruleset editors, which stay in step with it). */
  before?: ReactNode
  /** Drawn under the box (685's Flatten panel). */
  after?: ReactNode
  children?: ReactNode
}) {
  const { t } = useTranslation('insurance-playground')
  const id = `playground-${box}`
  return (
    <section className="flex min-w-0 flex-col gap-2 rounded-lg border border-border/60 bg-card p-4" data-pane={box}>
      <h2 className="text-base font-semibold tracking-tight">
        <label htmlFor={id}>{title}</label>
      </h2>
      {tabs}
      <p className="text-xs text-muted-foreground">{hint}</p>
      {before}
      {children ?? (
        <>
          <Textarea
            id={id}
            className="min-h-96 w-full font-mono text-xs"
            dir="ltr"
            spellCheck={false}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            aria-invalid={invalid ? true : undefined}
            data-json-box={box}
          />
          {invalid && (
            <p className="text-xs text-danger-800" role="alert" data-json-problem={box}>
              {t(`json.problem.${box}`)}
            </p>
          )}
        </>
      )}
      {after}
    </section>
  )
}
