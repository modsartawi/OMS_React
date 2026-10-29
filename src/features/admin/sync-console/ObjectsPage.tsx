import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { AgGridReact } from 'ag-grid-react'

// Side-effect import: registers the AG Grid Community modules in this lazy chunk.
import '@/core/ag-grid-setup'
import { apiErrorMessage } from '@/core/api'
import { OMS_GRID_HEADER_HEIGHT, OMS_GRID_ROW_HEIGHT, omsGridTheme } from '@/core/theme/ag-grid-theme'
import Chip from '@/core/ui/Chip'
import ErrorBanner from '@/core/ui/ErrorBanner'
import ScreenGate from '@/core/ui/ScreenGate'
import { fsi } from '@/core/util/bidi'
import type { PushObject } from '@/core/models/sync-console'
import { canEnrolObjects, canOpenSyncConsole, pushObjectsQuery, syncConsoleAccessQuery } from './api'
import { CONSOLE_DEFAULT_COL_DEF } from './console-columns'
import { figure } from './helpers'
import { buildObjectColumns } from './objects-columns'
import { objectCounts, visibleObjects } from './objects-helpers'
import ConsoleNav from './ConsoleNav'
import EnrolDialog from './EnrolDialog'
import Loading from './Loading'

/**
 * Push objects (ticket 662, BackOffice spec 2557 D10) — `/admin/sync/objects`: every table the
 * deployed build pushes to the stores, read off `GET ActionSync/Objects` (a read:
 * `ActionSync.Health.View`), and whether the stores are enrolled for it.
 *
 * It opens on the objects not yet enrolled — the ones a new wave (IDF: lines 7900-7960) is
 * waiting on; **Show enrolled objects** adds the rest. The door's order is kept.
 *
 * With `canEnrol` (`ActionSync.EnrollObject`), a row not enrolled that has a line number offers
 * **Enrol**, which opens the preview-then-confirm dialog. Without it the list is read only, and
 * says so.
 */
export default function ObjectsPage() {
  const { t } = useTranslation('sync-console')
  return (
    <ScreenGate
      query={syncConsoleAccessQuery()}
      can={canOpenSyncConsole}
      ns="sync-console"
      title={t('objects.title')}
      subtitle={t('objects.subtitle')}
    >
      <Objects />
    </ScreenGate>
  )
}

function Objects() {
  const { t } = useTranslation('sync-console')
  const access = useQuery(syncConsoleAccessQuery())
  const canEnrol = canEnrolObjects(access.data)
  const objects = useQuery(pushObjectsQuery())
  const [showEnrolled, setShowEnrolled] = useState(false)
  const [enrolling, setEnrolling] = useState<PushObject | null>(null)

  const columns = useMemo(() => buildObjectColumns(t, canEnrol, setEnrolling), [t, canEnrol])
  const items = objects.data?.items ?? []
  const rows = useMemo(() => visibleObjects(items, showEnrolled), [items, showEnrolled])
  const counts = objectCounts(items)

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <ConsoleNav />
      <p className="text-xs text-muted-foreground">{t('objects.note')}</p>
      {!canEnrol && access.isSuccess && (
        <p className="text-xs text-muted-foreground" data-objects-no-grant="">
          {t('objects.noGrant')}
        </p>
      )}

      {objects.isPending && <Loading label={t('objects.loading')} />}
      {objects.isError && <ErrorBanner className="p-3" message={apiErrorMessage(objects.error, t('objects.failed'))} />}

      {objects.data && (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs text-muted-foreground" data-objects-counts={`${counts.enrolled}/${counts.total}`}>
              {t('objects.counts', {
                total: fsi(figure(counts.total)),
                enrolled: fsi(figure(counts.enrolled)),
                waiting: fsi(figure(counts.waiting)),
              })}
            </span>
            <Chip on={showEnrolled} onClick={() => setShowEnrolled((v) => !v)} data-objects-show-enrolled="">
              {t('objects.showEnrolled')}
            </Chip>
          </div>

          <div className="overflow-hidden rounded-md border border-border/60" data-objects-list="">
            {rows.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground" data-objects-empty="">
                {t(items.length === 0 ? 'objects.emptyAll' : 'objects.empty')}
              </p>
            ) : (
              <AgGridReact<PushObject>
                theme={omsGridTheme}
                rowData={rows}
                columnDefs={columns}
                defaultColDef={CONSOLE_DEFAULT_COL_DEF}
                getRowId={({ data }) => data.objectId}
                rowHeight={OMS_GRID_ROW_HEIGHT}
                headerHeight={OMS_GRID_HEADER_HEIGHT}
                domLayout="autoHeight"
                animateRows={false}
                suppressColumnVirtualisation
                tooltipShowDelay={300}
              />
            )}
          </div>
        </>
      )}

      <EnrolDialog object={enrolling} onClose={() => setEnrolling(null)} />
    </div>
  )
}
