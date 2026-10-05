import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { AgGridReact } from 'ag-grid-react'
import type { ColDef } from 'ag-grid-community'
import { Plus } from 'lucide-react'
// Side-effect import: registers the AG Grid Community modules in this lazy chunk.
import '@/core/ag-grid-setup'
import { apiErrorMessage } from '@/core/api'
import type { BbyPromotionListItem, BbyRefusal } from '@/core/models/bonus-buy-maintenance'
import { OMS_GRID_BASE_COL_DEF } from '@/core/theme/grid-base'
import { OMS_GRID_HEADER_HEIGHT, OMS_GRID_ROW_HEIGHT, omsGridTheme } from '@/core/theme/ag-grid-theme'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Modal from '@/core/ui/Modal'
import ScreenGate from '@/core/ui/ScreenGate'
import { formatDay } from '@/core/util/date-format'
import { formatRange } from '@/core/util/bidi'
import { bbyMaintainAccessQuery, bbyMaintainApi, canOpenBbyMaintain, promotionListKey } from './api'
import { RefusalList } from './ActReport'
import { DateInput, TextInput } from './fields'
import { PROMOTION_NAME_MAX, promotionPath } from './overview'

/**
 * The promotion list — the screen's entry (ticket 416). Marketing creates a promotion
 * first, as in SAP's `WAK1`, and works from its Bonus Buy Overview.
 */
export default function BonusBuyMaintenancePage() {
  const { t } = useTranslation('bonus-buy-maintenance')
  return (
    <ScreenGate
      query={bbyMaintainAccessQuery()}
      can={canOpenBbyMaintain}
      ns="bonus-buy-maintenance"
      title={t('title')}
      subtitle={t('subtitle')}
    >
      <PromotionList />
    </ScreenGate>
  )
}

function PromotionList() {
  const { t } = useTranslation('bonus-buy-maintenance')
  const navigate = useNavigate()
  const [creating, setCreating] = useState(false)
  const list = useQuery({ queryKey: promotionListKey, queryFn: () => bbyMaintainApi.promotions() })

  const columns = useMemo<ColDef<BbyPromotionListItem>[]>(
    () => [
      { field: 'promoNumber', headerName: t('list.col.promoNumber'), width: 140 },
      { field: 'name', headerName: t('list.col.name'), flex: 1, minWidth: 220 },
      {
        colId: 'window',
        headerName: t('list.col.window'),
        width: 240,
        valueGetter: (p) =>
          p.data ? formatRange(formatDay(p.data.salesFrom), formatDay(p.data.salesTo)) : '',
      },
      { field: 'bonusBuyCount', headerName: t('list.col.count'), width: 130, type: 'rightAligned' },
    ],
    [t],
  )
  const defaultColDef = useMemo<ColDef<BbyPromotionListItem>>(
    () => ({ ...OMS_GRID_BASE_COL_DEF, sortable: true, resizable: true }),
    [],
  )

  return (
    <>
      <div className="flex items-center gap-2">
        <Button variant="primary" onClick={() => setCreating(true)}>
          <Plus className="h-3.5 w-3.5" aria-hidden />
          {t('list.create')}
        </Button>
      </div>

      {list.isError ? (
        <ErrorBanner message={apiErrorMessage(list.error, t('list.loadFailed'))} className="px-3 py-2" />
      ) : list.data && list.data.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('list.empty')}</p>
      ) : (
        <div className="h-[28rem]">
          <AgGridReact<BbyPromotionListItem>
            theme={omsGridTheme}
            rowData={list.data ?? null}
            columnDefs={columns}
            defaultColDef={defaultColDef}
            rowHeight={OMS_GRID_ROW_HEIGHT}
            headerHeight={OMS_GRID_HEADER_HEIGHT}
            animateRows={false}
            getRowId={(p) => p.data.promoNumber}
            onRowClicked={(e) => e.data && navigate(promotionPath(e.data.promoNumber))}
            rowClass="cursor-pointer"
          />
        </div>
      )}

      <CreatePromotionDialog
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={(number) => navigate(promotionPath(number))}
      />
    </>
  )
}

function CreatePromotionDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean
  onClose: () => void
  onCreated: (promoNumber: string) => void
}) {
  const { t } = useTranslation('bonus-buy-maintenance')
  const [name, setName] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [refusals, setRefusals] = useState<BbyRefusal[]>([])

  const save = useMutation({
    mutationFn: () =>
      bbyMaintainApi.savePromotion({ promoNumber: null, name: name.trim(), salesFrom: from, salesTo: to }),
    onSuccess: (outcome) => {
      if (outcome.status === 'saved' && outcome.number) {
        onCreated(outcome.number)
        return
      }
      setRefusals(outcome.refusals ?? [])
    },
  })

  const canSave = name.trim() !== '' && from !== '' && to !== '' && !save.isPending

  function close() {
    // Not while a create is in flight: its answer would still navigate after a Cancel.
    if (save.isPending) return
    setName('')
    setFrom('')
    setTo('')
    setRefusals([])
    save.reset()
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title={t('create.title')}
      width="28rem"
      footer={
        <>
          <Button variant="text" disabled={save.isPending} onClick={close}>
            {t('create.cancel')}
          </Button>
          <Button variant="primary" disabled={!canSave} onClick={() => save.mutate()}>
            {t('create.save')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <p className="text-xs text-muted-foreground">{t('create.hint')}</p>
        <TextInput label={t('promotion.name')} value={name} maxLength={PROMOTION_NAME_MAX} onChange={setName} />
        <div className="flex flex-wrap gap-3">
          <DateInput label={t('promotion.onSaleFrom')} value={from} onChange={setFrom} />
          <DateInput label={t('promotion.to')} value={to} onChange={setTo} />
        </div>
        {save.isError && (
          <ErrorBanner message={apiErrorMessage(save.error, t('create.failed'))} className="px-3 py-2" />
        )}
        {refusals.length > 0 && (
          <div className="rounded-lg border border-danger-border bg-danger-050 px-3 py-2 text-danger-800">
            <div className="text-sm font-medium">{t('create.failed')}</div>
            <RefusalList refusals={refusals} />
          </div>
        )}
      </div>
    </Modal>
  )
}
