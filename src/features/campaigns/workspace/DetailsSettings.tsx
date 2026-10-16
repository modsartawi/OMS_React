import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ruleCampaignApi } from '@/core/rules/api'
import Ltr from '@/core/ui/Ltr'
import { useWorkspace } from './context'
import { detailsProblems, toDetailsBody, type DetailsForm, type DetailsProblem } from './settings-form'
import { SETTINGS_INPUT, SaveRow, SettingsField, SettingsFrame, useSettingsDraft, useSettingsSave } from './settings-ui'

/**
 * Settings ▸ Details (ticket 509): the name in English and in Arabic — both required, the Arabic one
 * typed right to left — and the description. The code is HQ's and is shown, not edited.
 */
export default function DetailsSettings() {
  const { t } = useTranslation('campaign-workspace')
  const { campaign: c } = useWorkspace()
  const { draft, setDraft, dirty, reset, adoptNext } = useSettingsDraft<DetailsForm>({ nameEn: c.name.en, nameAr: c.name.ar, description: c.description })
  const save = useSettingsSave('details', (body: ReturnType<typeof toDetailsBody>) => ruleCampaignApi.saveDetails(c.id, body), adoptNext)
  const [tried, setTried] = useState(false)
  const problems = detailsProblems(draft)
  const shown = (p: DetailsProblem) => tried && problems.includes(p)

  const set = (change: Partial<DetailsForm>) => {
    setDraft((d) => ({ ...d, ...change }))
    if (save.isError) save.reset()
  }

  return (
    <SettingsFrame page="details">
      <SettingsField label={t('settings.details.code')} hint={t('settings.details.codeHint')}>
        <code className="pt-1.5 font-mono text-sm" data-settings-code="">
          <Ltr>{c.code}</Ltr>
        </code>
      </SettingsField>
      <NameInput id="settings-name-en" label={t('settings.details.nameEn')} dir="ltr" value={draft.nameEn} onChange={(nameEn) => set({ nameEn })} problem={shown('nameEnRequired') ? 'nameEnRequired' : null} data="nameEn" />
      <NameInput id="settings-name-ar" label={t('settings.details.nameAr')} dir="rtl" value={draft.nameAr} onChange={(nameAr) => set({ nameAr })} problem={shown('nameArRequired') ? 'nameArRequired' : null} data="nameAr" />
      <SettingsField id="settings-description" label={t('settings.details.description')}>
        <textarea
          id="settings-description"
          dir="auto"
          rows={3}
          className={`${SETTINGS_INPUT} h-auto max-w-2xl border-border/60 py-1.5 focus:border-primary/50`}
          value={draft.description}
          placeholder={t('settings.details.descriptionPlaceholder')}
          onChange={(e) => set({ description: e.target.value })}
          data-settings-field="description"
        />
      </SettingsField>
      <SaveRow
        page="details"
        dirty={dirty}
        pending={save.isPending}
        error={save.error}
        onCancel={() => {
          reset()
          setTried(false)
          save.reset()
        }}
        onSave={() => {
          setTried(true)
          if (problems.length || save.isPending) return
          save.mutate(toDetailsBody(draft), { onSuccess: () => setTried(false) })
        }}
      />
    </SettingsFrame>
  )
}

function NameInput({
  id,
  label,
  dir,
  value,
  onChange,
  problem,
  data,
}: {
  id: string
  label: string
  dir: 'ltr' | 'rtl'
  value: string
  onChange: (value: string) => void
  problem: DetailsProblem | null
  data: string
}) {
  const { t } = useTranslation('campaign-workspace')
  return (
    <SettingsField id={id} label={label}>
      <input
        id={id}
        dir={dir}
        value={value}
        required
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={problem ? true : undefined}
        aria-describedby={problem ? `${id}-problem` : undefined}
        className={`${SETTINGS_INPUT} ${problem ? 'border-danger-border focus:border-danger' : 'border-border/60 focus:border-primary/50'}`}
        data-settings-field={data}
      />
      {problem && (
        <p id={`${id}-problem`} className="text-xs text-danger-800" data-settings-problem={problem}>
          {t(`settings.details.problem.${problem}`)}
        </p>
      )}
    </SettingsField>
  )
}
