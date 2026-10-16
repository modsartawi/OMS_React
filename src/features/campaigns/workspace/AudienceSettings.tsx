import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { apiErrorMessage } from '@/core/api'
import type { RuleCampaignAudience, RuleLookupKind } from '@/core/models/rule-campaign'
import { ruleCampaignApi, ruleLookupQuery } from '@/core/rules/api'
import Ltr from '@/core/ui/Ltr'
import { formatPair } from '@/core/util/bidi'
import { useWorkspace } from './context'
import { LookupPicks } from './FilterEditor'
import { SETTINGS_CONTROL, SaveRow, togglePill, SettingsField, SettingsFrame, useSettingsDraft, useSettingsSave } from './settings-ui'

const MEMBERS: readonly RuleCampaignAudience['members'][] = ['any', 'identified', 'earning']

/**
 * Settings ▸ Audience (ticket 509): where and for whom the campaign runs, before any rule is looked
 * at — countries and channels picked from HQ's lists, stores searched on HQ's store lookup, and
 * whether it is for members only. None picked is every one. Uploading an audience is a later ticket
 * (the ticket's open question, ruled): this page picks only what HQ's lookups offer.
 */
export default function AudienceSettings() {
  const { t } = useTranslation('campaign-workspace')
  const { campaign: c } = useWorkspace()
  const { draft, setDraft, dirty, reset, adoptNext } = useSettingsDraft<RuleCampaignAudience>(c.audience)
  const save = useSettingsSave('audience', (body: RuleCampaignAudience) => ruleCampaignApi.saveAudience(c.id, body), adoptNext)

  const set = (change: Partial<RuleCampaignAudience>) => {
    setDraft((d) => ({ ...d, ...change }))
    if (save.isError) save.reset()
  }

  return (
    <SettingsFrame page="audience">
      <SettingsField label={t('settings.audience.countries')} hint={t('settings.audience.countriesHint')}>
        <LookupToggles kind="countries" label={t('settings.audience.countries')} value={draft.countries} onChange={(countries) => set({ countries })} />
      </SettingsField>
      <SettingsField label={t('settings.audience.channels')} hint={t('settings.audience.channelsHint')}>
        <LookupToggles kind="channels" label={t('settings.audience.channels')} value={draft.channels} onChange={(channels) => set({ channels })} />
      </SettingsField>
      <div className="grid gap-1.5 sm:grid-cols-[12rem_1fr] sm:gap-3">
        <LookupPicks
          kind="stores"
          label={t('settings.audience.stores')}
          value={draft.stores}
          onChange={(stores) => set({ stores })}
          empty={t('settings.audience.storesAll')}
          data="stores"
        />
      </div>
      <SettingsField id="settings-members" label={t('settings.audience.members')}>
        <select
          id="settings-members"
          className={`${SETTINGS_CONTROL} w-full max-w-md`}
          value={draft.members}
          onChange={(e) => set({ members: e.target.value as RuleCampaignAudience['members'] })}
          data-settings-field="members"
        >
          {MEMBERS.map((m) => (
            <option key={m} value={m}>
              {t(`settings.audience.member.${m}`)}
            </option>
          ))}
        </select>
      </SettingsField>
      <SaveRow
        page="audience"
        dirty={dirty}
        pending={save.isPending}
        error={save.error}
        onCancel={() => {
          reset()
          save.reset()
        }}
        onSave={() => {
          if (!save.isPending) save.mutate(draft)
        }}
      />
    </SettingsFrame>
  )
}

/**
 * A short list HQ offers whole (countries, channels): each a toggle. A code picked earlier that HQ
 * no longer lists stays shown, pressed, so it can be taken off. It reads the lookup's answer to an
 * empty search, which is the whole list for lists this short; a list HQ caps belongs on a search
 * (`LookupPicks`), as the stores are.
 */
function LookupToggles({ kind, label, value, onChange }: { kind: RuleLookupKind; label: string; value: string[]; onChange: (codes: string[]) => void }) {
  const { t } = useTranslation('campaign-workspace')
  const list = useQuery(ruleLookupQuery(kind, ''))
  if (list.isPending) return <p className="pt-1.5 text-xs text-muted-foreground">{t('filters.searching')}</p>
  if (list.isError)
    return (
      <p className="pt-1.5 text-xs text-danger-800" role="alert" data-settings-lookup-failed={kind}>
        {apiErrorMessage(list.error, t('filters.lookupFailed'))}
      </p>
    )
  const offered = list.data.map((x) => ({ code: x.code, label: formatPair(x.code, x.name) }))
  const stale = value.filter((code) => !offered.some((o) => o.code === code)).map((code) => ({ code, label: code }))
  return (
    <span className="flex flex-wrap gap-1.5" role="group" aria-label={label} data-settings-toggles={kind}>
      {[...offered, ...stale].map((o) => {
        const on = value.includes(o.code)
        return (
          <button
            key={o.code}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(on ? value.filter((x) => x !== o.code) : [...value, o.code])}
            className={togglePill(on)}
            data-settings-toggle={o.code}
          >
            <Ltr>{o.label}</Ltr>
          </button>
        )
      })}
    </span>
  )
}
