import { useTranslation } from 'react-i18next'

/** A source code of 4281's source family (decision 29), or one of the run's own words: codes are upper snake case. */
export const isSourceCode = (source: string | null | undefined): source is string => !!source && /^[A-Z][A-Z_]*$/.test(source)

/**
 * Where a figure came from (ticket 965; 4281 decision 29, the source family): the screen's words for the code, in a
 * pill. An assumed figure wears the attention look, so the assumed ones stand out (spec 4354 §6). A source the server
 * sent as its own words is free text (`<bdi>`).
 */
export default function SourcePill({ source }: { source: string | null | undefined }) {
  const { t } = useTranslation('sourcing-simulator')
  if (!source) return null
  const assumed = source === 'ASSUMED'
  return (
    <span
      className={
        'inline-block rounded-full border px-1.5 py-px text-[11px] font-normal whitespace-nowrap ' +
        (assumed ? 'border-attention-border bg-attention-050 text-attention-800' : 'border-border text-muted-foreground')
      }
      data-source={source}
    >
      {isSourceCode(source) ? t(`why.source.${source}`, { defaultValue: source }) : <bdi>{source}</bdi>}
    </span>
  )
}
