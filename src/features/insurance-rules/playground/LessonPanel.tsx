import { useState } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'

import Button from '@/core/ui/Button'
import Field from '@/core/ui/Field'
import Select from '@/core/ui/Select'
import { fsi } from '@/core/util/bidi'
import { lessonCheck, type LessonAnswer, type LessonCheck, type LessonDifference } from './lesson-check'
import { LESSONS, lessonById, type Lesson } from './lessons'

/**
 * The playground's **Lessons** (BackOffice spec 3243 stories 45-47; oms ticket 689): pick a lesson and **load** it as
 * the current experiment (the page's `loadExperiment`), read its explanation, and **Check** the door's latest answer
 * against the lesson's assertion — met, or each expectation that differs, said in words. Editing a loaded lesson is
 * allowed; Check then judges the edited experiment's answer. A result is shown only for the answer it judged: once a
 * newer answer arrives, Check is pressed again.
 */
export default function LessonPanel({
  lessonId,
  answer,
  pending,
  onLoad,
}: {
  /** The loaded lesson; null when none is (or the experiment was replaced). */
  lessonId: string | null
  /** The latest answer, read by the Outcome pane's view models; null while there is none. */
  answer: LessonAnswer | null
  pending: boolean
  onLoad: (lesson: Lesson) => void
}) {
  const { t } = useTranslation('insurance-playground')
  const [picked, setPicked] = useState('')
  const [checked, setChecked] = useState<{ judged: LessonAnswer; result: LessonCheck } | null>(null)
  const lesson = lessonId ? lessonById(lessonId) : undefined
  const result = checked && answer && checked.judged === answer ? checked.result : null
  const waitReason = !answer || pending ? t('lessons.checkWait') : null

  const load = () => {
    const l = lessonById(picked)
    if (!l) return
    setChecked(null)
    onLoad(l)
  }
  const check = () => {
    if (!lesson || !answer || pending) return
    setChecked({ judged: answer, result: lessonCheck(lesson.expects, answer) })
  }

  return (
    <section className="flex flex-col gap-2 rounded-lg border border-border/60 bg-card p-3" data-lessons="" data-lesson={lessonId ?? undefined}>
      <div className="flex flex-wrap items-end gap-3">
        <Field label={t('lessons.pick')} className="w-80">
          <Select value={picked} onChange={(e) => setPicked(e.target.value)} data-lesson-picker="">
            <option value="">{t('lessons.none')}</option>
            {LESSONS.map((l) => (
              <option key={l.id} value={l.id}>
                {t(`lessons.items.${l.id}.title`)}
              </option>
            ))}
          </Select>
        </Field>
        <Button variant="secondary" onClick={load} aria-disabled={!picked || undefined} title={!picked ? t('lessons.pickFirst') : undefined} data-lesson-load="">
          {t('lessons.load')}
        </Button>
        <p className="min-w-0 flex-1 text-xs text-muted-foreground">{t('lessons.hint')}</p>
      </div>

      {lesson && (
        <div className="flex flex-col gap-2 border-t border-border/60 pt-2" data-lesson-loaded={lesson.id}>
          <h2 className="text-sm font-semibold">{t(`lessons.items.${lesson.id}.title`)}</h2>
          <p className="max-w-4xl text-sm leading-relaxed" data-lesson-explain="">
            <Trans t={t} i18nKey={`lessons.items.${lesson.id}.explain`} components={{ c: <bdi dir="ltr" className="font-mono text-xs" /> }} />
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="primary" onClick={check} aria-disabled={!!waitReason || undefined} title={waitReason ?? t('lessons.checkHint')} data-lesson-check="">
              {t('lessons.check')}
            </Button>
            {result?.met && (
              <p className="text-sm text-success-800" role="status" data-lesson-result="met">
                {t('lessons.met')}
              </p>
            )}
          </div>
          {result && !result.met && (
            <div className="flex flex-col gap-1 text-sm" role="status" data-lesson-result="notMet">
              <p className="font-medium text-danger-800">{t('lessons.notMet')}</p>
              <ul className="list-disc ps-5">
                {result.differences.map((d, i) => (
                  <li key={i} data-lesson-difference={d.expect.expect}>
                    {differenceText(t, d)}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  )
}

type Word = 'nothing' | 'absent' | 'blank' | 'yes' | 'no' | 'none'

/** One difference in words; every value is data in a `t()` sentence, so each is wrapped whole in `fsi`. */
function differenceText(t: TFunction<'insurance-playground'>, d: LessonDifference): string {
  const word = (w: Word) => t(`lessons.word.${w}`)
  const lines = (v: unknown) => (v === undefined ? word('absent') : v === null ? word('nothing') : (v as number[]).join(', '))
  const traceValue = (v: unknown) => (v === undefined ? word('absent') : t(`trace.value.${String(v)}`))
  const value = (v: unknown) =>
    v === undefined
      ? word('absent')
      : v === null
        ? word('blank')
        : typeof v === 'boolean'
          ? word(v ? 'yes' : 'no')
          : Array.isArray(v)
            ? v.length
              ? v.join(', ')
              : word('none')
            : String(v)
  const say = (key: string, values: Record<string, string | number>) =>
    t(`lessons.diff.${key}`, Object.fromEntries(Object.entries(values).map(([k, v]) => [k, fsi(String(v))])))

  const e = d.expect
  switch (e.expect) {
    case 'matched':
      return say('matched', { want: lines(e.lines), got: lines(d.got) })
    case 'trace':
      return say('trace', { line: e.line, ruleId: e.ruleId, blockPath: e.blockPath, want: traceValue(e.value), got: traceValue(d.got) })
    case 'verdict': {
      const valueSays = say('verdict', { line: e.line, field: e.field, want: value(e.value), got: value(d.got) })
      if (d.gotRuleId === undefined) return valueSays
      const ruleSays = say('verdictRule', { line: e.line, field: e.field, want: e.ruleId ?? word('none'), got: d.gotRuleId ?? word('none') })
      return JSON.stringify(e.value) === JSON.stringify(d.got) ? ruleSays : `${valueSays} ${ruleSays}`
    }
    case 'ignored':
      if (d.got === undefined) return say('ignoredMissing', { path: e.path })
      return say('ignoredHint', { path: e.path, want: e.hint ?? word('none'), got: d.got === null ? word('none') : String(d.got) })
  }
}
