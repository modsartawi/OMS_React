import { X } from 'lucide-react'
import { Trans, useTranslation } from 'react-i18next'
import type { AnalyticsModel } from '@/core/models/analytics'
import Button from '@/core/ui/Button'
import { fsi } from '@/core/util/bidi'
import type { CrossFilter } from './effective-query'
import { memberLabel } from './PanelDrill'
import { labelIn } from './view-model'

/**
 * The board's cross-filter, said in words under the strip (ticket 772): "Filtered by Store: P001", with a
 * clear. Clicking the same mark again clears it too; this is the way back when the mark is out of sight
 * (its panel drilled away from it, or scrolled off).
 */
export default function CrossFilterChip({ cross, model, lang, onClear }: { cross: CrossFilter; model: AnalyticsModel; lang: string; onClear: () => void }) {
  const { t } = useTranslation('boards')
  const dimension = labelIn(model.dimensions.find((d) => d.key === cross.dimension)?.label, lang) || cross.dimension
  const member = memberLabel(cross, model, lang)
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm" role="status" aria-live="polite" data-board-cross={`${cross.dimension}:${cross.member}`}>
      <span className="rounded-full border border-primary/40 bg-primary-050 px-2.5 py-0.5 text-primary-800">
        <Trans t={t} i18nKey="board.cross.active" values={{ dimension, member }} components={{ dimension: <bdi />, member: <bdi /> }} />
      </span>
      <Button variant="text" onClick={onClear} aria-label={t('board.cross.clearLabel', { member: fsi(member) })} data-board-cross-clear>
        <X className="size-3.5" aria-hidden />
        {t('board.cross.clear')}
      </Button>
    </div>
  )
}
