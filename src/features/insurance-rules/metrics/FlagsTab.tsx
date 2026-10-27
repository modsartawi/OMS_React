import { useQuery } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import { apiErrorMessage, isBareDenial } from '@/core/api'
import { GuardFlags } from '@/core/insurance-rules/badges'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Ltr from '@/core/ui/Ltr'
import { formatDay } from '@/core/util/date-format'
import { flagSettingsQuery, flagsQuery } from './api'
import { flagReason, type FlagRow } from './model'
import { DeniedCard, Loading, RuleName, TD, TH } from './parts'

/**
 * The current flags with their reason (ticket 615; `GET InsuranceRules/Flags`, thresholds from
 * `GET InsuranceRules/Settings/Flags`). A flag never pauses a rule. Not windowed: the flag job keeps its own.
 */
export default function FlagsTab() {
  const { t } = useTranslation('insurance-metrics')
  const flags = useQuery(flagsQuery())
  const settings = useQuery(flagSettingsQuery())
  const s = settings.data

  if (flags.isError && isBareDenial(flags.error)) return <DeniedCard hook="flags-denied" />
  if (flags.isError) return <ErrorBanner className="p-3" message={apiErrorMessage(flags.error, t('flags.failed'))} />
  if (!flags.data) return <Loading>{t('flags.loading')}</Loading>
  return (
    <div className="flex flex-col gap-3" data-flags-tab="">
      <p className="text-sm text-muted-foreground" data-flag-thresholds={s ? '' : undefined}>
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

function Reason({ flag }: { flag: FlagRow }) {
  const { t } = useTranslation('insurance-metrics')
  const r = flagReason(flag)
  const values = r.key === 'reason.silent' ? { ...r.values, lastFired: formatDay(String(r.values.lastFired)) } : r.values
  return <Trans t={t} i18nKey={r.key} values={values} components={{ v: <Ltr /> }} />
}
