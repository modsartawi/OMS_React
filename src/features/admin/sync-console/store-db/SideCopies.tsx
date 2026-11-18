import { useMemo, useState } from 'react'
import type { ColDef, ICellRendererParams, ValueFormatterParams } from 'ag-grid-community'
import type { TFunction } from 'i18next'
import { Trans, useTranslation } from 'react-i18next'
import type { StoreDbSideCopy } from '@/core/models/store-database'
import { usePermissions } from '@/core/permissions'
import Button from '@/core/ui/Button'
import Ltr from '@/core/ui/Ltr'
import { canRestoreStoreDb } from '../access'
import { MONO, formatTime } from '../console-columns'
import TabGrid from '../TabGrid'
import JobDialog from './JobDialog'
import { canDropCopy } from './restore-helpers'
import { kbText } from './size'

/**
 * The side copies restored beside the live database (BO 4038). Drawn only when the door sends some: an older door
 * (before 4038) sends none. Drawn on the Space panel (918) and the Restore panel (919). With the Restore key, each
 * `POS_Restore_*` copy has Drop (oms 919), through the write rail's `JobDialog` (reason required, tonight by default).
 */
export default function SideCopies({ code, copies }: { code: string; copies: StoreDbSideCopy[] }) {
  const { t } = useTranslation('sync-console')
  const canDrop = canRestoreStoreDb(usePermissions())
  const [dropping, setDropping] = useState<StoreDbSideCopy | null>(null)
  const columns = useMemo(() => buildSideCopyColumns(t, canDrop ? setDropping : null), [t, canDrop])
  if (copies.length === 0) return null
  return (
    <section className="flex flex-col gap-2" data-store-db-side-copies={copies.length}>
      <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{t('storeDb.space.sideCopies.title')}</h3>
      <p className="text-xs text-muted-foreground">{t('storeDb.space.sideCopies.note')}</p>
      <TabGrid
        rows={copies}
        columns={columns}
        rowId={copyId}
        pending={false}
        error={null}
        failed={t('storeDb.space.sideCopies.failed')}
        empty=""
        loading={t('storeDb.space.sideCopies.loading')}
        data="store-db-side-copies"
      />
      <JobDialog
        code={code}
        kind={dropping ? 'DropSideCopy' : null}
        extra={dropping ? { database: dropping.name } : undefined}
        onClose={() => setDropping(null)}
      >
        {dropping && (
          <p className="text-sm" data-drop-dialog={dropping.name}>
            <Trans t={t} i18nKey="storeDb.restore.drop.which" values={{ name: dropping.name }} components={{ name: <Ltr /> }} />
          </p>
        )}
      </JobDialog>
    </section>
  )
}

const copyId = (row: StoreDbSideCopy) => row.name

function buildSideCopyColumns(t: TFunction, onDrop: ((copy: StoreDbSideCopy) => void) | null): ColDef<StoreDbSideCopy>[] {
  const columns: ColDef<StoreDbSideCopy>[] = [
    { headerName: t('storeDb.space.sideCopies.columns.name'), field: 'name', flex: 1, minWidth: 200, cellClass: MONO },
    {
      headerName: t('storeDb.space.sideCopies.columns.size'),
      field: 'sizeKb',
      width: 110,
      type: 'rightAligned',
      valueFormatter: (p: ValueFormatterParams<StoreDbSideCopy, number | null>) => kbText(t, p.value),
    },
    { headerName: t('storeDb.space.sideCopies.columns.createdAt'), field: 'createdAt', width: 150, valueFormatter: formatTime },
  ]
  if (onDrop)
    columns.push({
      headerName: '',
      colId: 'drop',
      width: 90,
      // Only a side copy's name is offered; the door refuses any other name too (BO 4038).
      cellRenderer: (p: ICellRendererParams<StoreDbSideCopy>) =>
        p.data && canDropCopy(p.data.name) ? (
          <Button variant="link" onClick={() => p.data && onDrop(p.data)} data-side-copy-drop={p.data.name}>
            {t('storeDb.jobs.kinds.DropSideCopy.button')}
          </Button>
        ) : null,
    })
  return columns
}
