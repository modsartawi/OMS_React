import { useMemo, useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'

import Chip from '@/core/ui/Chip'
import Ltr from '@/core/ui/Ltr'
import ScreenGate from '@/core/ui/ScreenGate'
import Select from '@/core/ui/Select'
import { STORE_DB_ENGINES, STORE_DB_STATES, type StoreDbFleetRow } from '@/core/models/store-database'
import { fsi } from '@/core/util/bidi'
import { canViewStoreDb } from '../access'
import ConsoleNav from '../ConsoleNav'
import { figure } from '../helpers'
import TabGrid from '../TabGrid'
import { storeDbFleetQuery } from './api'
import { buildStoreDbFleetColumns } from './fleet-columns'
import { ALL_FLEET, fleetEditions, shownFleet, type FleetFilter } from './fleet-helpers'

/**
 * The Store database tab (oms 915, BackOffice spec 4016 D10) — `/admin/sync/database`.
 *
 * Every store's POS database against its size cap, worst state first, then the fewest days to cap. Filters (state,
 * engine, edition) and the Needs 2019 view (the stores on a 4 GB cap, nearest first) are client-side: the Fleet door
 * is unpaged. A page of the console (its own `ConsoleNav` entry), behind its own View grant — the console's leaf does
 * not imply it.
 *
 * 🚩 Read only. Check now, the jobs and Restore are the store page's (916–919).
 */
export default function StoreDbFleetPage() {
  const { t } = useTranslation('sync-console')
  return (
    <ScreenGate can={canViewStoreDb} ns="sync-console" keyPrefix="storeDb.access" title={t('storeDb.title')} subtitle={t('storeDb.subtitle')}>
      <Fleet />
    </ScreenGate>
  )
}

const MAX_ROWS = 20

/** AG Grid reads `getRowId` once: module-level. */
const rowId = (row: StoreDbFleetRow) => row.code

function Fleet() {
  const { t } = useTranslation('sync-console')
  const fleet = useQuery(storeDbFleetQuery())
  const [filter, setFilter] = useState<FleetFilter>(ALL_FLEET)
  const columns = useMemo(() => buildStoreDbFleetColumns(t), [t])
  const all = fleet.data
  const rows = useMemo(() => (all ? shownFleet(all, filter) : undefined), [all, filter])
  const editions = useMemo(() => (all ? fleetEditions(all) : []), [all])
  const filtered = JSON.stringify(filter) !== JSON.stringify(ALL_FLEET)

  return (
    <div className="flex min-w-0 flex-col gap-4" data-store-db-fleet="">
      <ConsoleNav />

      <section aria-label={t('storeDb.fleet.label')} className="flex min-w-0 flex-col gap-2">
        <div className="flex flex-wrap items-end gap-3" data-store-db-filters="">
          <Labelled label={t('storeDb.fleet.filters.state')}>
            <Select
              value={filter.state ?? ''}
              onChange={(e) => setFilter((f) => ({ ...f, state: e.target.value || null }))}
              data-filter-state=""
            >
              <option value="">{t('storeDb.fleet.filters.all')}</option>
              {STORE_DB_STATES.map((s) => (
                <option key={s} value={s}>
                  {t(`storeDb.states.${s}`)}
                </option>
              ))}
            </Select>
          </Labelled>
          <Labelled label={t('storeDb.fleet.filters.engine')}>
            <Select
              value={filter.engine ?? ''}
              onChange={(e) => setFilter((f) => ({ ...f, engine: e.target.value || null }))}
              data-filter-engine=""
            >
              <option value="">{t('storeDb.fleet.filters.all')}</option>
              {STORE_DB_ENGINES.map((e) => (
                <option key={e} value={e}>
                  {t(`storeDb.engines.${e}`)}
                </option>
              ))}
            </Select>
          </Labelled>
          <Labelled label={t('storeDb.fleet.filters.edition')}>
            <Select
              value={filter.edition ?? ''}
              onChange={(e) => setFilter((f) => ({ ...f, edition: e.target.value || null }))}
              data-filter-edition=""
            >
              <option value="">{t('storeDb.fleet.filters.all')}</option>
              {editions.map((e) => (
                // A native option is a string-only sink: the server's edition text is isolated whole.
                <option key={e} value={e}>
                  {fsi(e)}
                </option>
              ))}
            </Select>
          </Labelled>
          <Chip on={filter.needs2019} onClick={() => setFilter((f) => ({ ...f, needs2019: !f.needs2019 }))} data-needs-2019="">
            {t('storeDb.fleet.filters.needs2019')}
          </Chip>
          {fleet.isFetching && !fleet.isPending && (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-hidden />
          )}
        </div>
        {filter.needs2019 && (
          <p className="text-sm text-muted-foreground" data-needs-2019-note="">
            {t('storeDb.fleet.filters.needs2019Note')}
          </p>
        )}
        {all && rows && rows.length > 0 && (
          <p className="text-xs text-muted-foreground" data-store-db-shown={rows.length}>
            <Trans
              t={t}
              i18nKey="storeDb.fleet.shown"
              values={{ n: figure(rows.length), total: figure(all.length) }}
              components={{ n: <Ltr />, total: <Ltr /> }}
            />
          </p>
        )}
        <TabGrid
          rows={rows}
          columns={columns}
          rowId={rowId}
          pending={fleet.isPending}
          error={fleet.error}
          failed={t('storeDb.fleet.failed')}
          empty={filtered && all && all.length > 0 ? t('storeDb.fleet.emptyFiltered') : t('storeDb.fleet.empty')}
          loading={t('storeDb.fleet.loading')}
          data="store-db-fleet"
          // Sized to its rows up to 20 (autoHeight leaves room for the horizontal scrollbar); past that it scrolls.
          maxRows={rows && rows.length > MAX_ROWS ? MAX_ROWS : undefined}
        />
      </section>
    </div>
  )
}

function Labelled({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-xs text-muted-foreground">
      <span>{label}</span>
      {children}
    </label>
  )
}
