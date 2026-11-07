import { useId, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import { apiErrorCode, apiErrorMessage } from '@/core/api'
import ReasonDialog, { InlineRefusal } from '@/core/hybris-stock/ReasonDialog'
import type { HybrisStockPushRow, HybrisStockStoreRow } from '@/core/models/hybris-stock'
import { notify } from '@/core/services/notify'
import Field from '@/core/ui/Field'
import Ltr from '@/core/ui/Ltr'
import MultiSelect from '@/core/ui/MultiSelect'
import Textarea from '@/core/ui/Textarea'
import { formatPair, fsi } from '@/core/util/bidi'
import { formatFigure as figure } from '@/core/util/number-format'
import { PUSH_MATERIALS_KEY, STORES_KEY, pushStoreKey, storesApi } from './api'
import { PUSH_NOW_CODES, isErrorState, parseMaterials, pushNowRefusal, refreshesList } from './push-now'

const PUSHES_KEY = ['hybris-stock', 'pushes'] as const

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
 * page (`onDone`), which shows rows and status. The list is read again (the store's health moved).
 */
export function PushStoreDialog({ row, onClose, onDone }: { row: HybrisStockStoreRow; onClose: () => void; onDone: (push: HybrisStockPushRow) => void }) {
  const { t } = useTranslation('hybris-stock-stores')
  const qc = useQueryClient()
  const send = useMutation({
    mutationKey: pushStoreKey(row.storeCode),
    mutationFn: (reason: string) => storesApi.pushStore(row.storeCode, { reason }),
    onSuccess: (push) => {
      void qc.invalidateQueries({ queryKey: STORES_KEY })
      void qc.invalidateQueries({ queryKey: PUSHES_KEY })
      notify.success(t('pushNow.done'), t('pushNow.doneDetail', { store: fsi(row.storeCode) }))
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
 * least one of each and no malformed number.
 */
export function PushMaterialsDialog({
  stores,
  onClose,
  onDone,
}: {
  /** The marked stores on the list. */
  stores: HybrisStockStoreRow[]
  onClose: () => void
  onDone: (push: HybrisStockPushRow) => void
}) {
  const { t } = useTranslation('hybris-stock-stores')
  const qc = useQueryClient()
  const textId = useId()
  const [picked, setPicked] = useState<string[]>([])
  const [text, setText] = useState('')
  const parsed = parseMaterials(text)
  const send = useMutation({
    mutationKey: PUSH_MATERIALS_KEY,
    mutationFn: (reason: string) => storesApi.pushMaterials({ storeCodes: picked, materialNumbers: parsed.numbers, reason }),
    onSuccess: (push) => {
      void qc.invalidateQueries({ queryKey: PUSHES_KEY })
      notify.success(t('pushMaterials.done'), t('pushMaterials.doneDetail', { rows: fsi(figure(push.rows)) }))
      onDone(push)
    },
    onError: (err) => {
      if (refreshesList(pushNowRefusal(apiErrorCode(err)))) void qc.invalidateQueries({ queryKey: STORES_KEY })
    },
  })
  const ready = picked.length > 0 && parsed.numbers.length > 0 && parsed.invalid.length === 0
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
            value={picked}
            onChange={(next) => {
              setPicked(next)
              send.reset()
            }}
            options={options}
            label={t('pushMaterials.stores')}
            disabled={send.isPending}
            data-testid="push-materials-stores"
          />
        </Field>
        <Field
          label={t('pushMaterials.materials')}
          id={textId}
          hint={
            <Trans t={t} i18nKey="pushMaterials.counted" count={parsed.numbers.length} values={{ n: figure(parsed.numbers.length) }} components={{ n: <Ltr /> }} />
          }
          error={parsed.invalid.length > 0 ? t('pushMaterials.invalid', { values: fsi(parsed.invalid.slice(0, 5).join(', ')) }) : undefined}
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
