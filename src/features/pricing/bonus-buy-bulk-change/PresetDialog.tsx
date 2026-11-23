import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { apiErrorMessage } from '@/core/api'
import type { BbyBulkPreset } from '@/core/models/bonus-buy-bulk-preset'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Field from '@/core/ui/Field'
import Input from '@/core/ui/Input'
import Modal from '@/core/ui/Modal'
import { bbyBulkPresetApi } from './api'
import type { BulkForm } from './operations'
import { presetForm, presetSaveRequest, readPresetOutcome, type PresetOutcomeReading, type PresetSaveProblem } from './presets'
import { Refusals } from './ResultPanel'

/**
 * What the dialog saves (spec 4190 stories 37–38): `create` stores the current form under a new name
 * (Save as preset…); `rename` gives a preset a new name and keeps its operations; `update` stores the
 * current form in a preset, at the version it was loaded at.
 */
export type PresetTarget = { kind: 'create' } | { kind: 'rename'; preset: BbyBulkPreset } | { kind: 'update'; preset: BbyBulkPreset }

/** 🚩 Guessed width of the name column (4195 names it beside the entity); the server clamps anyway. */
const NAME_MAX = 100

/**
 * The preset Save dialog. A duplicate name or a stale edit comes back in-band and is shown here, in
 * English and Arabic, with the dialog left open so the name can be changed or the list reloaded.
 */
export default function PresetDialog({
  target,
  form,
  onClose,
  onSaved,
}: {
  target: PresetTarget
  form: BulkForm
  onClose: () => void
  onSaved: (preset: BbyBulkPreset | null) => void
}) {
  const { t } = useTranslation('bonus-buy-bulk-change')
  const editing = target.kind === 'create' ? null : target.preset
  const [name, setName] = useState(editing?.name ?? '')
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<PresetSaveProblem | null>(null)
  const [answer, setAnswer] = useState<PresetOutcomeReading | null>(null)
  const [error, setError] = useState<string | null>(null)

  // A rename keeps what the preset holds; create and update store the form as it stands.
  const source = target.kind === 'rename' ? presetForm(target.preset) : form

  const save = async () => {
    const built = presetSaveRequest(source, name, editing)
    if ('problem' in built) {
      setProblem(built.problem)
      return
    }
    setProblem(null)
    setAnswer(null)
    setError(null)
    setBusy(true)
    try {
      const reading = readPresetOutcome(await bbyBulkPresetApi.save(built.request))
      if (reading.ok) onSaved(reading.preset)
      else setAnswer(reading)
    } catch (err) {
      setError(apiErrorMessage(err, t('presets.error.save')))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      dismissable={!busy}
      title={t(`presets.dialog.${target.kind}Title`)}
      footer={
        <>
          <Button variant="text" onClick={onClose} disabled={busy}>
            {t('presets.dialog.cancel')}
          </Button>
          <Button variant="primary" onClick={save} disabled={busy} data-testid="preset-save">
            {t('presets.dialog.save')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3 text-sm" data-testid="preset-dialog">
        {target.kind === 'update' ? (
          <p>
            {t('presets.dialog.updateBody')}{' '}
            <span className="font-medium">
              <bdi>{target.preset.name}</bdi>
            </span>
          </p>
        ) : (
          <Field label={t('presets.dialog.name')} error={problem === 'name' ? t('presets.problem.name') : undefined}>
            <Input
              value={name}
              maxLength={NAME_MAX}
              dir="auto"
              autoFocus
              data-testid="preset-name"
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !busy && save()}
            />
          </Field>
        )}
        {target.kind === 'create' && <p className="text-xs text-muted-foreground">{t('presets.dialog.createHint')}</p>}
        {problem && problem !== 'name' && (
          <p className="text-danger-800" data-testid="preset-problem">
            {t(`presets.problem.${problem}`)}
          </p>
        )}
        {answer && !answer.ok && (
          <div className="flex flex-col gap-1" data-testid="preset-refused">
            {answer.fallback && <p className="font-medium text-danger-800">{t(`presets.refused.${answer.fallback}`)}</p>}
            <Refusals refusals={answer.refusals} tone="bad" />
          </div>
        )}
        {error && <ErrorBanner message={error} />}
      </div>
    </Modal>
  )
}
