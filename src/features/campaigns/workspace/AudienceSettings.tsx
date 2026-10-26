import { useTranslation } from 'react-i18next'
import type { RuleAudienceMembers, RuleCampaignAudience } from '@/core/models/rule-campaign'
import { AUDIENCE_CHANNELS, AUDIENCE_COUNTRIES } from '@/core/rules/lookups'
import LookupPicks from '@/core/rules/LookupPicks'
import Ltr from '@/core/ui/Ltr'
import { formatPair } from '@/core/util/bidi'
import { useWorkspace } from './context'
import { draftSave } from './settings-form'
import { SaveRow, SettingsField, SettingsFrame, useSettingsDraft, useSettingsSave } from './settings-ui'
import Select from '@/core/ui/Select'
import Chip from '@/core/ui/Chip'

const MEMBERS: readonly RuleAudienceMembers[] = ['any', 'identified', 'earning']

/** The page's fields: every part present (an absent one on the wire is none picked / anyone). */
type AudienceForm = Required<RuleCampaignAudience>

const audienceForm = (a: RuleCampaignAudience | undefined): AudienceForm => ({
  countries: a?.countries ?? [],
  channels: a?.channels ?? [],
  stores: a?.stores ?? [],
  members: a?.members ?? 'any',
})

/**
 * Settings ▸ Audience (ticket 509): where and for whom the campaign runs, before any rule is looked
 * at — countries and channels picked from fixed lists (HQ has no lookup for them, BO ask E), stores
 * searched on HQ's store lookup, and whether it is for members only. None picked is every one. Uploading an audience is a later ticket
 * (the ticket's open question, ruled): this page picks only what HQ's lookups offer.
 */
export default function AudienceSettings() {
  const { t } = useTranslation('campaign-workspace')
  const { draft: d } = useWorkspace()
  const { draft, setDraft, dirty, reset, adoptNext } = useSettingsDraft<AudienceForm>(audienceForm(d.campaign.audience))
  const save = useSettingsSave('audience', (audience: AudienceForm) => draftSave(d, { audience }), adoptNext)

  const set = (change: Partial<AudienceForm>) => {
    setDraft((d) => ({ ...d, ...change }))
    if (save.isError) save.reset()
  }

  return (
    <SettingsFrame page="audience">
      <SettingsField label={t('settings.audience.countries')} hint={t('settings.audience.countriesHint')}>
        <Toggles kind="countries" codes={AUDIENCE_COUNTRIES} label={t('settings.audience.countries')} value={draft.countries} onChange={(countries) => set({ countries })} />
      </SettingsField>
      <SettingsField label={t('settings.audience.channels')} hint={t('settings.audience.channelsHint')}>
        <Toggles kind="channels" codes={AUDIENCE_CHANNELS} label={t('settings.audience.channels')} value={draft.channels} onChange={(channels) => set({ channels })} />
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
        <Select
          id="settings-members"
          className="w-full max-w-md"
          value={draft.members}
          onChange={(e) => set({ members: e.target.value as RuleAudienceMembers })}
          data-settings-field="members"
        >
          {MEMBERS.map((m) => (
            <option key={m} value={m}>
              {t(`settings.audience.member.${m}`)}
            </option>
          ))}
        </Select>
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
 * A short fixed list (countries, channels): each a toggle, its code and its name. A code picked
 * earlier that the list does not hold stays shown, pressed, so it can be taken off.
 */
function Toggles({
  kind,
  codes,
  label,
  value,
  onChange,
}: {
  kind: 'countries' | 'channels'
  codes: readonly string[]
  label: string
  value: string[]
  onChange: (codes: string[]) => void
}) {
  const { t, i18n } = useTranslation('campaign-workspace')
  const nameOf = (code: string) => {
    const key = `settings.audience.names.${kind}.${code}`
    return i18n.exists(key, { ns: 'campaign-workspace' }) ? formatPair(code, t(key)) : code
  }
  const offered = codes.map((code) => ({ code, label: nameOf(code) }))
  const stale = value.filter((code) => !codes.includes(code)).map((code) => ({ code, label: code }))
  return (
    <span className="flex flex-wrap gap-1.5" role="group" aria-label={label} data-settings-toggles={kind}>
      {[...offered, ...stale].map((o) => {
        const on = value.includes(o.code)
        return (
          <Chip
            key={o.code}
            on={on}
            onClick={() => onChange(on ? value.filter((x) => x !== o.code) : [...value, o.code])}
            data-settings-toggle={o.code}
          >
            <Ltr>{o.label}</Ltr>
          </Chip>
        )
      })}
    </span>
  )
}
