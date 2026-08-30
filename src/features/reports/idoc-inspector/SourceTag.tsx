import { useTranslation } from 'react-i18next'
import { useCodeLabel } from './CodeValue'
import { sourceTagDisplay } from './provenance'

/**
 * The provenance column — **one column**, on every line row and every condition
 * row (ticket 297, BackOffice 1381).
 *
 * 🔑 **`""` is a dimmed *unknown*, never `pos`.** The ledger's source-provenance
 * convention defaults an untagged row to POS and the API deliberately does not
 * apply it, so that a provenance bug cannot disguise itself as ordinary data.
 * This component is the last place that default could sneak back in, and it is
 * the reason `sourceTagDisplay` is a tested pure function rather than a ternary
 * inline here.
 *
 * 🚩 **The raw code, always.** A consultant pastes this into a SAP ticket, so a
 * friendly name INSTEAD of the code would make the screen unusable for the job
 * it exists for. Ticket 300 hangs the legend's label in the chip's `title` — on
 * hover rather than beside it, because this chip repeats on every line and every
 * condition, and 1381 settled that a label on sixty rows is a wall of text that
 * stops being read.
 *
 * ⚠️ The label is the LEGEND's, generated off the pipeline's own constants; the
 * *unknown* wording is the locale file's, because an empty tag is a meaning this
 * client owns and not a member the server ships. A tag the legend does not carry
 * shows the code with no title at all — nothing is invented.
 */
export function SourceTagChip({ tag }: { tag: string }) {
  const { t } = useTranslation('reports')
  const display = sourceTagDisplay(tag)
  const { label } = useCodeLabel('sourceTag', tag)

  if (display.kind === 'unknown') {
    return (
      <span
        data-source-tag="unknown"
        // ⚠️ `""` in the source-tag vocabulary is *provenance unknown* and never
        // *no error* — one of the three empty strings whose meanings must not be
        // collapsed into one grey dash.
        title={t('idocInspector.provenance.unknownHint')}
        className="inline-flex items-center rounded-full border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] font-bold italic tracking-wide text-ink-3"
      >
        {t('idocInspector.provenance.unknown')}
      </span>
    )
  }
  return (
    <span
      data-source-tag={display.code}
      data-source-tag-label={label ?? undefined}
      // The legend's own name for the tag, passed through as the data it is —
      // server text needs no key of its own. No label ⇒ no tooltip at all.
      title={label ?? undefined}
      className={`inline-flex items-center rounded-full border border-primary-border bg-primary-050 px-1.5 py-0.5 font-mono text-[10px] font-bold tracking-wide text-primary-800 ${
        label === null ? '' : 'cursor-help'
      }`}
    >
      {display.code}
    </span>
  )
}

/**
 * A condition's provenance: its tag, and its own origin **beside** it as a small
 * marked letter.
 *
 * 🔑 **The origin is not a second column, and that is a decision.** Outside
 * `sourceTag = pos` it is a near-constant `M` — every synthetic condition goes
 * through the same minting call — so a column of its own would be a wall of one
 * letter, inviting the consultant to read *keyed by hand* on every row. Beside
 * the tag, the two never compete for the same eye.
 *
 * The letter renders raw and its `title` carries the legend's name for it —
 * ticket 300's whole rule, in the one place a code was already a mark rather than
 * a column.
 *
 * ⚠️ An empty origin draws NOTHING, and that is deliberate rather than an
 * oversight. `""` in this vocabulary means *the engine stamped no origin*, which
 * is a different fact from the tag's *provenance unknown* beside it — and a
 * second dimmed mark on the same row saying a second kind of nothing would read
 * as one fact told twice.
 */
export function ConditionProvenance({ tag, source }: { tag: string; source: string }) {
  const { t } = useTranslation('reports')
  const origin = useCodeLabel('conditionSource', source)
  return (
    <span className="inline-flex items-center gap-1.5">
      <SourceTagChip tag={tag} />
      {origin.code === '' ? null : (
        <span
          data-condition-source={origin.code}
          // ⚠️ No title when the legend carries no name for this origin — in
          // flight, refused, or a code older than its constant. A tooltip
          // asserting there is no label would be a claim about the DEPLOYMENT
          // made from a fetch that may simply not have landed, and the chip
          // beside it already answers the same case by staying silent.
          title={
            origin.label === null
              ? undefined
              : t('idocInspector.provenance.conditionSource', {
                  code: origin.code,
                  label: origin.label,
                })
          }
          className={`border-b border-dotted border-ink-3 font-mono text-[10px] font-bold text-ink-3 ${
            origin.label === null ? '' : 'cursor-help'
          }`}
        >
          {origin.code}
        </span>
      )}
    </span>
  )
}
