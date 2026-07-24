import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AgGridReact } from 'ag-grid-react'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, CheckCircle2, Loader2, Store } from 'lucide-react'
import type { ColDef, RowSelectionOptions, SelectionChangedEvent, ValueGetterParams } from 'ag-grid-community'
import '@/core/ag-grid-setup'
import Modal from '@/core/ui/Modal'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import { apiErrorMessage } from '@/core/api'
import i18n from '@/core/i18n'
import { lookupQueries } from '@/core/services/lookups'
import { OMS_GRID_HEADER_HEIGHT, OMS_GRID_ROW_HEIGHT, omsGridTheme } from '@/core/theme/ag-grid-theme'
import type { SdDistrictModel, StoreDetailModel } from '@/core/models/lookups'
import type { SdDocumentHeaderModel } from '@/core/models/sd-document'
import { DETAIL_DEFAULT_COL_DEF } from './columns'
import { changeStoreMode, deriveStoreCode, districtCityName } from './change-store'

/** What the dialog reports when the operator commits a store change. */
export interface ChangeStoreResult {
  /** The new store code — `actionData`. */
  actionData: string
  /** The shipping city — `actionData2` in delivery mode; else `''`. */
  actionData2: string
}

function boolText(value: unknown): string {
  return value === true ? i18n.t('common:yes') : value === false ? i18n.t('common:no') : ''
}

/** Single-row selection — clicking a row picks it; no checkbox column. */
const PICKER_ROW_SELECTION: RowSelectionOptions = {
  mode: 'singleRow',
  checkboxes: false,
  enableClickSelection: true,
}

/**
 * Screen 2 — Change Store picker.
 *
 * The document's `deliveryType` decides the mode, and the two never mix:
 *
 * - **pick-in-store** (`deliveryType === 'P'`) — lists the open stores; the
 *   picked `storeCode` is sent as-is.
 * - **delivery** (any other type) — searches districts; the fulfilling store is
 *   *derived* (`tempStoreCode || storeCode`). A district resolving to no store
 *   BLOCKS submit rather than posting an empty store.
 *
 * The grid's floating filters are the search. The dialog opens directly from the
 * command panel and its primary button is the confirmation (D-20).
 */
