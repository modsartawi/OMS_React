import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import { apiErrorMessage } from '@/core/api'
import type { BbyBulkPreset } from '@/core/models/bonus-buy-bulk-preset'
import { confirmAction } from '@/core/services/confirm'
import Button from '@/core/ui/Button'
import Chip from '@/core/ui/Chip'
import ErrorBanner from '@/core/ui/ErrorBanner'
import { fsi } from '@/core/util/bidi'
import { bbyBulkPresetApi, bulkPresetsKey } from './api'
import type { BulkForm } from './operations'
import PresetDialog, { type PresetTarget } from './PresetDialog'
import { matchingPreset, pickPreset, readPresetOutcome, type PresetOutcomeReading } from './presets'
import { Refusals } from './ResultPanel'

/**
 * The shared presets above the engine-rules form (BackOffice spec 4190 stories 35–39, design F; oms 960).
 *
 * Picking a chip starts the form from the preset — the selection and the promotion stay as they are —
 * and the form stays editable. The chip stays lit while the form still says exactly what the preset
 * holds. The last picked preset can be renamed, given the current form, or deleted; Save as preset…
 * stores the current form under a new name. A duplicate name or a stale edit is refused in-band.
 */
export default function PresetChips({
  form,
  onPick,
  disabled,
}: {
  form: BulkForm
  onPick: (form: BulkForm) => void
  disabled?: boolean
}) {
  const { t } = useTranslation('bonus-buy-bulk-change')
  const queryClient = useQueryClient()
  const presets = useQuery({ queryKey: bulkPresetsKey, queryFn: () => bbyBulkPresetApi.list() })
  const rows = presets.data ?? []

  const [pickedId, setPickedId] = useState<string | null>(null)
  const [dialog, setDialog] = useState<PresetTarget | null>(null)
  const [busy, setBusy] = useState(false)
  const [deleteAnswer, setDeleteAnswer] = useState<PresetOutcomeReading | null>(null)
  const [error, setError] = useState<string | null>(null)

  const lit = matchingPreset(rows, form)
  const picked = rows.find((p) => p.id === pickedId) ?? null
  const off = disabled || busy

  const refresh = () => queryClient.invalidateQueries({ queryKey: bulkPresetsKey })

  const pick = (preset: BbyBulkPreset) => {
    setPickedId(preset.id)
    setDeleteAnswer(null)
    setError(null)
    onPick(pickPreset({ form }, preset).form)
  }

  const remove = async (preset: BbyBulkPreset) => {
    const ok = await confirmAction(t('presets.delete.confirmBody', { name: fsi(preset.name) }), t('presets.delete.confirmTitle'))
    if (!ok) return
    setBusy(true)
    setDeleteAnswer(null)
    setError(null)
    try {
      const reading = readPresetOutcome(await bbyBulkPresetApi.delete({ id: preset.id, version: preset.version }))
      if (reading.ok) setPickedId(null)
      else setDeleteAnswer(reading)
      await refresh()
    } catch (err) {
      setError(apiErrorMessage(err, t('presets.error.delete')))
    } finally {
      setBusy(false)
    }
  }

  const saved = async (preset: BbyBulkPreset | null) => {
    if (preset) setPickedId(preset.id)
    setDialog(null)
    await refresh()
  }

  return (
    <div className="flex flex-col gap-2" data-testid="bulk-presets">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground">{t('presets.label')}</span>
        {presets.isPending ? (
          <Loader2 className="size-3.5 animate-spin text-muted-foreground" aria-label={t('presets.loading')} />
        ) : !presets.isError && rows.length === 0 ? (
          <span className="text-xs text-muted-foreground">{t('presets.none')}</span>
        ) : (
          rows.map((p) => (
            <Chip key={p.id} on={lit === p.id} disabled={off} onClick={() => pick(p)} data-testid="preset-chip">
              <bdi>{p.name}</bdi>
            </Chip>
          ))
        )}
        <Button variant="secondary" disabled={off} onClick={() => setDialog({ kind: 'create' })} data-testid="preset-create">
          {t('presets.saveAs')}
        </Button>
      </div>

      {picked && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground" data-testid="preset-actions">
          <span>
            {t('presets.picked')}{' '}
            <span className="font-medium text-foreground">
              <bdi>{picked.name}</bdi>
            </span>
          </span>
          <Button variant="text" disabled={off} onClick={() => setDialog({ kind: 'rename', preset: picked })}>
            {t('presets.rename')}
          </Button>
          <Button
            variant="text"
            disabled={off || lit === picked.id}
            title={lit === picked.id ? t('presets.updateSame') : undefined}
            onClick={() => setDialog({ kind: 'update', preset: picked })}
          >
            {t('presets.update')}
          </Button>
          <Button variant="text" disabled={off} onClick={() => remove(picked)} data-testid="preset-delete">
            {t('presets.delete.button')}
          </Button>
        </div>
      )}

      {presets.isError && <ErrorBanner message={apiErrorMessage(presets.error, t('presets.error.list'))} />}
      {deleteAnswer && !deleteAnswer.ok && (
        <div className="flex flex-col gap-1 text-sm" data-testid="preset-delete-refused">
          {deleteAnswer.fallback && <p className="font-medium text-danger-800">{t(`presets.refused.${deleteAnswer.fallback}`)}</p>}
          <Refusals refusals={deleteAnswer.refusals} tone="bad" />
        </div>
      )}
      {error && <ErrorBanner message={error} />}

      {dialog && <PresetDialog target={dialog} form={form} onClose={() => setDialog(null)} onSaved={saved} />}
    </div>
  )
}
