import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import type { RuleCampaignOffline } from '@/core/models/rule-campaign'
import { ruleCampaignApi, ruleOfflineVerdictQuery } from '@/core/rules/api'
import Button from '@/core/ui/Button'
import StatusBadge from '@/core/ui/StatusBadge'
import { useWorkspace } from './context'
import { Refusal, SaveRow, SettingsFrame, useSettingsDraft, useSettingsSave } from './settings-ui'

/**
 * Settings ▸ Offline (ticket 509): HQ's offline-safe verdict on the saved draft, with its reasons —
 * worked out by HQ from the rules, budgets and audience, never by the client — and, for a campaign
 * HQ finds safe, "online only" to keep it off offline tills anyway.
 */
export default function OfflineSettings() {
  const { t } = useTranslation('campaign-workspace')
  const { campaign: c } = useWorkspace()
  const verdict = useQuery(ruleOfflineVerdictQuery(c.id))
  const { draft, setDraft, dirty, reset, adoptNext } = useSettingsDraft<RuleCampaignOffline>({ offlineOptOut: c.offlineOptOut })
  const save = useSettingsSave('offline', (body: RuleCampaignOffline) => ruleCampaignApi.saveOffline(c.id, body), adoptNext)

  if (verdict.isPending) {
    return (
      <SettingsFrame page="offline">
        <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          {t('settings.offline.loading')}
        </p>
      </SettingsFrame>
    )
  }

  if (verdict.isError) {
    return (
      <SettingsFrame page="offline">
        <div data-offline-refusal="">
          <Refusal title={t('settings.offline.failedTitle')} fallback={t('settings.offline.failed')} error={verdict.error} />
        </div>
        <div>
          <Button variant="secondary" onClick={() => void verdict.refetch()} data-offline-retry="">
            {t('settings.offline.retry')}
          </Button>
        </div>
      </SettingsFrame>
    )
  }

  const v = verdict.data
  return (
    <SettingsFrame page="offline">
      {v.safe ? (
        <>
          <p className="flex flex-wrap items-center gap-2 text-sm" data-offline-verdict={c.offlineOptOut ? 'optedOut' : 'safe'}>
            {c.offlineOptOut ? (
              <StatusBadge sev="mute">{t('settings.offline.onlineOnly')}</StatusBadge>
            ) : (
              <StatusBadge sev="ok">{t('settings.offline.safe')}</StatusBadge>
            )}
            {t(c.offlineOptOut ? 'settings.offline.optedOutSentence' : 'settings.offline.safeSentence')}
          </p>
          <label className="flex cursor-pointer items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-1"
              checked={draft.offlineOptOut}
              onChange={(e) => {
                setDraft({ offlineOptOut: e.target.checked })
                if (save.isError) save.reset()
              }}
              data-offline-opt-out=""
            />
            <span className="flex flex-col">
              <span className="font-medium">{t('settings.offline.optOut')}</span>
              <span className="text-xs text-muted-foreground">{t('settings.offline.optOutHint')}</span>
            </span>
          </label>
          <SaveRow
            page="offline"
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
        </>
      ) : (
        <div className="flex flex-col gap-2" data-offline-verdict="online">
          <p className="flex flex-wrap items-center gap-2 text-sm">
            <StatusBadge sev="mute">{t('settings.offline.onlineOnly')}</StatusBadge>
            {t('settings.offline.unsafeSentence')}
          </p>
          <ul className="list-disc ps-5 text-sm" data-offline-reasons="">
            {v.reasons.map((r) => (
              <li key={r.code} data-offline-reason={r.code}>
                <bdi>{r.message}</bdi>
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="text-xs text-muted-foreground">{t('settings.offline.note')}</p>
    </SettingsFrame>
  )
}
