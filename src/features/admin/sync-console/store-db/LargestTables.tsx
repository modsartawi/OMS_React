import { useMemo } from 'react'
import type { ColDef, ValueFormatterParams } from 'ag-grid-community'
import type { TFunction } from 'i18next'
import { useTranslation } from 'react-i18next'
import type { StoreDbTable } from '@/core/models/store-database'
import { MONO } from '../console-columns'
import { figure } from '../helpers'
import TabGrid from '../TabGrid'
import { kbSize } from './size'

/**
 * The reading's largest tables (BO 4031: the ten largest), in the server's order (largest reserved first). Not
 * client-sortable (the console's default col def); every value is a plain grid value, isolated by the base col def.
 */
export default function LargestTables({ tables }: { tables: StoreDbTable[] }) {
  const { t } = useTranslation('sync-console')
  const columns = useMemo(() => buildTableColumns(t), [t])
  return (
    <section className="flex flex-col gap-2" data-store-db-tables={tables.length}>
      <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{t('storeDb.readings.tables.title')}</h3>
      <TabGrid
        rows={tables}
        columns={columns}
        rowId={tableId}
        pending={false}
        error={null}
        failed={t('storeDb.readings.failed')}
        empty={t('storeDb.readings.tables.empty')}
        loading={t('storeDb.readings.loading')}
        data="store-db-tables"
      />
    </section>
  )
}

const tableId = (row: StoreDbTable) => row.tableName

function buildTableColumns(t: TFunction): ColDef<StoreDbTable>[] {
  const size = (p: ValueFormatterParams<StoreDbTable, number | null>) => {
    const s = kbSize(p.value)
    return s ? t(`storeDb.units.${s.unit}`, { n: s.n }) : ''
  }
  return [
    { headerName: t('storeDb.readings.tables.columns.table'), field: 'tableName', flex: 1, minWidth: 180, cellClass: MONO },
    {
      headerName: t('storeDb.readings.tables.columns.rows'),
      field: 'rows',
      width: 120,
      type: 'rightAligned',
      valueFormatter: (p: ValueFormatterParams<StoreDbTable, number | null>) => (p.value == null ? '' : figure(p.value)),
    },
    { headerName: t('storeDb.readings.tables.columns.reserved'), field: 'reservedKb', width: 110, type: 'rightAligned', valueFormatter: size },
    { headerName: t('storeDb.readings.tables.columns.data'), field: 'dataKb', width: 110, type: 'rightAligned', valueFormatter: size },
    { headerName: t('storeDb.readings.tables.columns.index'), field: 'indexKb', width: 110, type: 'rightAligned', valueFormatter: size },
  ]
}
