import { useTranslation } from 'react-i18next'
import type { IDocInspectorLine } from '@/core/models/idoc-inspector'
import { useCodeLabel } from './CodeValue'
import { mintedByTags, sourceTagDisplay } from './provenance'
import Button from '@/core/ui/Button'
import Chip from '@/core/ui/Chip'

/**
 * The provenance filter bar (ticket 297, BackOffice 1381).
 *
 * 🔑 **One bar, on the source TAG only.** There is deliberately no filter on the
 * condition's own source: outside `pos` it is a near-constant, so there would be
 * nothing to filter by.
 *
 * 🚩 It draws nothing when the document has **fewer than two** distinct tags. A
 * single-tag bar cannot narrow anything — every row already carries that tag —
 * so it would be one button that does nothing and a Clear beside it.
 */
export default function MintedByFilter({
  lines,
  filterTag,
  onFilter,
}: {
  lines: IDocInspectorLine[]
  filterTag: string | null
  onFilter: (tag: string | null) => void
}) {
  const { t } = useTranslation('reports')
  const tags = mintedByTags(lines)
  if (tags.length < 2) return null

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        {t('idocInspector.provenance.filterLabel')}
      </span>
      {tags.map((tag) => (
        <TagFilterButton
          key={tag === '' ? '__unknown__' : tag}
          tag={tag}
          active={filterTag === tag}
          onFilter={onFilter}
        />
      ))}
      {filterTag !== null && (
        <Button type="button" variant="outlined" data-minted-by-clear onClick={() => onFilter(null)}>
          {t('idocInspector.provenance.clearFilter')}
        </Button>
      )}
    </div>
  )
}

/**
 * One tag's button.
 *
 * 🚩 **A once-per-document render site of the same vocabulary the row chips draw,
 * so it carries the same label** (ticket 300): the raw tag on the face, its
 * legend name on hover. Without it this bar would be the one place a consultant
 * meets a code the screen refuses to explain.
 *
 * A component rather than a branch inside the `map`, because the label is read
 * through a hook and a hook cannot be called in a loop.
 */
function TagFilterButton({
  tag,
  active,
  onFilter,
}: {
  tag: string
  active: boolean
  onFilter: (tag: string | null) => void
}) {
  const { t } = useTranslation('reports')
  const display = sourceTagDisplay(tag)
  const { label, blank } = useCodeLabel('sourceTag', tag)

  return (
    <Chip
      on={active}
      // 🚩 The empty tag gets a button of its own — *unknown* is precisely what a
      // consultant hunting a provenance bug filters for.
      data-minted-by={tag === '' ? 'unknown' : tag}
      // ⚠️ The blank gets the chip's own fuller sentence, not the legend's bare
      // name for it: an empty tag is *provenance unknown, and never `pos`*, and
      // that is the one thing this button exists to let a consultant chase.
      title={blank !== null ? t('idocInspector.provenance.unknownHint') : (label ?? undefined)}
      onClick={() => onFilter(active ? null : tag)}
      className="font-mono"
    >
      {display.kind === 'unknown' ? t('idocInspector.provenance.unknown') : display.code}
    </Chip>
  )
}
