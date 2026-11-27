/**
 * The read-back sentence under *Before you place it* (spec 983 D8, ticket 988): what
 * the agent says aloud to confirm the order before pressing *Place order*.
 *
 * The model is `read-back.ts`; this only draws it. Each clause is one `<Trans>` key
 * with named slots, so the words and their order are the translation's. Every slot is
 * a SELF-CONTAINED element — `<Trans>` drops a self-closing slot component's children,
 * so everything a slot draws arrives through its props.
 */
import type { ReactElement } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import type { SessionState } from '@/core/models/callcenter'
import Ltr from '@/core/ui/Ltr'
import Money from './Money'
import { readBack, type ReadBackLine, type ReadBackValue } from './read-back'

export default function ReadBack({ state }: { state: SessionState }) {
  const { t, i18n } = useTranslation('callcenter')
  const lang = i18n.language || 'en'
  const clauses = readBack(state, lang)
  return (
    <section aria-labelledby="cc-readback-heading" className="mt-4 border-t border-divider pt-3" data-cc-readback>
      <h2
        id="cc-readback-heading"
        className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
      >
        {t('readBack.heading')}
      </h2>
      {/* `dir="auto"`: the sentence is prose and reads in its own language's direction
          (HeaderSentence's reason) — an English fallback under an RTL page stays whole. */}
      <p dir="auto" className="mt-1.5 text-[13px] leading-6 text-foreground" data-cc-readback-sentence>
        {clauses.map((clause, index) => {
          const components: Record<string, ReactElement> = Object.fromEntries(
            Object.entries(clause.values).map(([slot, value]) => [slot, <Value key={slot} value={value} />]),
          )
          if (clause.lines) components.lines = <Lines lines={clause.lines} lang={lang} />
          return (
            <span key={clause.id} data-cc-readback-clause={clause.id}>
              {index > 0 && ' '}
              <Trans t={t} ns="callcenter" i18nKey={clause.key} components={components} />
            </span>
          )
        })}
      </p>
    </section>
  )
}

/** One value, isolated by its kind (`.claude/rules/bidi.md`). */
function Value({ value }: { value: ReadBackValue }) {
  if (value.kind === 'money')
    return (
      <Ltr>
        <Money value={value.amount} />
      </Ltr>
    )
  if (value.kind === 'ltr') return <Ltr>{value.text}</Ltr>
  return <bdi>{value.text}</bdi>
}

/**
 * The items as a list in the reader's language — "a, b and c", or the Arabic comma and
 * "و". The separators are `Intl.ListFormat`'s, never a literal; each element is one
 * whole line in `readBack.line`.
 */
function Lines({ lines, lang }: { lines: ReadBackLine[]; lang: string }) {
  const parts = new Intl.ListFormat(lang, { type: 'conjunction' }).formatToParts(lines.map((line) => line.name))
  let next = 0
  return (
    <>
      {parts.map((part, index) => {
        if (part.type !== 'element') return <span key={`sep-${index}`}>{part.value}</span>
        // ListFormat keeps the input order, so the elements are the lines in turn.
        const line = lines[next++]
        return <Line key={line.lineId} line={line} />
      })}
    </>
  )
}

function Line({ line }: { line: ReadBackLine }) {
  const { t } = useTranslation('callcenter')
  return (
    <span data-cc-readback-line={line.lineId}>
      <Trans
        t={t}
        ns="callcenter"
        i18nKey="readBack.line"
        components={{ qty: <QtyValue qty={line.qty} />, name: <NameValue name={line.name} /> }}
      />
    </span>
  )
}

const QtyValue = ({ qty }: { qty: string }) => <Ltr>{qty}</Ltr>
const NameValue = ({ name }: { name: string }) => <bdi>{name}</bdi>
