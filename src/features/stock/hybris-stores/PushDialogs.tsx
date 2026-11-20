import { useId, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { TFunction } from 'i18next'
import { HYBRIS_STOCK_PUSHES_KEY as PUSHES_KEY } from '@/core/hybris-stock/api'
import { Trans, useTranslation } from 'react-i18next'
import { apiErrorCode, apiErrorMessage } from '@/core/api'
import ReasonDialog, { InlineRefusal } from '@/core/hybris-stock/ReasonDialog'
import { PUSH_LIMITS, type HybrisStockPushNowResult, type HybrisStockStoreRow } from '@/core/models/hybris-stock'
import { notify } from '@/core/services/notify'
import Field from '@/core/ui/Field'
import Ltr from '@/core/ui/Ltr'
import MultiSelect from '@/core/ui/MultiSelect'
import Textarea from '@/core/ui/Textarea'
import { formatPair, fsi } from '@/core/util/bidi'
import { listText } from '@/core/util/list-format'
import { formatFigure as figure } from '@/core/util/number-format'
import { PUSH_MATERIALS_KEY, STORES_KEY, pushStoreKey, storesApi } from './api'
import { PUSH_NOW_CODES, isErrorState, materialsPushBlock, parseMaterials, pushNowRefusal, pushResult, refreshesList } from './push-now'
import { storesToParams } from './stores-query'

/** The toast a push now's answer reads: its title from the push's OWN status (a 200 can carry a failed or
 *  running push), so it never says delivered when the result box says failed. */
function toastPush(t: TFunction, push: HybrisStockPushNowResult, detail: string) {
  const { ok, status } = pushResult(push)
  if (ok) notify.success(t(`pushNow.toast.${status}`), detail)
  else notify.error(t(`pushNow.toast.${status}`), detail)
}

/**
 * Push-now's own refusal, in words beside the server's sentence (ticket 850). 409 busy is drawn
 * neutral — it is a wait, not a failure: nothing was pushed or recorded.
 */
function PushRefusal({ error }: { error: unknown }) {
  const { t } = useTranslation('hybris-stock-stores')
  const code = apiErrorCode(error)
  const kind = pushNowRefusal(code)
  if (!kind) return null
  const tone = isErrorState(kind) ? 'border-danger-border bg-danger-050 text-danger-800' : 'border-border bg-muted text-foreground'
  return (
    <div role={isErrorState(kind) ? 'alert' : 'status'} className={`flex flex-col gap-1 rounded-md border px-3 py-2 text-xs ${tone}`} data-push-refusal={kind}>
      <p className="font-semibold">{t(`pushNow.refusal.${kind}`)}</p>
      <p className={isErrorState(kind) ? '' : 'text-muted-foreground'}>{t(`pushNow.refusal.${kind}Hint`)}</p>
      {isErrorState(kind) && <InlineRefusal message={apiErrorMessage(error, t('dialog.failedHint'))} code={code} />}
    </div>
  )
}

/**
 * **Push store now** (spec 3447 stories 34–35, 37–38; ticket 850): a FULL of every enabled material
 * for the store, now, with a reason — the note says so, and that it counts as the store's full. The
 * mutation is keyed by `pushStoreKey`, so the row's action shows the push running and cannot start a
 * second one; the dialog's own latch ignores a double Confirm. The answer is the push row, handed to the
 * page (`onDone`), which shows rows and status — a failed upload is a 200 with status `E`, shown as
 * failed with its error, not a refusal. The list is read again (the store's health moved).
 */
export function PushStoreDialog({ row, onClose, onDone }: { row: HybrisStockStoreRow; onClose: () => void; onDone: (push: HybrisStockPushNowResult) => void }) {
  const { t } = useTranslation('hybris-stock-stores')
  const qc = useQueryClient()
  const send = useMutation({
    mutationKey: pushStoreKey(row.storeCode),
    mutationFn: (reason: string) => storesApi.pushStore(row.storeCode, { reason }),
    onSuccess: (push) => {
      void qc.invalidateQueries({ queryKey: STORES_KEY })
      void qc.invalidateQueries({ queryKey: PUSHES_KEY })
      toastPush(t, push, t('pushNow.doneDetail', { store: fsi(row.storeCode), rows: fsi(figure(push.rowsSent)) }))
      onDone(push)
    },
    onError: (err) => {
      if (refreshesList(pushNowRefusal(apiErrorCode(err)))) {
        void qc.invalidateQueries({ queryKey: STORES_KEY })
        void qc.invalidateQueries({ queryKey: PUSHES_KEY })
      }
    },
  })
  const kind = pushNowRefusal(apiErrorCode(send.error))

  return (
    <ReasonDialog
      open
      title={t('pushNow.title')}
      note={
        <Trans
          t={t}
          i18nKey="pushNow.note"
          values={{ store: row.storeName ? formatPair(row.storeCode, row.storeName) : row.storeCode }}
          components={{ store: <Ltr /> }}
        />
      }
      busy={send.isPending}
      error={send.error}
      confirmLabel={t('pushNow.confirm')}
      confirmDisabled={kind === 'notMarked' || kind === 'railOff'}
      handledCodes={PUSH_NOW_CODES}
      onEdit={() => send.reset()}
      onConfirm={(reason) => send.mutate(reason)}
      onClose={onClose}
    >
      <div data-push-store-dialog={row.storeCode}>
        <PushRefusal error={send.error} />
      </div>
    </ReasonDialog>
  )
}

/**
 * **Push materials now** (spec 3447 story 36; ticket 850): current ATP for chosen materials across
 * chosen Hybris stock stores, with a reason. It moves no store's delta anchor. Stores are picked from
 * the marked stores; materials are pasted (numbers split on space, comma or line). Confirm waits for at
 * least one of each, no malformed number, and the door's limits (200 stores, 1,000 materials, HYS-00033).
 */
export function PushMaterialsDialog({
  onClose,
  onDone,
}: {
  onClose: () => void
  onDone: (push: HybrisStockPushNowResult) => void
}) {
  const { t, i18n } = useTranslation('hybris-stock-stores')
  const qc = useQueryClient()
  const textId = useId()
  const [picked, setPicked] = useState<string[]>([])
  const [text, setText] = useState('')
  const parsed = parseMaterials(text)
  // EVERY marked store, whatever the page's filters show: its own read of the list, on the key the
  // page's "Marked stores" filter uses, so the two share one cache entry.
  const markedQuery = { flag: 'marked', health: 'any', q: null } as const
  const marked = useQuery({
    queryKey: [...STORES_KEY, storesToParams(markedQuery).toString()],
    queryFn: () => storesApi.list(markedQuery),
    retry: false,
  })
  const stores: HybrisStockStoreRow[] = (marked.data ?? []).filter((s) => s.marked)
  // A store unmarked meanwhile drops out of the list on its re-read: drop it from the picks too, so a
  // store the user can no longer see or remove is never sent again.
  const chosen = marked.isSuccess ? picked.filter((code) => stores.some((s) => s.storeCode === code)) : picked
  const send = useMutation({
    mutationKey: PUSH_MATERIALS_KEY,
    mutationFn: (reason: string) => storesApi.pushMaterials({ storeCodes: chosen, materialNumbers: parsed.numbers, reason }),
    onSuccess: (push) => {
      void qc.invalidateQueries({ queryKey: PUSHES_KEY })
      // A failed upload (status E) records its error on the stores' health, like any push.
      if (push.status === 'E') void qc.invalidateQueries({ queryKey: STORES_KEY })
      toastPush(t, push, t('pushMaterials.doneDetail', { rows: fsi(figure(push.rowsSent)) }))
      onDone(push)
    },
    onError: (err) => {
      if (refreshesList(pushNowRefusal(apiErrorCode(err)))) void qc.invalidateQueries({ queryKey: STORES_KEY })
    },
  })
  const block = materialsPushBlock(chosen.length, parsed)
  const ready = block === null
  const options = stores.map((s) => ({ value: s.storeCode, text: s.storeName ? formatPair(s.storeCode, s.storeName) : s.storeCode, machine: true }))

  return (
    <ReasonDialog
      open
      title={t('pushMaterials.title')}
      note={t('pushMaterials.note')}
      busy={send.isPending}
      error={send.error}
      confirmLabel={t('pushMaterials.confirm')}
      confirmDisabled={!ready}
      handledCodes={PUSH_NOW_CODES}
      onEdit={() => send.reset()}
      onConfirm={(reason) => send.mutate(reason)}
      onClose={onClose}
    >
      <div className="flex flex-col gap-3" data-push-materials-dialog="">
        <Field label={t('pushMaterials.stores')}>
          <MultiSelect
            value={chosen}
            onChange={(next) => {
              setPicked(next)
              send.reset()
            }}
            options={options}
            label={t('pushMaterials.stores')}
            disabled={send.isPending}
            loading={marked.isPending}
            failed={marked.isError}
            data-testid="push-materials-stores"
          />
        </Field>
        <Field
          label={t('pushMaterials.materials')}
          id={textId}
          hint={
            <Trans t={t} i18nKey="pushMaterials.counted" count={parsed.numbers.length} values={{ n: figure(parsed.numbers.length) }} components={{ n: <Ltr /> }} />
          }
          error={
            block === 'invalid'
              ? t('pushMaterials.invalid', { values: fsi(listText(parsed.invalid.slice(0, 5), i18n.language)) })
              : block === 'tooManyMaterials'
                ? t('pushMaterials.tooManyMaterials', { max: fsi(figure(PUSH_LIMITS.materials)) })
                : block === 'tooManyStores'
                  ? t('pushMaterials.tooManyStores', { max: fsi(figure(PUSH_LIMITS.stores)) })
                  : undefined
          }
        >
          <Textarea
            id={textId}
            rows={3}
            dir="ltr"
            value={text}
            onChange={(e) => {
              setText(e.target.value)
              send.reset()
            }}
            disabled={send.isPending}
            placeholder={t('pushMaterials.placeholder')}
            data-push-materials-text=""
          />
        </Field>
        <PushRefusal error={send.error} />
      </div>
    </ReasonDialog>
  )
}
