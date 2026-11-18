import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import { ShieldCheck } from 'lucide-react'
import type { StoreDbBackupFile } from '@/core/models/store-database'
import { usePermissions } from '@/core/permissions'
import Button from '@/core/ui/Button'
import Field from '@/core/ui/Field'
import Input from '@/core/ui/Input'
import Ltr from '@/core/ui/Ltr'
import { formatDateTime, toIsoDate } from '@/core/util/date-format'
import { canRestoreStoreDb } from '../access'
import TabGrid from '../TabGrid'
import { storeDbBackupsQuery } from './api'
import { buildBackupColumns } from './backups-columns'
import JobDialog from './JobDialog'
import type { StoreDbPanelProps } from './panel-views'
import { sideCopyName } from './restore-helpers'
import SideCopies from './SideCopies'

const fileId = (f: StoreDbBackupFile) => f.file

/**
 * The Restore panel (oms 919; BO 4038, spec 4016 D16). Browse lists the `.bak` files in a folder on the store's SQL
 * machine (empty = the store's backup folder) with each one's header or error — a View read. With the Restore key, a
 * file is restored into a NEW side copy (`POS_Restore_yyyymmdd`) through the write rail's `JobDialog`; a newer-engine or
 * unreadable file is disabled with its reason. The live database is never replaced from here, and the panel says so.
 * The side copies, with Drop, are listed here as on the Space panel.
 */
export default function RestorePanel({ store }: StoreDbPanelProps) {
  const { t } = useTranslation('sync-console')
  const permissions = usePermissions()
  const canRestore = canRestoreStoreDb(permissions)
  /** The folder field as typed; `null` = untouched (it then shows the folder Browse read). */
  const [typed, setTyped] = useState<string | null>(null)
  /** The folder Browse asked for; `null` = the backup folder, `undefined` = not browsed yet. */
  const [asked, setAsked] = useState<string | null | undefined>(undefined)
  const [chosen, setChosen] = useState<StoreDbBackupFile | null>(null)
  const backups = useQuery(storeDbBackupsQuery(store.code, asked))
  const data = backups.isError ? undefined : backups.data
  const storeEngine = data?.storeEngineVersion ?? store.reading?.productVersion ?? null

  const columns = useMemo(
    () => buildBackupColumns(t, { storeEngineVersion: storeEngine, onRestore: canRestore ? setChosen : null }),
    [t, storeEngine, canRestore],
  )

  const browse = () => {
    const next = (typed ?? data?.folder ?? '').trim() || null
    if (next === asked) void backups.refetch()
    else setAsked(next)
  }

  const newName =
    data?.nextSideCopyName ||
    sideCopyName(
      toIsoDate(new Date()),
      store.sideCopies.map((c) => c.name),
    )

  return (
    <div className="flex flex-col gap-5" data-restore-panel="" data-restore-controls={canRestore ? 'on' : 'off'}>
      <p className="flex items-start gap-2 rounded-md border border-border/60 p-3 text-sm" data-restore-never-live="">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        <span>{t('storeDb.restore.neverLive')}</span>
      </p>

      <section className="flex flex-col gap-3" data-restore-browse={asked === undefined ? '' : (asked ?? 'default')}>
        <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{t('storeDb.restore.title')}</h3>
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            browse()
          }}
        >
          <Field label={t('storeDb.restore.folder')} hint={t('storeDb.restore.folderHint')} className="min-w-72 flex-1">
            <Input
              dir="ltr"
              className="w-full font-mono"
              value={typed ?? data?.folder ?? ''}
              placeholder={t('storeDb.restore.folderPlaceholder')}
              onChange={(e) => setTyped(e.target.value)}
              data-restore-folder=""
            />
          </Field>
          <Button type="submit" variant="secondary" disabled={backups.isFetching} data-restore-browse-button="">
            {t('storeDb.restore.browse')}
          </Button>
        </form>

        {asked === undefined ? (
          <p className="text-sm text-muted-foreground" data-restore-not-browsed="">
            {t('storeDb.restore.notBrowsed')}
          </p>
        ) : (
          <>
            {data && (
              <p className="text-xs text-muted-foreground" data-restore-read-folder={data.folder}>
                <Trans t={t} i18nKey="storeDb.restore.readFolder" values={{ folder: data.folder }} components={{ folder: <Ltr /> }} />
              </p>
            )}
            <TabGrid
              rows={data?.files}
              columns={columns}
              rowId={fileId}
              pending={backups.isPending}
              error={backups.error}
              failed={t('storeDb.restore.failed')}
              empty={t('storeDb.restore.empty')}
              loading={t('storeDb.restore.browsing')}
              data="store-db-backups"
            />
          </>
        )}
      </section>

      <SideCopies code={store.code} copies={store.sideCopies} />

      <JobDialog
        code={store.code}
        kind={chosen ? 'RestoreSideCopy' : null}
        extra={chosen ? { file: chosen.file } : undefined}
        onClose={() => setChosen(null)}
      >
        {chosen && (
          <div className="flex flex-col gap-1.5 text-sm" data-restore-dialog="">
            <p>
              <Trans
                t={t}
                i18nKey="storeDb.restore.dialog.file"
                values={{ file: chosen.file, at: formatDateTime(chosen.backupDate) }}
                components={{ file: <Ltr />, at: <Ltr /> }}
              />
            </p>
            <p data-restore-side-copy-name={newName}>
              <Trans t={t} i18nKey="storeDb.restore.dialog.creates" values={{ name: newName }} components={{ name: <Ltr /> }} />
            </p>
          </div>
        )}
      </JobDialog>
    </div>
  )
}
