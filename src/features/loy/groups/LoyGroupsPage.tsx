import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router'
import { AgGridReact } from 'ag-grid-react'
import { Loader2, Plus } from 'lucide-react'

// Side-effect import: registers the AG Grid Community modules in this lazy chunk.
import '@/core/ag-grid-setup'
import { apiErrorMessage } from '@/core/api'
import { canMaintainLoyGroups, canViewLoyGroups, loyGroupsAccessQuery, loyGroupsQuery } from '@/core/loy-groups/api'
import type { LoyGroup } from '@/core/models/loy-groups'
import { OMS_GRID_HEADER_HEIGHT, OMS_GRID_ROW_HEIGHT, omsGridTheme } from '@/core/theme/ag-grid-theme'
import Button from '@/core/ui/Button'
import Chip from '@/core/ui/Chip'
import ErrorBanner from '@/core/ui/ErrorBanner'
import ScreenGate from '@/core/ui/ScreenGate'
import { GROUPS_DEFAULT_COL_DEF, buildGroupColumns } from './columns'
import CreateGroupDialog from './CreateGroupDialog'
import MobileLookup from './MobileLookup'

/**
 * Loyalty groups — `/loy/groups` (BackOffice spec 3173, oms ticket 629). Every loyalty group: code, name in
 * the UI language, active flag, mobile count and the live bonus-buys naming it. HQ-only.
 *
 * Behind `canViewLoyGroups` on `GET LoyGroupWeb/Access` — the menu leaf reads the same predicate and key.
 * The shared half (model, doors, predicates, keys) lives in `@/core/loy-groups` because bonus-buy
 * maintenance, simulation and the member screen read it too.
 */
export default function LoyGroupsPage() {
  const { t } = useTranslation('loy-groups')
  return (
    <ScreenGate query={loyGroupsAccessQuery()} can={canViewLoyGroups} ns="loy-groups" title={t('title')} subtitle={t('subtitle')}>
      <Groups />
    </ScreenGate>
  )
}

/** `?scope=all` shows inactive groups too; the default (no param) is active only. */
const SCOPES = ['active', 'all'] as const
type Scope = (typeof SCOPES)[number]

function Groups() {
  const { t, i18n } = useTranslation('loy-groups')
  const [params, setParams] = useSearchParams()
  const scope: Scope = params.get('scope') === 'all' ? 'all' : 'active'
  const select = (next: Scope) => {
    if (next === scope) return
    const p = new URLSearchParams(params)
    if (next === 'all') p.set('scope', 'all')
    else p.delete('scope')
    setParams(p, { replace: true })
  }

  const groups = useQuery(loyGroupsQuery(scope === 'all'))
  // Create is a write: absent on a view-only grant (ticket 630).
  const canMaintain = canMaintainLoyGroups(useQuery(loyGroupsAccessQuery()).data)
  const [creating, setCreating] = useState(false)
  const lang = i18n.language
  const columns = useMemo(() => buildGroupColumns(t, lang), [t, lang])

  return (
    <div className="flex min-w-0 flex-col gap-2" data-loy-groups="">
      <MobileLookup />
      <div className="flex flex-wrap items-center gap-2">
        <div role="group" aria-label={t('scope.label')} className="flex gap-1" data-loy-groups-scope={scope}>
          {SCOPES.map((s) => (
            <Chip key={s} on={scope === s} onClick={() => select(s)} data-scope={s}>
              {t(`scope.${s}`)}
            </Chip>
          ))}
        </div>
        {canMaintain && (
          <Button variant="primary" className="ms-auto" onClick={() => setCreating(true)} data-loy-groups-create="">
            <Plus className="h-3.5 w-3.5" aria-hidden />
            {t('create.open')}
          </Button>
        )}
      </div>
      {canMaintain && <CreateGroupDialog open={creating} onClose={() => setCreating(false)} />}
      {groups.isError ? (
        <ErrorBanner className="p-3" message={apiErrorMessage(groups.error, t('failed'))} />
      ) : !groups.data ? (
        <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground" role="status">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          {t('loading')}
        </div>
      ) : groups.data.length === 0 ? (
        <p className="rounded-md border border-border/60 py-6 text-center text-sm text-muted-foreground" data-loy-groups-empty="">
          {t(scope === 'all' ? 'emptyAll' : 'emptyActive')}
        </p>
      ) : (
        <div className="overflow-hidden rounded-md border border-border/60" data-loy-groups-grid="">
          <AgGridReact<LoyGroup>
            theme={omsGridTheme}
            rowData={groups.data}
            columnDefs={columns}
            defaultColDef={GROUPS_DEFAULT_COL_DEF}
            getRowId={({ data }) => data.groupId}
            rowHeight={OMS_GRID_ROW_HEIGHT}
            headerHeight={OMS_GRID_HEADER_HEIGHT}
            domLayout="autoHeight"
            animateRows={false}
            suppressColumnVirtualisation
          />
        </div>
      )}
    </div>
  )
}
