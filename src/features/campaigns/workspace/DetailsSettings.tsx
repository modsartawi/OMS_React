import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import Ltr from '@/core/ui/Ltr'
import { useWorkspace } from './context'
import { detailsProblems, draftSave, toDetailsName, type DetailsForm, type DetailsProblem } from './settings-form'
import { SaveRow, SettingsField, SettingsFrame, useSettingsDraft, useSettingsSave } from './settings-ui'
import Input from '@/core/ui/Input'

/**
 * Settings ▸ Details (ticket 509): the name in English and in Arabic — both required, the Arabic one
 * typed right to left. The campaign's id was picked when it was created and is shown, not edited.
 * The whole draft is saved at its revision (ticket 522); a campaign has no description.
 */
export default function DetailsSettings() {
  const { t } = useTranslation('campaign-workspace')
  const { draft: d } = useWorkspace()
  const c = d.campaign
  const { draft, setDraft, dirty, reset, adoptNext } = useSettingsDraft<DetailsForm>({ nameEn: c.name.en, nameAr: c.name.ar })
  const save = useSettingsSave('details', (body: DetailsForm) => draftSave(d, { name: toDetailsName(body) }), adoptNext)
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
          <Ltr>{d.code}</Ltr>
        </code>
      </SettingsField>
      <NameInput id="settings-name-en" label={t('settings.details.nameEn')} dir="ltr" value={draft.nameEn} onChange={(nameEn) => set({ nameEn })} problem={shown('nameEnRequired') ? 'nameEnRequired' : null} data="nameEn" />
      <NameInput id="settings-name-ar" label={t('settings.details.nameAr')} dir="rtl" value={draft.nameAr} onChange={(nameAr) => set({ nameAr })} problem={shown('nameArRequired') ? 'nameArRequired' : null} data="nameAr" />
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
          save.mutate(draft, { onSuccess: () => setTried(false) })
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
      <Input
        id={id}
        dir={dir}
        value={value}
        required
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={problem ? true : undefined}
        aria-describedby={problem ? `${id}-problem` : undefined}
        className="w-full max-w-md"
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
