import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import { apiErrorCode } from '@/core/api'
import ReasonDialog from '@/core/hybris-stock/ReasonDialog'
import { HYBRIS_STOCK_ERRORS as E, type HybrisStockStoreRow } from '@/core/models/hybris-stock'
import { notify } from '@/core/services/notify'
import Ltr from '@/core/ui/Ltr'
import { formatPair, fsi } from '@/core/util/bidi'
import { replaceByKey } from '@/core/util/replace-by-key'
import { STORES_KEY, historyKey, storesApi } from './api'

/**
 * Mark a store as a Hybris stock store, or unmark one, with a mandatory reason (spec 3447 stories
 * 1–7; ticket 847). The note says what the write does: marking sends the store a FULL before any
 * delta; unmarking stops the pushes and sends Hybris nothing — taking the store off the website is
 * Hybris's own decision, and Hybris keeps the stock it was last sent.
 *
 * The door answers the row, which is patched into the list in place (no re-read). HYS-00004 / 00005 —
 * the store was marked or unmarked meanwhile, from another screen — and HYS-00002 / 00003 (gone from the
 * master, closed) re-read the list, and Confirm stays off until the dialog is closed. HYS-00001 shows
 * inline under the reason (the area binding).
 */
/** The refusals after which the row on screen is out of date: re-read, and do not let Confirm try again. */
const STALE: string[] = [E.noSuchStore, E.storeClosed, E.alreadyMarked, E.notMarked]

export function MarkDialog({ row, onClose }: { row: HybrisStockStoreRow; onClose: () => void }) {
  const { t } = useTranslation('hybris-stock-stores')
  const qc = useQueryClient()
  const verb = row.marked ? 'unmark' : 'mark'
  const send = useMutation({
    mutationFn: (reason: string) => (row.marked ? storesApi.unmark(row.storeCode, { reason }) : storesApi.mark(row.storeCode, { reason })),
    onSuccess: (next) => {
      qc.setQueriesData<HybrisStockStoreRow[]>({ queryKey: STORES_KEY }, (rows) => replaceByKey(rows, next, 'storeCode'))
      // A list under the marked filter may no longer hold the row: read those again (the unfiltered list
      // keeps its in-place patch and is not re-read).
      void qc.invalidateQueries({ queryKey: STORES_KEY, predicate: (q) => /flag=|health=/.test(String(q.queryKey[2] ?? '')) })
      void qc.invalidateQueries({ queryKey: historyKey(row.storeCode) })
      notify.success(t(`${verb}.done`), t(`${verb}.doneDetail`, { store: fsi(row.storeCode) }))
      onClose()
    },
    onError: (err) => {
      if (STALE.includes(apiErrorCode(err) ?? '')) void qc.invalidateQueries({ queryKey: STORES_KEY })
    },
  })
  const stale = STALE.includes(apiErrorCode(send.error) ?? '')

  return (
    <ReasonDialog
      open
      title={t(`${verb}.title`)}
      note={
        <Trans
          t={t}
          i18nKey={`${verb}.note`}
          values={{ store: row.storeName ? formatPair(row.storeCode, row.storeName) : row.storeCode }}
          components={{ store: <Ltr /> }}
        />
      }
      busy={send.isPending}
      error={send.error}
      confirmLabel={t(`${verb}.confirm`)}
      confirmDisabled={stale}
      onEdit={() => send.reset()}
      onConfirm={(reason) => send.mutate(reason)}
      onClose={onClose}
    >
      <div data-mark-dialog={verb} />
    </ReasonDialog>
  )
}
