import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import { apiErrorMessage, isBareDenial } from '@/core/api'
import { Field, NumberInput } from '@/core/insurance-rules/controls'
import { notify } from '@/core/services/notify'
import Button from '@/core/ui/Button'
import { GuardFlags } from '@/core/insurance-rules/badges'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Ltr from '@/core/ui/Ltr'
import { formatDay } from '@/core/util/date-format'
import { FLAG_SETTINGS_KEY, flagSettingsQuery, flagsQuery, metricsApi } from './api'
import { FLAG_SETTINGS_FIELDS, flagSettingsBody, flagSettingsForm, flagSettingsProblems, type FlagSettingsForm } from './flag-settings'
import { flagReason, type FlagRow, type FlagSettings } from './model'
import { RuleName, TD } from './parts'
import { DeniedCard, Loading, TH } from '@/core/insurance-rules/parts'

/**
 * The current flags with their reason (ticket 615; `GET InsuranceRules/Flags`, thresholds from
 * `GET InsuranceRules/Settings/Flags`, set by `PUT …/Settings/Flags` — review 3126 P5). A flag never pauses a rule.
 * Not windowed: the flag job keeps its own.
 */
export default function FlagsTab() {
  const { t } = useTranslation('insurance-metrics')
  const flags = useQuery(flagsQuery())
  const settings = useQuery(flagSettingsQuery())
  const s = settings.data
  const [editing, setEditing] = useState(false)

  if (flags.isError && isBareDenial(flags.error)) return <DeniedCard ns="insurance-metrics" hook="flags-denied" />
  if (flags.isError) return <ErrorBanner className="p-3" message={apiErrorMessage(flags.error, t('flags.failed'))} />
  if (!flags.data) return <Loading text={t('flags.loading')} />
  return (
    <div className="flex flex-col gap-3" data-flags-tab="">
      <div className="flex flex-wrap items-start gap-3">
      <p className="flex-1 text-sm text-muted-foreground" data-flag-thresholds={s ? '' : undefined}>
        {s ? (
          <Trans
            t={t}
            i18nKey="flags.thresholds"
            values={{ noisyPct: Math.round(s.noisyOverrideRate * 100), noisyMinFires: s.noisyMinFires, windowDays: s.windowDays, silentDays: s.silentDays, jumpFactor: s.jumpFactor }}
            components={{ v: <Ltr /> }}
          />
        ) : (
          t('flags.neverPause')
        )}
      </p>
      {s && !editing && (
        <Button variant="secondary" onClick={() => setEditing(true)} data-flag-settings-edit="">
          {t('flags.settings.edit')}
        </Button>
      )}
      </div>
      {s && editing && <SettingsForm settings={s} onDone={() => setEditing(false)} />}
      {flags.data.length === 0 ? (
        <p className="rounded-md border border-border/60 py-6 text-center text-sm text-muted-foreground" data-flags-empty="">
          {t('flags.empty')}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-md border border-border/60">
          <table className="w-full text-sm" data-flags-table="">
            <thead className="bg-grid-head text-grid-head-foreground">
              <tr>
                <th className={TH}>{t('flags.columns.rule')}</th>
                <th className={TH}>{t('flags.columns.flag')}</th>
                <th className={TH}>{t('flags.columns.reason')}</th>
                <th className={TH}>{t('flags.columns.since')}</th>
              </tr>
            </thead>
            <tbody>
              {flags.data.map((f) => (
                <tr key={`${f.ruleId}:${f.kind}`} className="border-t border-border/60" data-flag-row={`${f.ruleId}:${f.kind}`}>
                  <td className={TD}>
                    <RuleName id={f.ruleId} name={f.name} />
                  </td>
                  <td className={TD}>
                    <GuardFlags flags={[{ kind: f.kind, since: f.since }]} />
                  </td>
                  <td className={TD} data-reason="">
                    <Reason flag={f} />
                  </td>
                  <td className={TD} data-col="since">
                    <Ltr>{formatDay(f.since)}</Ltr>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

/** The thresholds, edited in place; Save PUTs the whole settings. */
function SettingsForm({ settings, onDone }: { settings: FlagSettings; onDone: () => void }) {
  const { t } = useTranslation('insurance-metrics')
  const qc = useQueryClient()
  const [form, setForm] = useState<FlagSettingsForm>(() => flagSettingsForm(settings))
  const problems = flagSettingsProblems(form)
  const save = useMutation({
    mutationFn: () => metricsApi.saveFlagSettings(flagSettingsBody(form)),
    onSuccess: (saved) => {
      qc.setQueryData(FLAG_SETTINGS_KEY, saved ?? flagSettingsBody(form))
      notify.success(t('flags.settings.saved'))
      onDone()
    },
    onError: (err) => notify.apiError(t('flags.settings.failed'), err, isBareDenial(err) ? t('access.deniedHint') : t('flags.settings.failed')),
  })
  const UNIT: Record<string, string> = { noisyPct: t('flags.settings.unit.pct'), windowDays: t('flags.settings.unit.days'), silentDays: t('flags.settings.unit.days'), jumpFactor: t('flags.settings.unit.times') }
  return (
    <form
      className="flex flex-col gap-3 rounded-lg border border-border/60 bg-card p-3"
      data-flag-settings-form=""
      onSubmit={(e) => {
        e.preventDefault()
        if (problems.length === 0 && !save.isPending) save.mutate()
      }}
    >
      <div className="flex flex-wrap gap-4">
        {FLAG_SETTINGS_FIELDS.map((k) => (
          <Field key={k} label={t(`flags.settings.field.${k}`)} unit={UNIT[k]}>
            <NumberInput value={form[k]} invalid={problems.includes(k)} data-input={k} onValue={(n) => setForm((f) => ({ ...f, [k]: n }))} />
          </Field>
        ))}
      </div>
      {problems.length > 0 && (
        <p className="text-xs text-danger-800" data-flag-settings-problems={problems.join(',')}>
          {t('flags.settings.invalid')}
        </p>
      )}
      <div className="flex gap-2">
        <Button type="submit" disabled={problems.length > 0 || save.isPending} data-flag-settings-save="">
          {save.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
          {t('flags.settings.save')}
        </Button>
        <Button variant="text" onClick={onDone} disabled={save.isPending} data-flag-settings-cancel="">
          {t('flags.settings.cancel')}
        </Button>
      </div>
    </form>
  )
}

function Reason({ flag }: { flag: FlagRow }) {
  const { t } = useTranslation('insurance-metrics')
  const r = flagReason(flag)
  const values = r.key === 'reason.silent' ? { ...r.values, lastFired: formatDay(String(r.values.lastFired)) } : r.values
  return <Trans t={t} i18nKey={r.key} values={values} components={{ v: <Ltr /> }} />
}
