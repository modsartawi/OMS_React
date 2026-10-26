import type { ReactElement, ReactNode } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { moneyText, percentText, saysIn, type Sentence, type SentenceValue } from '@/core/rules/sentence'
import Ltr from '@/core/ui/Ltr'
import { formatDay } from '@/core/util/date-format'
import { formatNumber } from '@/core/util/number-format'
import type { ConditionNode } from './sentence'

/**
 * One sentence of `./sentence` (ticket 607), rendered whole from the `insurance-rules` bundle through
 * <Trans>, each value in its own slot isolated by kind — a machine value (number, money, code, day) in
 * `Ltr`, a list's EN/AR name in `<bdi>` (.claude/rules/bidi.md). A slot tag is the value's key lower-cased;
 * its text is left empty and the slot component draws the value, so data never passes through markup.
 * The insurance twin of the campaigns workspace's SentenceView (a feature may not import another).
 */
export default function GuardSentenceView({ s }: { s: Sentence }) {
  const { t, i18n } = useTranslation('insurance-rules')
  if ('template' in s) return <bdi>{saysIn(s.template, i18n.language)}</bdi>
  const values: Record<string, string> = {}
  const components: Record<string, ReactElement> = {}
  for (const [key, value] of Object.entries(s.values)) {
    if (!(key === 'count' && s.count !== undefined)) values[key] = ''
    components[key.toLowerCase()] = <ValueSlot value={value} />
  }
  return <Trans t={t} i18nKey={s.key} values={values} count={s.count} components={components} />
}

/** The IF tree: a group's heading and its conditions indented under it; NOT is already in the words. */
export function ConditionTree({ nodes, depth = 0 }: { nodes: readonly ConditionNode[]; depth?: number }) {
  return (
    <ul className={depth ? 'ms-5 mt-1 flex flex-col gap-1 border-s border-border/60 ps-3' : 'flex flex-col gap-1'} data-conditions={depth}>
      {nodes.map((n, i) => (
        <li key={i} data-check={n.check} data-not={n.not ? 'true' : 'false'}>
          <span data-sentence="">
            <GuardSentenceView s={n.sentence} />
          </span>
          {n.clauses.map((c, j) => (
            <span key={j} className="text-muted-foreground" data-clause="">
              {'; '}
              <GuardSentenceView s={c} />
            </span>
          ))}
          {n.children && <ConditionTree nodes={n.children} depth={depth + 1} />}
        </li>
      ))}
    </ul>
  )
}

const TOKEN = 'rounded bg-muted px-1 font-medium'

function ValueSlot({ value }: { value: SentenceValue; children?: ReactNode }) {
  const { t, i18n } = useTranslation('insurance-rules')
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
        <span className={TOKEN} data-value="name">
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
      return <GuardSentenceView s={value.sentence} />
    case 'list': {
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
