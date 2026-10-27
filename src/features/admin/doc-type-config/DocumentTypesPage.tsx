import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { AgGridReact } from 'ag-grid-react'
import type { ColDef } from 'ag-grid-community'
import { Loader2 } from 'lucide-react'

// Side-effect import: registers the AG Grid Community modules in this lazy chunk.
import '@/core/ag-grid-setup'
import { apiErrorMessage } from '@/core/api'
import { OMS_GRID_HEADER_HEIGHT, OMS_GRID_ROW_HEIGHT, omsGridTheme } from '@/core/theme/ag-grid-theme'
import { OMS_GRID_BASE_COL_DEF } from '@/core/theme/grid-base'
import ErrorBanner from '@/core/ui/ErrorBanner'
import ScreenGate from '@/core/ui/ScreenGate'
import { canViewDocTypeConfig, docTypeConfigAccessQuery, documentTypesQuery } from './api'
import { categoriesOf, filterDocumentTypes } from './list-filter'
import type { DocumentTypeListRow } from './types'

const DEFAULT_COL_DEF: ColDef = { ...OMS_GRID_BASE_COL_DEF, sortable: true, filter: false, resizable: true, cellDataType: false }

/**
 * Document types — `/admin/doc-types` (BackOffice spec 3148 stories 5-6, ticket 3149). Every OMS document type with
 * its code, description, category and engine; filtered by category and searched by code or description. A row opens
 * the type (`/admin/doc-types/:documentType`). Behind the existing OMS access (`canViewDocTypeConfig`) — the menu leaf
 * reads the same predicate.
 */
export default function DocumentTypesPage() {
  const { t } = useTranslation('doc-type-config')
  return (
    <ScreenGate query={docTypeConfigAccessQuery()} can={canViewDocTypeConfig} ns="doc-type-config" title={t('title')} subtitle={t('subtitle')}>
      <DocumentTypes />
    </ScreenGate>
  )
}

function DocumentTypes() {
  const { t } = useTranslation('doc-type-config')
  const navigate = useNavigate()
  const types = useQuery(documentTypesQuery())
  const [category, setCategory] = useState('')
  const [search, setSearch] = useState('')
  const rows = useMemo(() => filterDocumentTypes(types.data ?? [], { category, search }), [types.data, category, search])
  const categories = useMemo(() => categoriesOf(types.data ?? []), [types.data])
  const columns = useMemo<ColDef<DocumentTypeListRow>[]>(
    () => [
      { field: 'documentType', headerName: t('list.columns.documentType'), width: 110 },
      { field: 'description', headerName: t('list.columns.description'), flex: 1, minWidth: 220 },
      { field: 'documentCategory', headerName: t('list.columns.documentCategory'), width: 120 },
      { field: 'engineType', headerName: t('list.columns.engineType'), width: 150 },
    ],
    [t],
  )

  if (types.isError) return <ErrorBanner className="p-3" message={apiErrorMessage(types.error, t('list.failed'))} />
  if (!types.data) {
    return (
      <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground" role="status">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        {t('list.loading')}
      </div>
    )
  }

  return (
    <div className="flex min-w-0 flex-col gap-2" data-doc-types="">
      <div className="flex flex-wrap items-end gap-3" data-doc-types-toolbar="">
        <label className="flex flex-col gap-1 text-xs font-medium">
          {t('list.category')}
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="rounded-md border border-border/60 bg-background px-2 py-1.5 text-sm font-normal"
            data-doc-types-category=""
          >
            <option value="">{t('list.allCategories')}</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('list.search')}
          aria-label={t('list.search')}
          dir="auto"
          className="min-w-64 rounded-md border border-border/60 bg-background px-2 py-1.5 text-sm"
          data-doc-types-search=""
        />
      </div>
      {types.data.length === 0 || rows.length === 0 ? (
        <p className="rounded-md border border-border/60 py-6 text-center text-sm text-muted-foreground" data-doc-types-empty="">
          {t(types.data.length === 0 ? 'list.empty' : 'list.noMatch')}
        </p>
      ) : (
        <div className="overflow-hidden rounded-md border border-border/60" data-doc-types-grid="">
          <AgGridReact<DocumentTypeListRow>
            theme={omsGridTheme}
            rowData={rows}
            columnDefs={columns}
            defaultColDef={DEFAULT_COL_DEF}
            getRowId={({ data }) => data.documentType}
            rowHeight={OMS_GRID_ROW_HEIGHT}
            headerHeight={OMS_GRID_HEADER_HEIGHT}
            domLayout="autoHeight"
            animateRows={false}
            suppressColumnVirtualisation
            rowClass="cursor-pointer"
            onRowClicked={(e) => e.data && navigate(`/admin/doc-types/${encodeURIComponent(e.data.documentType)}`)}
          />
        </div>
      )}
    </div>
  )
}
