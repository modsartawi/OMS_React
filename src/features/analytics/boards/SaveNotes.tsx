import { Trans, useTranslation } from 'react-i18next'
import { CopyPlus, GitCompare, Info, Lock, RotateCcw } from 'lucide-react'
import { formatClock, formatDay } from '@/core/charts/format'
import i18n from '@/core/i18n'
import Button from '@/core/ui/Button'
import Ltr from '@/core/ui/Ltr'
import { formatPair } from '@/core/util/bidi'
import type { ItemActions } from './item-actions'
import { sourceMovedOn, type EditingItem, type SaveRefusal } from './item-save'

/**
 * The tier words around an editor's save (ticket 776), kind-agnostic — the view editor (775) and the board
 * editor (777) show the same. `SaveStanding` says before a save what it will do; `SaveRefusalNote` words a
 * refused save: 403 offers **Save as my copy**, 405 names who saved last and when and offers a copy or a reload.
 */
export function SaveStanding({ editing, actions }: { editing: EditingItem | null; actions: ItemActions }) {
  const { t } = useTranslation('boards')
  if (!editing) return null
  const moved = sourceMovedOn(editing)
  const why =
    actions.save === 'read-only' ? t('save.standing.readOnly') : actions.save === 'copy' ? t(`save.standing.copy.${editing.tier}`) : null
  if (!why && !moved) return null
  return (
    <div className="flex flex-col gap-1 text-xs text-muted-foreground" data-analytics-save-standing={actions.save}>
      {why && (
        <p className="flex items-start gap-1">
          {actions.save === 'read-only' ? <Lock className="mt-0.5 size-3.5 shrink-0" aria-hidden /> : <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />}
          <span>{why}</span>
        </p>
      )}
      {moved && <SourceMovedOn />}
    </div>
  )
}

/** Story 64: on a copy whose source has moved on since it was copied. */
export function SourceMovedOn() {
  const { t } = useTranslation('boards')
  return (
    <p className="flex items-start gap-1 text-xs text-attention-800" data-analytics-source-moved-on>
      <GitCompare className="mt-0.5 size-3.5 shrink-0" aria-hidden />
      <span>{t('save.sourceMovedOn')}</span>
    </p>
  )
}

export function SaveRefusalNote({
  refusal,
  pending,
  onCopy,
  onReload,
}: {
  refusal: SaveRefusal
  pending: boolean
  onCopy: () => void
  onReload: () => void
}) {
  const { t } = useTranslation('boards')
  const lang = i18n.language
  const copy = (
    <Button variant="secondary" onClick={onCopy} disabled={pending} data-analytics-refusal-copy>
      <CopyPlus className="size-3.5" aria-hidden />
      {t('save.asMyCopy')}
    </Button>
  )
  if (refusal.kind === 'not-yours') {
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-attention-border bg-attention-050 p-3 text-sm text-attention-800" role="alert" data-analytics-refusal="not-yours">
        <span className="min-w-0 flex-1">{t('save.notYours')}</span>
        {copy}
      </div>
    )
  }
  const at = refusal.at ? formatPair(formatDay(refusal.at, lang), formatClock(refusal.at, lang)) : ''
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-attention-border bg-attention-050 p-3 text-sm text-attention-800" role="alert" data-analytics-refusal="conflict">
      <span className="min-w-0 flex-1" data-analytics-conflict-words>
        {refusal.by && at ? (
          <Trans t={t} i18nKey="save.conflict.byAt" values={{ by: refusal.by, at }} components={{ by: <bdi />, at: <Ltr /> }} />
        ) : refusal.by ? (
          <Trans t={t} i18nKey="save.conflict.by" values={{ by: refusal.by }} components={{ by: <bdi /> }} />
        ) : (
          refusal.message || t('save.conflict.unknown')
        )}{' '}
        {t('save.conflict.offer')}
      </span>
      {copy}
      <Button variant="secondary" onClick={onReload} disabled={pending} data-analytics-refusal-reload>
        <RotateCcw className="size-3.5" aria-hidden />
        {t('save.reload')}
      </Button>
    </div>
  )
}