export default function ChangeStoreDialog({
  open,
  onClose,
  document,
  onConfirmed,
}: {
  open: boolean
  onClose: () => void
  document: SdDocumentHeaderModel
  onConfirmed: (result: ChangeStoreResult) => void
}) {
  const { t } = useTranslation('document')
  const mode = changeStoreMode(document.deliveryType)
  const pickInStore = mode === 'pick-in-store'

  const [store, setStore] = useState<StoreDetailModel | null>(null)
  const [district, setDistrict] = useState<SdDistrictModel | null>(null)

  const stores = useQuery({ ...lookupQueries.storeDetails(), enabled: open && pickInStore })
  const districts = useQuery({ ...lookupQueries.districts(), enabled: open && !pickInStore })

  const active = pickInStore ? stores : districts
  const loading = active.isPending
  const error = active.error

  const storeColumns = useMemo<ColDef<StoreDetailModel>[]>(
    () => [
      { headerName: t('changeStore.storeCode'), field: 'storeCode', width: 130 },
      { headerName: t('changeStore.city'), field: 'city', width: 150 },
      { headerName: t('changeStore.region'), field: 'region', width: 170 },
      { headerName: t('changeStore.storeAddress'), field: 'storeAddress', minWidth: 220, flex: 1 },
      {
        headerName: t('changeStore.deliveryStore'),
        colId: 'deliveryStore',
        width: 140,
        valueGetter: (p: ValueGetterParams<StoreDetailModel>) => boolText(p.data?.deliveryStore),
      },
    ],
    [t],
  )

  const districtColumns = useMemo<ColDef<SdDistrictModel>[]>(
    () => [
      { headerName: t('changeStore.districtEn'), field: 'districtNameEn', width: 180 },
      { headerName: t('changeStore.districtAr'), field: 'districtNameAr', width: 180 },
      { headerName: t('changeStore.cityEn'), field: 'cityNameEn', width: 150 },
      { headerName: t('changeStore.cityAr'), field: 'cityNameAr', width: 150 },
      { headerName: t('changeStore.storeCode'), field: 'storeCode', width: 120 },
      { headerName: t('changeStore.tempStore'), field: 'tempStoreCode', width: 120 },
      { headerName: t('changeStore.insuranceStore'), field: 'insuranceStoreCode', width: 140 },
    ],
    [t],
  )

  const derived = pickInStore ? (store?.storeCode ?? '').trim() : deriveStoreCode(district)
  const unresolved = !pickInStore && !!district && derived === ''
  const canSubmit = !loading && !error && derived !== ''

  function onSelectionChanged(event: SelectionChangedEvent) {
    const row = event.api.getSelectedRows()[0] ?? null
    if (pickInStore) setStore(row as StoreDetailModel | null)
    else setDistrict(row as SdDistrictModel | null)
  }

  function submit() {
    if (!canSubmit) return
    onConfirmed({ actionData: derived, actionData2: pickInStore ? '' : districtCityName(district) })
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={pickInStore ? t('changeStore.titlePick') : t('changeStore.titleDelivery')}
      width="62rem"
      onShow={() => {
        setStore(null)
        setDistrict(null)
      }}
      footer={
        <>
          <Button variant="text" onClick={onClose}>
            {t('dialog.cancel')}
          </Button>
          <Button variant="primary" disabled={!canSubmit} onClick={submit}>
            <Store className="h-3.5 w-3.5" aria-hidden />
            {t('actions.change-store')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-2">
        <p className="text-[0.8125rem] text-muted-foreground">
          {pickInStore ? t('changeStore.hintPick') : t('changeStore.hintDelivery')}
        </p>

        {loading ? (
          <div className="flex h-96 items-center justify-center gap-2 rounded-lg border border-dashed border-border text-[0.8125rem] text-muted-foreground" role="status">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            {t('grid.loading')}
          </div>
        ) : error ? (
          <ErrorBanner center message={apiErrorMessage(error, t('changeStore.failed'))} className="h-96" />
        ) : (
          <div className="h-96 w-full">
            {pickInStore ? (
              <AgGridReact<StoreDetailModel>
                theme={omsGridTheme}
                rowData={stores.data ?? []}
                columnDefs={storeColumns}
                defaultColDef={DETAIL_DEFAULT_COL_DEF}
                rowSelection={PICKER_ROW_SELECTION}
                rowHeight={OMS_GRID_ROW_HEIGHT}
                headerHeight={OMS_GRID_HEADER_HEIGHT}
                animateRows={false}
                onSelectionChanged={onSelectionChanged}
              />
            ) : (
              <AgGridReact<SdDistrictModel>
                theme={omsGridTheme}
                rowData={districts.data ?? []}
                columnDefs={districtColumns}
                defaultColDef={DETAIL_DEFAULT_COL_DEF}
                rowSelection={PICKER_ROW_SELECTION}
                rowHeight={OMS_GRID_ROW_HEIGHT}
                headerHeight={OMS_GRID_HEADER_HEIGHT}
                animateRows={false}
                onSelectionChanged={onSelectionChanged}
              />
            )}
          </div>
        )}

        <p
          className={
            'm-0 flex items-center gap-1.5 text-[0.8125rem] ' +
            (unresolved ? 'font-semibold text-danger-800' : 'text-muted-foreground')
          }
        >
          {unresolved ? (
            <>
              <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
              {t('changeStore.unresolved')}
            </>
          ) : derived ? (
            <>
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
              {t('changeStore.newStore')} <strong>{derived}</strong>
            </>
          ) : (
            t('changeStore.selectRow')
          )}
        </p>
      </div>
    </Modal>
  )
}
