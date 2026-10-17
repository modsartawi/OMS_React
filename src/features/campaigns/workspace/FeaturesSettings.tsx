import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { RULE_FEATURES, type RuleFeature } from '@/core/models/rule-campaign'
import { ruleCatalogueQuery } from '@/core/rules/api'
import { campaignPath } from '@/core/rules/campaign-state'
import { useWorkspace } from './context'
import { draftSave, featuresInUse } from './settings-form'
import { SaveRow, SettingsFrame, useSettingsDraft, useSettingsSave } from './settings-ui'

/**
 * Settings ▸ Features (ticket 509): coupons and loyalty points, each switching on its menu,
 * conditions and effects — and either can be switched on after the campaign is created. Switching
 * one off while a block of the saved rules uses it is refused, naming the rules (`featuresInUse`,
 * read through the block catalogue); HQ refuses it too.
 */
export default function FeaturesSettings() {
  const { t } = useTranslation('campaign-workspace')
  const { draft: d } = useWorkspace()
  const catalogue = useQuery(ruleCatalogueQuery())
  // The features in a fixed order, so a re-read and the page's own list compare equal.
  const { draft, setDraft, dirty, reset, adoptNext } = useSettingsDraft<RuleFeature[]>(RULE_FEATURES.filter((f) => d.features.includes(f)))
  const save = useSettingsSave('features', (features: RuleFeature[]) => draftSave(d, {}, features), adoptNext)
  const inUse = catalogue.data ? featuresInUse(d.features, draft, d.campaign.rules, catalogue.data) : []
  // Switching one off waits for the catalogue that says which blocks need it; if the catalogue
  // cannot be read, HQ's own refusal is the guard.
  const switchingOff = d.features.some((f) => !draft.includes(f))
  const waiting = switchingOff && catalogue.isPending

  return (
    <SettingsFrame page="features">
      <div className="flex flex-col gap-3">
        {RULE_FEATURES.map((f) => (
          <label key={f} className="flex cursor-pointer items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-1"
              checked={draft.includes(f)}
              onChange={(e) => {
                setDraft((list) => RULE_FEATURES.filter((x) => (x === f ? e.target.checked : list.includes(x))))
                if (save.isError) save.reset()
              }}
              data-settings-feature={f}
            />
            <span className="flex flex-col">
              <span className="font-medium">{t(`settings.features.${f}`)}</span>
              <span className="text-xs text-muted-foreground">{t(`settings.features.${f}Hint`)}</span>
            </span>
          </label>
        ))}
      </div>
      {inUse.map((use) => (
        <div key={use.feature} role="alert" className="rounded-md border border-danger-border bg-danger-050 p-2.5 text-sm text-danger-800" data-feature-in-use={use.feature}>
          <p>{t('settings.features.inUse', { feature: t(`settings.features.${use.feature}`) })}</p>
          <ul className="mt-1 list-disc ps-5">
            {use.rules.map((r) => (
              <li key={r.id} data-feature-in-use-rule={r.id}>
                <bdi>{r.name || t('settings.features.untitledRule')}</bdi>
              </li>
            ))}
          </ul>
          <Link to={`${campaignPath(d.code)}/rules`} className="mt-1 inline-block text-xs font-medium underline" data-feature-in-use-link="">
            {t('settings.features.inUseLink')}
          </Link>
        </div>
      ))}
      <p className="text-xs text-muted-foreground">{t('settings.features.note')}</p>
      <SaveRow
        page="features"
        dirty={dirty}
        blocked={inUse.length > 0 || waiting}
        pending={save.isPending}
        error={save.error}
        onCancel={() => {
          reset()
          save.reset()
        }}
        onSave={() => {
          if (inUse.length || waiting || save.isPending) return
          save.mutate(draft)
        }}
      />
    </SettingsFrame>
  )
}
