import type { ReactElement, ReactNode } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { moneyText, percentText, saysIn, templateParts, type Sentence, type SentenceValue } from '@/core/rules/sentence'
import Ltr from '@/core/ui/Ltr'
import { formatDay } from '@/core/util/date-format'
import { formatNumber } from '@/core/util/number-format'

/**
 * One sentence of `@/core/rules/sentence`, rendered whole (ticket 504): its template from the
 * `campaign-workspace` bundle through <Trans>, each value in its own slot, isolated by kind — a
 * machine value (money, count, code, formula, day) in `Ltr`, a name in `<bdi>` (.claude/rules/bidi.md).
 *
 * A slot tag is the field's key, lower-cased (`<withindays>`), because the template's tags are
 * matched as written. The slot's text is left EMPTY and its component draws the value: data never
 * passes through the template's markup, so a formula such as `a<b` cannot be read as a tag. A
 * plural sentence's number comes in through `count`.
 */
export default function SentenceView({ s }: { s: Sentence }) {
  const { t, i18n } = useTranslation('campaign-workspace')
  if ('template' in s)
    // HQ's own words (a catalogue block's sentence): free text from data, isolated whole (bidi.md),
    // its braced fields slots inside it.
    return (
      <bdi>
        {templateParts(saysIn(s.template, i18n.language)).map((p, i) =>
          'text' in p ? <span key={i}>{p.text}</span> : s.values[p.slot] ? <ValueSlot key={i} value={s.values[p.slot]} /> : null,
        )}
      </bdi>
    )
  const values: Record<string, string> = {}
  const components: Record<string, ReactElement> = {}
  for (const [key, value] of Object.entries(s.values)) {
    // A slot named `count` in a plural sentence is the `count` prop's: a string there would
    // shadow the number and lose the plural.
    if (!(key === 'count' && s.count !== undefined)) values[key] = ''
    components[key.toLowerCase()] = <ValueSlot value={value} />
  }
  return <Trans t={t} i18nKey={s.key} values={values} count={s.count} components={components} />
}

const TOKEN = 'rounded bg-muted px-1 font-medium'

/** One value, isolated by its kind. `children` (the template's text for the slot) is replaced. */
function ValueSlot({ value }: { value: SentenceValue; children?: ReactNode }) {
  const { t, i18n } = useTranslation('campaign-workspace')
  switch (value.kind) {
    case 'money':
      return (
        <span className={TOKEN} data-value="money">
          <Ltr>{moneyText(value)}</Ltr>
        </span>
      )
    case 'number':
    case 'percent':
      return (
        <span className={TOKEN} data-value={value.kind}>
          <Ltr>{value.kind === 'percent' ? percentText(value.n, t) : formatNumber(value.n)}</Ltr>
        </span>
      )
    case 'code':
    case 'formula':
      return (
        <code className={`${TOKEN} font-mono text-[0.92em]`} data-value={value.kind}>
          <Ltr>{value.kind === 'code' ? value.code : value.formula}</Ltr>
        </code>
      )
    case 'day':
      return (
        <span className={TOKEN} data-value="day">
          <Ltr>{formatDay(value.day)}</Ltr>
        </span>
      )
    case 'name':
      return (
        <span className={`${TOKEN} font-mono text-[0.92em]`} data-value="name">
          <bdi>{value.name}</bdi>
        </span>
      )
    case 'says':
      return (
        <span className={TOKEN} data-value="says">
          <bdi>{saysIn(value.says, i18n.language)}</bdi>
        </span>
      )
    case 'phrase':
      return <SentenceView s={value.sentence} />
    case 'list': {
      // The joining words are the locale's own (Intl), each item isolated by its own kind.
      const parts = new Intl.ListFormat(i18n.language, { type: value.join === 'and' ? 'conjunction' : 'disjunction' }).formatToParts(
        value.items.map((_, i) => String(i)),
      )
      return (
        <>
          {parts.map((p, i) => (p.type === 'element' ? <ValueSlot key={i} value={value.items[Number(p.value)]} /> : <span key={i}>{p.value}</span>))}
        </>
      )
    }
  }
}
