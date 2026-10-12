import { useId, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import { deliverectAccountsQuery } from '@/core/deliverect/api'
import ReasonDialog, { InlineRefusal } from '@/core/deliverect/ReasonDialog'
import { fieldRefusal, type FieldRefusal } from '@/core/deliverect/reason'
import { DELIVERECT_ERRORS, type DeliverectStoreRow } from '@/core/models/deliverect'
import { notify } from '@/core/services/notify'
import Ltr from '@/core/ui/Ltr'
import { fsi } from '@/core/util/bidi'
import { STORES_KEY, storesApi } from './api'
import { accountChoices } from './store-state'

const FIELD = 'flex flex-col gap-1 text-xs font-medium'
const INPUT =
  'h-8 rounded-md border border-border/60 bg-background px-2 text-sm font-normal text-foreground outline-none focus:border-primary/60 disabled:opacity-60'

/**
 * The account a write names. With the `Accounts` read it is a list (an inactive account shown but
 * not choosable — the server refuses it with DLV-00003). Without it — a 403, since the contract
 * puts that door behind `canManageTerms` (HITL-477 contract gap), or any failure — it falls back to
 * a typed key with the accounts seen on the store rows as suggestions; a wrong key is DLV-00003.
 */
function AccountField({
  label,
  value,
  onChange,
  rowKeys,
  exclude,
  disabled,
  refusal,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  rowKeys: readonly string[]
  /** The account the store is on already (a move must name another). */
  exclude?: string
  disabled: boolean
  refusal: FieldRefusal | null
}) {
  const { t } = useTranslation('deliverect-stores')
  const accounts = useQuery(deliverectAccountsQuery())
  const listId = useId()
  const suggestions = accountChoices(undefined, rowKeys).filter((k) => k !== exclude)

  return (
    <div className="flex flex-col gap-1">
      <label className={FIELD}>
        {label}
        {accounts.isError ? (
          <>
            <input
              type="text"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              disabled={disabled}
              dir="ltr"
              list={listId}
              placeholder={t('account.typePlaceholder')}
              className={INPUT + ' font-mono'}
              data-account-input=""
            />
            <datalist id={listId}>
              {suggestions.map((k) => (
                <option key={k} value={k} />
              ))}
            </datalist>
          </>
        ) : (
          <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled || accounts.isPending}
            className={INPUT}
            data-account-select=""
          >
            <option value="">{accounts.isPending ? t('account.loading') : t('account.choose')}</option>
            {(accounts.data ?? [])
              .filter((a) => a.accountKey !== exclude)
              .map((a) => (
                <option key={a.accountKey} value={a.accountKey} disabled={!a.active}>
                  {a.active ? fsi(a.accountKey) : t('account.inactive', { key: fsi(a.accountKey) })}
                </option>
              ))}
          </select>
        )}
      </label>
      {accounts.isError && (
        <span className="text-xs text-muted-foreground" data-account-fallback="">
          {t('account.fallbackHint')}
        </span>
      )}
      {refusal && <InlineRefusal message={refusal.message} code={refusal.code} />}
    </div>
  )
}

/**
 * Onboard a store on a Deliverect account, with a reason. DLV-00001/00002 show at the store,
 * DLV-00003 at the account. A store on the direct HungerStation rail onboards all the same and
 * `onDone` hands the page the envelope's warning.
 */
