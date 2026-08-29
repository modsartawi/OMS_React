import { useTranslation } from 'react-i18next'
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
 * it exists for. Ticket 300 hangs the legend's label beside it.
 */
export function SourceTagChip({ tag }: { tag: string }) {
  const { t } = useTranslation('reports')
  const display = sourceTagDisplay(tag)

  if (display.kind === 'unknown') {
    return (
      <span
        data-source-tag="unknown"
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
      className="inline-flex items-center rounded-full border border-primary-border bg-primary-050 px-1.5 py-0.5 font-mono text-[10px] font-bold tracking-wide text-primary-800"
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
 * The letter renders raw with the code in its `title`; ticket 300's legend turns
 * that into the sentence the constant actually means.
 */
export function ConditionProvenance({ tag, source }: { tag: string; source: string }) {
  const { t } = useTranslation('reports')
  const origin = (source ?? '').trim()
  return (
    <span className="inline-flex items-center gap-1.5">
      <SourceTagChip tag={tag} />
      {origin === '' ? null : (
        <span
          data-condition-source={origin}
          title={t('idocInspector.provenance.conditionSource', { code: origin })}
          className="cursor-help border-b border-dotted border-ink-3 font-mono text-[10px] font-bold text-ink-3"
        >
          {origin}
        </span>
      )}
    </span>
  )
}
