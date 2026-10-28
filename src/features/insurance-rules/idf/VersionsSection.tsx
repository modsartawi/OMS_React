import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import { History, Loader2, RotateCcw } from 'lucide-react'

import { apiErrorMessage } from '@/core/api'
import { notify } from '@/core/services/notify'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Field from '@/core/ui/Field'
import Input from '@/core/ui/Input'
import Ltr from '@/core/ui/Ltr'
import { fsi } from '@/core/util/bidi'
import { formatFigure } from '@/core/util/number-format'
import { ByAt, Loading, TD, TH } from '@/core/insurance-rules/parts'
import { IDF_KEY, idfVersionsApi, versionsQuery } from './api'
import { versionRows, type IdfVersionRow } from './versions'

/**
 * A master's **Versions** (BackOffice spec 3157, door 3161; oms ticket 623), on the master's page under Upload.
 * Number, by, at, how many items it holds (`entryCount`), note, the live one marked (`isLive`, 3161). Any earlier version offers **Restore**, which asks for a note and makes
 * a NEW live version from it — never an overwrite: the restored version stays in the list as it was. A restore
 * invalidates every IDF query, so the header, this list and the masters list all show the new live version.
 */
export default function VersionsSection({ masterId, liveVersionId }: { masterId: string; liveVersionId: string | null }) {
  const { t } = useTranslation('insurance-idf')
  const versions = useQuery(versionsQuery(masterId))
  const [picked, setPicked] = useState<IdfVersionRow | null>(null)
  const rows = versionRows(versions.data, liveVersionId)
  return (
    <div className="flex max-w-4xl flex-col gap-3 rounded-md border border-border/60 bg-card p-3" data-idf-versions="">
      <div className="flex items-center gap-2 text-sm font-medium">
        <History className="h-4 w-4 text-muted-foreground" aria-hidden />
        {t('versions.title')}
      </div>
      <p className="text-xs text-muted-foreground">{t('versions.lede')}</p>
      {versions.isError ? (
        <ErrorBanner message={apiErrorMessage(versions.error, t('versions.failed'))} />
      ) : !versions.data ? (
        <Loading text={t('versions.loading')} />
      ) : rows.length === 0 ? (
        <p className="py-3 text-center text-sm text-muted-foreground" data-idf-versions-empty="">
          {t('versions.empty')}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-md border border-border/60">
          <table className="w-full text-sm" data-idf-versions-rows="">
            <thead className="bg-muted/50">
              <tr>
                <th className={`${TH} text-end`}>{t('versions.columns.number')}</th>
                <th className={TH}>{t('versions.columns.byAt')}</th>
                <th className={`${TH} text-end`}>{t('versions.columns.entries')}</th>
                <th className={TH}>{t('versions.columns.note')}</th>
                <th className={TH}>{t('versions.columns.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((v) => (
                <tr key={v.versionId} className="border-t border-border/60" data-version={v.versionId} data-number={v.number} data-live={v.live ? 'true' : 'false'}>
                  <td className={`${TD} text-end tabular-nums`} data-col="number">
                    <span className="inline-flex items-center gap-2">
                      {v.live && (
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary" data-live-mark="">
                          {t('versions.live')}
                        </span>
                      )}
                      <Ltr>{formatFigure(v.number)}</Ltr>
                    </span>
                  </td>
                  <td className={`${TD} text-xs`} data-col="byAt">
                    <ByAt by={v.by} at={v.at} />
                  </td>
                  <td className={`${TD} text-end tabular-nums`} data-col="entries">
                    {v.entryCount != null && <Ltr>{formatFigure(v.entryCount)}</Ltr>}
                  </td>
                  <td className={`${TD} text-xs`} data-col="note">
                    {v.note && <bdi>{v.note}</bdi>}
                  </td>
                  <td className={TD} data-col="actions">
                    {v.restorable && (
                      <Button variant="secondary" data-idf-restore="" onClick={() => setPicked(v)}>
                        <RotateCcw className="h-3.5 w-3.5" aria-hidden />
                        {t('versions.restore')}
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {picked && <RestorePanel key={picked.versionId} masterId={masterId} version={picked} onDone={() => setPicked(null)} />}
    </div>
  )
}

function RestorePanel({ masterId, version, onDone }: { masterId: string; version: IdfVersionRow; onDone: () => void }) {
  const { t } = useTranslation('insurance-idf')
  const queryClient = useQueryClient()
  const [note, setNote] = useState('')
  const restore = useMutation({
    mutationFn: () => idfVersionsApi.restore(masterId, version.versionId, note.trim()),
    onSuccess: async (v) => {
      notify.success(t('versions.restored'), t('versions.restoredDetail', { from: fsi(formatFigure(version.number)), n: fsi(formatFigure(v.number)) }))
      onDone()
      await queryClient.invalidateQueries({ queryKey: IDF_KEY })
    },
  })
  const n = formatFigure(version.number)
  return (
    <div className="flex flex-col gap-2 border-t border-border/60 pt-3" data-idf-restore-panel={version.versionId}>
      <div className="text-sm font-medium" data-idf-restore-title="">
        <Trans t={t} i18nKey="versions.restoreTitle" values={{ n }} components={{ v: <Ltr /> }} />
      </div>
      <p className="text-xs text-muted-foreground">
        <Trans t={t} i18nKey="versions.restoreHint" values={{ n }} components={{ v: <Ltr /> }} />
      </p>
      <div className="flex flex-wrap items-end gap-2">
        <Field label={t('versions.note')} className="min-w-64 flex-1">
          <Input value={note} placeholder={t('versions.notePlaceholder')} data-idf-restore-note="" onChange={(e) => setNote(e.target.value)} />
        </Field>
        <Button variant="primary" data-idf-restore-confirm="" disabled={note.trim() === '' || restore.isPending} onClick={() => restore.mutate()}>
          {restore.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <RotateCcw className="h-3.5 w-3.5" aria-hidden />}
          {t('versions.confirm')}
        </Button>
        <Button variant="ghost" data-idf-restore-cancel="" disabled={restore.isPending} onClick={onDone}>
          {t('versions.cancel')}
        </Button>
      </div>
      {restore.isError && (
        <div data-idf-restore-refused="">
          <ErrorBanner message={apiErrorMessage(restore.error, t('versions.restoreFailed'))} />
        </div>
      )}
    </div>
  )
}
