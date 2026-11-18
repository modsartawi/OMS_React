import type { ColDef, ICellRendererParams } from 'ag-grid-community'
import type { TFunction } from 'i18next'
import { Trans } from 'react-i18next'
import type { StoreDbBackupFile } from '@/core/models/store-database'
import Button from '@/core/ui/Button'
import { MONO, formatTime } from '../console-columns'
import { restoreChoice, type RestoreChoice } from './restore-helpers'
import { kbText } from './size'

/** What the Restore panel's file grid needs beyond the rows. */
export interface BackupColumnsContext {
  /** The store's engine, to judge "newer" by when the server sends no flag. */
  storeEngineVersion: string | null
  /** With the Restore key: the action column, opening the restore dialog for one file. `null` = no action column. */
  onRestore: ((file: StoreDbBackupFile) => void) | null
}

/**
 * The Restore panel's Browse result (oms 919, BO 4038): each `.bak` with its header — database, backup date, size,
 * engine — or the engine's error, and why a file cannot be restored here. With the Restore key, a Restore button per
 * file; a file that cannot be chosen (newer engine, unreadable) keeps its button, disabled, with the reason beside it.
 */
export function buildBackupColumns(t: TFunction, ctx: BackupColumnsContext): ColDef<StoreDbBackupFile>[] {
  // One judgement per file, read by the status and the action column alike.
  const choices = new WeakMap<StoreDbBackupFile, RestoreChoice>()
  const choiceOf = (file: StoreDbBackupFile): RestoreChoice => {
    let choice = choices.get(file)
    if (!choice) choices.set(file, (choice = restoreChoice(file, ctx.storeEngineVersion)))
    return choice
  }
  const columns: ColDef<StoreDbBackupFile>[] = [
    { headerName: t('storeDb.restore.columns.file'), field: 'fileName', flex: 1, minWidth: 200, cellClass: MONO, tooltipField: 'file' },
    { headerName: t('storeDb.restore.columns.database'), field: 'database', width: 130, cellClass: MONO },
    { headerName: t('storeDb.restore.columns.backupDate'), field: 'backupDate', width: 150, valueFormatter: formatTime },
    { headerName: t('storeDb.restore.columns.size'), field: 'sizeKb', width: 100, type: 'rightAligned', valueFormatter: (p) => kbText(t, p.value) },
    { headerName: t('storeDb.restore.columns.engine'), field: 'engineVersion', width: 120, cellClass: MONO },
    {
      headerName: t('storeDb.restore.columns.status'),
      colId: 'status',
      flex: 1,
      minWidth: 260,
      tooltipField: 'error',
      cellRenderer: (p: ICellRendererParams<StoreDbBackupFile>) => {
        if (!p.data) return null
        const choice = choiceOf(p.data)
        if (choice.ok) return <span data-backup-status="ok">{t('storeDb.restore.why.ok')}</span>
        return (
          <span className="text-danger-800" data-backup-status={choice.why}>
            {p.data.error ? (
              <Trans
                t={t}
                i18nKey={`storeDb.restore.whyError.${choice.why}`}
                values={{ error: p.data.error }}
                components={{ error: <bdi data-backup-error="" /> }}
              />
            ) : (
              t(`storeDb.restore.why.${choice.why}`)
            )}
          </span>
        )
      },
    },
  ]
  const onRestore = ctx.onRestore
  if (onRestore)
    columns.push({
      headerName: '',
      colId: 'restore',
      width: 110,
      cellRenderer: (p: ICellRendererParams<StoreDbBackupFile>) => {
        if (!p.data) return null
        const file = p.data
        const choice = choiceOf(file)
        return (
          <Button
            variant="link"
            disabled={!choice.ok}
            title={choice.ok ? undefined : t(`storeDb.restore.why.${choice.why}`)}
            onClick={() => choice.ok && onRestore(file)}
            data-backup-restore={file.fileName}
          >
            {t('storeDb.jobs.kinds.RestoreSideCopy.button')}
          </Button>
        )
      },
    })
  return columns
}
