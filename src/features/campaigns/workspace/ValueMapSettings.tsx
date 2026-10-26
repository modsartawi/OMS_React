import { useId, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import { Loader2, Upload } from 'lucide-react'
import type { RuleIssue, RuleValueMap, RuleValueMapMeaning, RuleValueMapUpload } from '@/core/models/rule-campaign'
import { ruleCampaignApi } from '@/core/rules/api'
import Ltr from '@/core/ui/Ltr'
import { formatNumber } from '@/core/util/number-format'
import { useWorkspace } from './context'
import { draftSave } from './settings-form'
import { Refusal, SaveRow, SettingsField, SettingsFrame, useSettingsDraft, useSettingsSave } from './settings-ui'
import Input from '@/core/ui/Input'
import Select from '@/core/ui/Select'

const MEANINGS: readonly RuleValueMapMeaning[] = ['targetPrice', 'percentOff', 'amountOff']

/** How many of the map's entries the page lists. */
const SHOWN = 10

/** A campaign with no map yet starts on a target price per each (the catalogue's example). */
const EMPTY_MAP: RuleValueMap = { means: 'targetPrice', unit: 'EA', entries: [] }

/**
 * Settings ▸ Value map (ticket 523; ADR 0095): a number per material that "Price from the value map"
 * reads. What a number means and its unit are the marketer's; the entries come from a CSV of
 * `material,number` lines, read by HQ (`Rules/Authoring/ValueMaps/Upload`): HQ answers the campaign
 * with the map's entries replaced, or the lines it refused, and stores nothing — the page's Save
 * saves the whole draft at its revision, as every Settings page does.
 */
export default function ValueMapSettings() {
  const { t } = useTranslation('campaign-workspace')
  const { draft: d } = useWorkspace()
  const { draft, setDraft, dirty, reset, adoptNext } = useSettingsDraft<RuleValueMap>(d.campaign.valueMap ?? EMPTY_MAP)
  const save = useSettingsSave('valueMap', (map: RuleValueMap) => draftSave(d, { valueMap: map }), adoptNext)
  const fileId = useId()
  const [read, setRead] = useState<RuleValueMapUpload | null>(null)
  /** The chosen file could not be read here (moved, locked): nothing was sent. */
  const [fileFailed, setFileFailed] = useState(false)
  const upload = useMutation({
    mutationFn: (csv: string) => ruleCampaignApi.uploadValueMap({ ...d.campaign, valueMap: draft }, csv),
    onSuccess: (answer) => {
      setRead(answer)
      if (answer.accepted && answer.campaign?.valueMap) setDraft((m) => ({ ...m, entries: answer.campaign!.valueMap!.entries }))
    },
  })
  const set = (change: Partial<RuleValueMap>) => {
    setDraft((m) => ({ ...m, ...change }))
    if (save.isError) save.reset()
  }
  const issues = read ? [...read.errors, ...read.warnings] : []

  return (
    <SettingsFrame page="valueMap">
      <SettingsField id="settings-valuemap-means" label={t('settings.valueMap.means')}>
        <Select
          id="settings-valuemap-means"
          className="w-full max-w-md"
          value={draft.means}
          onChange={(e) => set({ means: e.target.value as RuleValueMapMeaning })}
          data-settings-field="means"
        >
          {MEANINGS.map((m) => (
            <option key={m} value={m}>
              {t(`settings.valueMap.meaning.${m}`)}
            </option>
          ))}
        </Select>
      </SettingsField>
      <SettingsField id="settings-valuemap-unit" label={t('settings.valueMap.unit')} hint={t('settings.valueMap.unitHint')}>
        <Input
          id="settings-valuemap-unit"
          dir="ltr"
          className="w-full max-w-md font-mono"
          value={draft.unit}
          onChange={(e) => set({ unit: e.target.value })}
          data-settings-field="unit"
        />
      </SettingsField>
      <SettingsField id={fileId} label={t('settings.valueMap.file')} hint={t('settings.valueMap.fileHint')}>
        <span className="flex flex-wrap items-center gap-2">
          <input
            id={fileId}
            type="file"
            accept=".csv,text/csv"
            className="text-sm"
            disabled={upload.isPending}
            onChange={async (e) => {
              const file = e.target.files?.[0]
              e.target.value = ''
              if (!file) return
              setRead(null)
              setFileFailed(false)
              let csv: string
              try {
                csv = await file.text()
              } catch {
                setFileFailed(true)
                return
              }
              upload.mutate(csv)
            }}
            data-valuemap-file=""
          />
          {upload.isPending && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" aria-hidden />
              {t('settings.valueMap.reading')}
            </span>
          )}
        </span>
        {fileFailed && (
          <p className="text-xs text-danger-800" role="alert" data-valuemap-file-failed="">
            {t('settings.valueMap.fileFailed')}
          </p>
        )}
        {upload.isError && <Refusal title={t('settings.valueMap.uploadFailedTitle')} fallback={t('settings.valueMap.uploadFailed')} error={upload.error} />}
        {read && (
          <div className="flex flex-col gap-1" data-valuemap-read={read.accepted ? 'accepted' : 'refused'}>
            <p className={'flex items-center gap-1.5 text-xs ' + (read.accepted ? 'text-foreground' : 'font-medium text-danger-800')}>
              <Upload className="size-3.5" aria-hidden />
              <span>
                {read.accepted ? (
                  <Trans t={t} i18nKey="settings.valueMap.accepted" count={read.entries} values={{ n: formatNumber(read.entries) }} components={{ n: <Ltr /> }} />
                ) : (
                  t('settings.valueMap.refused')
                )}
              </span>
            </p>
            {issues.length > 0 && (
              <ul className="flex flex-col gap-0.5 text-xs" data-valuemap-issues="">
                {issues.map((m, i) => (
                  <IssueLine key={i} issue={m} />
                ))}
              </ul>
            )}
          </div>
        )}
      </SettingsField>
      <SettingsField label={t('settings.valueMap.entries')}>
        {draft.entries.length === 0 ? (
          <p className="pt-1.5 text-sm text-muted-foreground" data-valuemap-empty="">
            {t('settings.valueMap.none')}
          </p>
        ) : (
          <div className="flex flex-col gap-1" data-valuemap-entries={draft.entries.length}>
            <table className="max-w-md text-sm">
              <thead>
                <tr className="text-xs text-muted-foreground">
                  <th className="py-1 text-start font-medium">{t('settings.valueMap.material')}</th>
                  <th className="py-1 text-end font-medium">{t('settings.valueMap.number')}</th>
                </tr>
              </thead>
              <tbody>
                {draft.entries.slice(0, SHOWN).map(([material, n], i) => (
                  <tr key={i} className="border-t border-border/40" data-valuemap-entry={material}>
                    <td className="py-1 font-mono">
                      <Ltr>{material}</Ltr>
                    </td>
                    <td className="py-1 text-end">
                      <Ltr>{formatNumber(n)}</Ltr>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {draft.entries.length > SHOWN && (
              <p className="text-xs text-muted-foreground">
                <Trans t={t} i18nKey="settings.valueMap.more" count={draft.entries.length - SHOWN} values={{ n: formatNumber(draft.entries.length - SHOWN) }} components={{ n: <Ltr /> }} />
              </p>
            )}
          </div>
        )}
      </SettingsField>
      <SaveRow
        page="valueMap"
        dirty={dirty}
        pending={save.isPending}
        error={save.error}
        onCancel={() => {
          reset()
          setRead(null)
          setFileFailed(false)
          save.reset()
        }}
        onSave={() => {
          if (!save.isPending) save.mutate(draft)
        }}
      />
    </SettingsFrame>
  )
}

/** One of HQ's lines about the file: where (`line 3`) and what, in HQ's words. */
function IssueLine({ issue }: { issue: RuleIssue }) {
  const { t } = useTranslation('campaign-workspace')
  return (
    <li className={issue.severity === 'warning' ? 'text-attention-800' : 'text-danger-800'} data-valuemap-issue={issue.severity}>
      <Trans
        t={t}
        i18nKey={issue.severity === 'warning' ? 'settings.valueMap.warning' : 'settings.valueMap.error'}
        values={{ where: issue.where, message: issue.message }}
        components={{ where: <bdi />, msg: <bdi /> }}
      />
    </li>
  )
}
