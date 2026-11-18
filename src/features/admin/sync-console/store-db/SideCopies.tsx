import { useMemo } from 'react'
import type { ColDef, ValueFormatterParams } from 'ag-grid-community'
import type { TFunction } from 'i18next'
import { useTranslation } from 'react-i18next'
import type { StoreDbSideCopy } from '@/core/models/store-database'
import { MONO, formatTime } from '../console-columns'
import TabGrid from '../TabGrid'
import { kbSize } from './size'

/**
 * The side copies restored beside the live database (BO 4038), read-only. Drawn only when the door sends some: an
 * older door (before 4038) sends none. Drawn on the Space panel (918); 919 adds Drop beside each copy.
 */
export default function SideCopies({ copies }: { copies: StoreDbSideCopy[] }) {
  const { t } = useTranslation('sync-console')
  const columns = useMemo(() => buildSideCopyColumns(t), [t])
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
    </section>
  )
}

const copyId = (row: StoreDbSideCopy) => row.name

function buildSideCopyColumns(t: TFunction): ColDef<StoreDbSideCopy>[] {
  return [
    { headerName: t('storeDb.space.sideCopies.columns.name'), field: 'name', flex: 1, minWidth: 200, cellClass: MONO },
    {
      headerName: t('storeDb.space.sideCopies.columns.size'),
      field: 'sizeKb',
      width: 110,
      type: 'rightAligned',
      valueFormatter: (p: ValueFormatterParams<StoreDbSideCopy, number | null>) => {
        const s = kbSize(p.value)
        return s ? t(`storeDb.units.${s.unit}`, { n: s.n }) : ''
      },
    },
    { headerName: t('storeDb.space.sideCopies.columns.createdAt'), field: 'createdAt', width: 150, valueFormatter: formatTime },
  ]
}
