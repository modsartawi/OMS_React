import { useTranslation } from 'react-i18next'
import { describeCode, discTypeCodeDisplay, type CodeVocabulary } from './code-legend'
import { useLegend } from './LegendContext'

/**
 * A code from one of the nine closed vocabularies, rendered the one way this
 * screen renders codes (ticket 300, BackOffice 1392).
 *
 * 🔑 **The raw code, always, with the label as SECONDARY text — never the label
 * alone.** A consultant reads this screen with a SAP ticket open beside it and
 * needs the literal value to paste into it. Nothing here has a branch that
 * substitutes a friendly name for a code, and that absence is the component.
 *
 * 🚩 **Two placements, one rule.** `<CodeValue>` shows the label as visible text,
 * for a code that appears once per document. `<CodeMark>` carries it in the
 * `title`, for a code that repeats on every row — which is what 1381's prototype
 * settled and why: a label beside a chip on sixty rows is a wall of text that
 * stops being read, and the dotted underline is already this screen's established
 * mark for *hover me*. Both render the code itself.
 *
 * ⚠️ **No vocabulary is written down in this repo.** The label comes from the
 * legend the API generated off the pipeline's own constants; a code the legend
 * does not carry renders alone, and nothing is invented to fill the gap.
 */

/**
 * The one reading of *what can this screen say about this code* — the raw value,
 * and a label or nothing.
 *
 * 🔑 **`label` is `null` and never a stand-in.** Not the code echoed back, not a
 * dash, not a sentence about the legend being unavailable: a caller holding
 * `null` draws no tooltip and no hover affordance at all. Every code site on this
 * screen — the chips, the marks, the filter buttons, the document strip — reads
 * through here, so the hover story cannot drift one file at a time.
 *
 * A blank's wording is the locale file's, because a blank is a meaning the client
 * owns. A real code's is the legend's, which is server-supplied data and needs no
 * key of its own ([i18n-zero-literal](../../../../.claude/rules/i18n-zero-literal.md)).
 */
export function useCodeLabel(vocabulary: CodeVocabulary, code: string | null | undefined) {
  const { t } = useTranslation('reports')
  const display = describeCode(useLegend(), vocabulary, code)
  return {
    code: display.code,
    blank: display.blank,
    label: display.blank !== null ? t(`idocInspector.codes.blank.${display.blank}`) : display.label,
  }
}

export function CodeValue({
  vocabulary,
  code,
  className = '',
}: {
  vocabulary: CodeVocabulary
  code: string | null | undefined
  className?: string
}) {
  const { code: raw, label, blank } = useCodeLabel(vocabulary, code)

  return (
    <span className={`inline-flex items-baseline gap-1.5 ${className}`} data-code={raw}>
      <span className="font-mono font-bold tracking-wide">{raw}</span>
      {label === null ? null : (
        // ⚠️ Italic for a BLANK's meaning, plain for a real code's name. A blank is
        // the client saying what an absent value means, and it must not read as a
        // label the server sent.
        <span
          className={
            blank !== null ? 'text-[11px] italic text-ink-3' : 'text-[11px] text-muted-foreground'
          }
        >
          {label}
        </span>
      )}
    </span>
  )
}

/**
 * The same code, in a dense row: the value visible, the label on hover.
 *
 * Used for the codes that appear on every condition — the class and the control —
 * where a visible label would cost a column the expansion does not have and would
 * repeat itself down the whole table.
 */
export function CodeMark({
  vocabulary,
  code,
  className = '',
}: {
  vocabulary: CodeVocabulary
  code: string | null | undefined
  className?: string
}) {
  const { code: raw, label, blank } = useCodeLabel(vocabulary, code)

  // An absent code is nothing to mark. ⚠️ Only reachable where the blank carries
  // no meaning — a vocabulary whose `""` means something renders it through its
  // own component, so this early return cannot swallow one of those.
  if (raw === '' && blank === null) return null

  // ⚠️ **No label ⇒ no tooltip and no hover affordance.** A `title` echoing the
  // code back promises an explanation and delivers the thing being explained,
  // which is the invention `code-legend` forbids, dressed as an answer.
  return (
    <span
      data-code-mark={`${vocabulary}:${raw}`}
      title={label ?? undefined}
      className={`border-b border-dotted border-ink-3 font-mono text-[10px] font-bold text-ink-3 ${
        label === null ? '' : 'cursor-help'
      } ${className}`}
    >
      {raw}
    </span>
  )
}

/**
 * The SAP posting code a condition was mapped to — **the blank the legend
 * deliberately does not carry** (ticket 300, BackOffice 1392).
 *
 * ⚠️ **Empty means no mapping was found, and that is a DEFECT** — not *no error*
 * (that is the error-type vocabulary's blank) and not *provenance unknown* (that
 * is the source tag's). One character on the wire, three meanings, and one grey
 * dash for all of them is misinformation — so this one is drawn in attention ink
 * and says what it means.
 *
 * 🚩 It has no legend entry and must not get one: `discTypeCode` is derived from a
 * mapping each billing type may override, so a closed list of it could disagree
 * with what was actually posted — and a stored-versus-map disagreement is a
 * finding, not a label. It lives here beside the other two code renderers rather
 * than inside the table that draws it, so the screen has one place codes are
 * rendered and not two.
 */
export function DiscTypeCode({ code }: { code: string }) {
  const { t } = useTranslation('reports')
  const display = discTypeCodeDisplay(code)
  if (display.kind === 'code') return <>{display.code}</>
  return (
    <span
      data-disc-type="unmapped"
      title={t('idocInspector.codes.blank.discTypeHint')}
      className="cursor-help font-sans text-[11px] italic text-attention-800"
    >
      {t('idocInspector.codes.blank.discType')}
    </span>
  )
}
