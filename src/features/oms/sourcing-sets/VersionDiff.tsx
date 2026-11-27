import { Fragment, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import { apiErrorMessage } from '@/core/api'
import type { WeightSetVersionRef } from '@/core/models/sourcing-run'
import Chip from '@/core/ui/Chip'
import ErrorBanner from '@/core/ui/ErrorBanner'
import { TD, TH } from '@/core/ui/sheet-table'
import { versionQuery } from './api'
import { CARD, H2, NS, SetRef, SettingName, SettingValue } from './parts'
import { versionDiff } from './version-diff-model'

/**
 * What differs between the two ticked versions (ticket 967). The owner's default: the changed settings only, grouped;
 * "Show every setting" lists them all with the changed ones marked.
 */
export default function VersionDiff({ pair }: { pair: { from: WeightSetVersionRef; to: WeightSetVersionRef } | null }) {
  const { t } = useTranslation(NS)
  const [every, setEvery] = useState(false)
  const from = useQuery({
    ...versionQuery(pair?.from ?? { name: '', version: 0 }),
    enabled: !!pair,
  })
  const to = useQuery({
    ...versionQuery(pair?.to ?? { name: '', version: 0 }),
    enabled: !!pair,
  })

  if (!pair)
    return (
      <section className={`${CARD} text-sm text-muted-foreground`} data-diff="" data-diff-state="pick">
        {t('diff.pickTwo')}
      </section>
    )

  const failed = from.error ?? to.error
  const groups = from.data && to.data ? versionDiff(from.data.values, to.data.values, { every }) : null

  return (
    <section className={CARD} data-diff="" data-diff-state={groups ? 'shown' : failed ? 'failed' : 'reading'}>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h2 className={H2}>{t('diff.title')}</h2>
        <Chip on={every} onClick={() => setEvery((e) => !e)} data-diff-every="">
          {t('diff.everySetting')}
        </Chip>
      </div>
      {failed ? (
        <ErrorBanner title={t('diff.failedTitle')} message={apiErrorMessage(failed, t('diff.failed'))} />
      ) : !groups ? (
        <p className="inline-flex items-center gap-2 text-sm text-muted-foreground" role="status">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          {t('diff.reading')}
        </p>
      ) : groups.length === 0 ? (
        <p className="text-sm text-muted-foreground" data-diff-none="">
          {t('diff.none')}
        </p>
      ) : (
        <table className="w-full text-xs">
          <thead className="border-b border-border text-muted-foreground">
            <tr>
              <th className={TH}>{t('diff.setting')}</th>
              <th className={TH}>
                {t('diff.from')} <SetRef r={pair.from} />
              </th>
              <th className={TH}>
                {t('diff.to')} <SetRef r={pair.to} />
              </th>
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => (
              <Fragment key={g.group}>
                <tr className="border-b border-border" data-diff-group={g.group}>
                  <th className={`${TH} pt-3 text-muted-foreground`} colSpan={3} scope="colgroup">
                    {t(`groups.${g.group}`)}
                  </th>
                </tr>
                {g.rows.map((r) => (
                  <tr
                    key={r.key}
                    className={`border-b border-border ${r.changed && every ? 'bg-attention-050' : ''}`}
                    data-diff-row={r.key}
                    data-changed={r.changed}
                  >
                    <td className={TD}>
                      <SettingName row={r} />
                    </td>
                    <td className={TD}>
                      <SettingValue row={r} value={r.before} />
                    </td>
                    <td className={`${TD} ${r.changed ? 'font-semibold' : ''}`}>
                      <SettingValue row={r} value={r.after} />
                    </td>
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}
