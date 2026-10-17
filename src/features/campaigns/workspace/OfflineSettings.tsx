import { useTranslation } from 'react-i18next'
import StatusBadge from '@/core/ui/StatusBadge'
import { useWorkspace } from './context'
import { draftSave } from './settings-form'
import { SaveRow, SettingsFrame, useSettingsDraft, useSettingsSave } from './settings-ui'

/**
 * Settings ▸ Offline (tickets 509, 522): HQ's offline-safe verdict on the saved draft — the
 * `offline` part of the validation `Drafts/Load` answers, worked out by HQ from the rules, budgets
 * and audience, never by the client; null while the draft has errors — with its reasons in both
 * languages, and, for a campaign HQ finds safe, "online only" (`onlineOnly`) to keep it off offline
 * tills anyway. The whole draft is saved at its revision.
 */
export default function OfflineSettings() {
  const { t } = useTranslation('campaign-workspace')
  const { draft: d } = useWorkspace()
  const onlineOnly = !!d.campaign.onlineOnly
  const v = d.validation?.offline ?? null
  const { draft, setDraft, dirty, reset, adoptNext } = useSettingsDraft<{ onlineOnly: boolean }>({ onlineOnly })
  const save = useSettingsSave('offline', (body: { onlineOnly: boolean }) => draftSave(d, { onlineOnly: body.onlineOnly }), adoptNext)

  if (!v) {
    return (
      <SettingsFrame page="offline">
        <p className="text-sm text-muted-foreground" data-offline-verdict="unknown">
          {t('settings.offline.noVerdict')}
        </p>
      </SettingsFrame>
    )
  }

  return (
    <SettingsFrame page="offline">
      {v.safe ? (
        <>
          <p className="flex flex-wrap items-center gap-2 text-sm" data-offline-verdict={onlineOnly ? 'optedOut' : 'safe'}>
            {onlineOnly ? <StatusBadge sev="mute">{t('settings.offline.onlineOnly')}</StatusBadge> : <StatusBadge sev="ok">{t('settings.offline.safe')}</StatusBadge>}
            {t(onlineOnly ? 'settings.offline.optedOutSentence' : 'settings.offline.safeSentence')}
          </p>
          <label className="flex cursor-pointer items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-1"
              checked={draft.onlineOnly}
              onChange={(e) => {
                setDraft({ onlineOnly: e.target.checked })
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
            {/* By place too: HQ may answer one code for two reasons (509 review). */}
            {v.reasons.map((r, i) => (
              <li key={`${i}-${r.code}`} data-offline-reason={r.code}>
                <span className="flex flex-col">
                  <bdi lang="en">{r.en}</bdi>
                  {r.ar && (
                    <bdi dir="rtl" lang="ar">
                      {r.ar}
                    </bdi>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="text-xs text-muted-foreground">{t('settings.offline.note')}</p>
    </SettingsFrame>
  )
}