export function OnboardDialog({
  rowKeys,
  onClose,
  onDone,
}: {
  rowKeys: readonly string[]
  onClose: () => void
  onDone: (row: DeliverectStoreRow | null, message: string) => void
}) {
  const { t } = useTranslation('deliverect-stores')
  const qc = useQueryClient()
  const [storeCode, setStoreCode] = useState('')
  const [accountKey, setAccountKey] = useState('')
  const send = useMutation({
    mutationFn: (reason: string) => storesApi.onboard({ storeCode: storeCode.trim(), accountKey: accountKey.trim(), reason }),
    onSuccess: ({ row, message }) => {
      void qc.invalidateQueries({ queryKey: STORES_KEY })
      notify.success(t('onboard.done'), t('onboard.doneDetail', { store: fsi(storeCode.trim()), account: fsi(accountKey.trim()) }))
      onDone(row, message)
    },
  })
  const fallback = t('dialog.failedHint')
  const storeRefusal = fieldRefusal(send.error, [DELIVERECT_ERRORS.noSuchStore, DELIVERECT_ERRORS.alreadyOnboarded], fallback)
  const accountRefusal = fieldRefusal(send.error, [DELIVERECT_ERRORS.noSuchAccount], fallback)

  return (
    <ReasonDialog
      open
      title={t('onboard.title')}
      note={t('onboard.note')}
      busy={send.isPending}
      error={send.error}
      confirmLabel={t('onboard.confirm')}
      confirmDisabled={storeCode.trim() === '' || accountKey.trim() === ''}
      handledCodes={[DELIVERECT_ERRORS.noSuchStore, DELIVERECT_ERRORS.alreadyOnboarded, DELIVERECT_ERRORS.noSuchAccount]}
      onEdit={() => send.reset()}
      onConfirm={(reason) => send.mutate(reason)}
      onClose={onClose}
    >
      <div className="flex flex-col gap-1" data-onboard-dialog="">
        <label className={FIELD}>
          {t('onboard.store')}
          <input
            type="text"
            value={storeCode}
            onChange={(e) => {
              setStoreCode(e.target.value)
              send.reset()
            }}
            disabled={send.isPending}
            dir="ltr"
            autoFocus
            placeholder={t('onboard.storePlaceholder')}
            className={INPUT + ' font-mono'}
            data-onboard-store=""
          />
        </label>
        {storeRefusal && <InlineRefusal {...storeRefusal} />}
      </div>
      <AccountField
        label={t('filters.account')}
        value={accountKey}
        onChange={(v) => {
          setAccountKey(v)
          send.reset()
        }}
        rowKeys={rowKeys}
        disabled={send.isPending}
        refusal={accountRefusal}
      />
    </ReasonDialog>
  )
}

/** Move a store to another Deliverect account, with a reason; the dialog says the link is cleared. */
export function MoveDialog({
  row,
  rowKeys,
  onClose,
  onDone,
}: {
  row: DeliverectStoreRow
  rowKeys: readonly string[]
  onClose: () => void
  onDone: () => void
}) {
  const { t } = useTranslation('deliverect-stores')
  const qc = useQueryClient()
  const [accountKey, setAccountKey] = useState('')
  const target = accountKey.trim()
  const send = useMutation({
    mutationFn: (reason: string) => storesApi.move(row.storeCode, { accountKey: target, reason }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: STORES_KEY })
      notify.success(t('move.done'), t('move.doneDetail', { store: fsi(row.storeCode), account: fsi(target) }))
      onDone()
    },
  })
  const accountRefusal = fieldRefusal(send.error, [DELIVERECT_ERRORS.noSuchAccount], t('dialog.failedHint'))

  return (
    <ReasonDialog
      open
      title={t('move.title')}
      note={
        <Trans
          t={t}
          i18nKey="move.note"
          values={{ store: row.storeCode, from: row.accountKey }}
          components={{ store: <Ltr />, from: <Ltr /> }}
        />
      }
      busy={send.isPending}
      error={send.error}
      confirmLabel={t('move.confirm')}
      confirmDisabled={target === '' || target === row.accountKey}
      handledCodes={[DELIVERECT_ERRORS.noSuchAccount]}
      onEdit={() => send.reset()}
      onConfirm={(reason) => send.mutate(reason)}
      onClose={onClose}
    >
      <AccountField
        label={t('move.to')}
        value={accountKey}
        onChange={(v) => {
          setAccountKey(v)
          send.reset()
        }}
        rowKeys={rowKeys}
        exclude={row.accountKey}
        disabled={send.isPending}
        refusal={accountRefusal}
      />
    </ReasonDialog>
  )
}

/** Remove a store's onboarding, with a reason; the dialog says the sync stops and the link is cleared. */
export function RemoveDialog({ row, onClose, onDone }: { row: DeliverectStoreRow; onClose: () => void; onDone: () => void }) {
  const { t } = useTranslation('deliverect-stores')
  const qc = useQueryClient()
  const send = useMutation({
    mutationFn: (reason: string) => storesApi.remove(row.storeCode, reason),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: STORES_KEY })
      notify.success(t('remove.done'), t('remove.doneDetail', { store: fsi(row.storeCode) }))
      onDone()
    },
  })

  return (
    <ReasonDialog
      open
      title={t('remove.title')}
      note={<Trans t={t} i18nKey="remove.note" values={{ store: row.storeCode }} components={{ store: <Ltr /> }} />}
      busy={send.isPending}
      error={send.error}
      confirmLabel={t('remove.confirm')}
      danger
      onEdit={() => send.reset()}
      onConfirm={(reason) => send.mutate(reason)}
      onClose={onClose}
    />
  )
}
