import { useId, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import { apiErrorCode, apiErrorMessage } from '@/core/api'
import { hungerStationChainsQuery } from '@/core/hungerstation/api'
import ReasonDialog, { InlineRefusal } from '@/core/hungerstation/ReasonDialog'
import { fieldRefusal, type FieldRefusal } from '@/core/hungerstation/reason'
import { HUNGERSTATION_ERRORS, type HungerStationStoreRow } from '@/core/models/hungerstation'
import { notify } from '@/core/services/notify'
import Ltr from '@/core/ui/Ltr'
import { fsi } from '@/core/util/bidi'
import { STORES_KEY, storesApi } from './api'
import { chainChoices } from './store-state'

const FIELD = 'flex flex-col gap-1 text-xs font-medium'
const INPUT =
  'h-8 rounded-md border border-border/60 bg-background px-2 text-sm font-normal text-foreground outline-none focus:border-primary/60 disabled:opacity-60'

const E = HUNGERSTATION_ERRORS

/** Onboard's refusals shown at the store field; the vendor id's; the chain's (contract § Stores). */
const STORE_CODES = [E.noSuchStore, E.storeClosed, E.alreadyOnboarded] as const
const VENDOR_CODES = [E.vendorIdTaken] as const
const CHAIN_CODES = [E.noSuchChain] as const

/**
 * The chain a write names. With the `Chains` read it is a list. Without it (any failure) it falls
 * back to a typed key with the chains seen on the store rows as suggestions; a wrong key is
 * DHS-00006, inline here.
 */
function ChainField({
  value,
  onChange,
  rowKeys,
  disabled,
  refusal,
}: {
  value: string
  onChange: (v: string) => void
  rowKeys: readonly string[]
  disabled: boolean
  refusal: FieldRefusal | null
}) {
  const { t } = useTranslation('hungerstation-stores')
  const chains = useQuery(hungerStationChainsQuery())
  const listId = useId()
  // The store's current chain stays choosable even if the list no longer names it.
  const choices = chainChoices(chains.isSuccess ? chains.data : undefined, rowKeys, [value])

  return (
    <div className="flex flex-col gap-1">
      <label className={FIELD}>
        {t('filters.chain')}
        {chains.isError ? (
          <>
            <input
              type="text"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              disabled={disabled}
              dir="ltr"
              list={listId}
              placeholder={t('chain.typePlaceholder')}
              className={INPUT + ' font-mono'}
              data-chain-input=""
            />
            <datalist id={listId}>
              {choices.map((k) => (
                <option key={k} value={k} />
              ))}
            </datalist>
          </>
        ) : (
          <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled || chains.isPending}
            className={INPUT}
            data-chain-select=""
          >
            <option value="">{chains.isPending ? t('chain.loading') : t('chain.choose')}</option>
            {choices.map((k) => (
              <option key={k} value={k}>
                {fsi(k)}
              </option>
            ))}
          </select>
        )}
      </label>
      {chains.isError && (
        <span className="text-xs text-muted-foreground" data-chain-fallback="">
          {t('chain.fallbackHint')}
        </span>
      )}
      {refusal && <InlineRefusal message={refusal.message} code={refusal.code} />}
    </div>
  )
}

/** A typed machine value (a store code, a vendor id) with its refusal underneath. */
function CodeField({
  label,
  value,
  onChange,
  disabled,
  placeholder,
  refusal,
  autoFocus,
  data,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  disabled: boolean
  placeholder: string
  refusal: FieldRefusal | null
  autoFocus?: boolean
  data: string
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className={FIELD}>
        {label}
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          dir="ltr"
          autoFocus={autoFocus}
          placeholder={placeholder}
          className={INPUT + ' font-mono'}
          {...{ [data]: '' }}
        />
      </label>
      {refusal && <InlineRefusal message={refusal.message} code={refusal.code} />}
    </div>
  )
}

/**
 * Onboard a HungerStation store on a chain and vendor id, with a reason. DHS-00002/00003/00004
 * show at the store, DHS-00005 at the vendor id, DHS-00006 at the chain, DHS-00008 at the reason.
 * Onboarding a removed store revives it — the server does it, and the note says so.
 */
export function OnboardDialog({
  rowKeys,
  onClose,
  onDone,
}: {
  rowKeys: readonly string[]
  onClose: () => void
  onDone: () => void
}) {
  const { t } = useTranslation('hungerstation-stores')
  const qc = useQueryClient()
  const [storeCode, setStoreCode] = useState('')
  const [chainKey, setChainKey] = useState('')
  const [vendorId, setVendorId] = useState('')
  const body = { storeCode: storeCode.trim(), chainKey: chainKey.trim(), vendorId: vendorId.trim() }
  const send = useMutation({
    mutationFn: (reason: string) => storesApi.onboard({ ...body, reason }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: STORES_KEY })
      notify.success(
        t('onboard.done'),
        t('onboard.doneDetail', { store: fsi(body.storeCode), chain: fsi(body.chainKey), vendorId: fsi(body.vendorId) }),
      )
      onDone()
    },
  })
  const fallback = t('dialog.failedHint')
  const edited = <T,>(set: (v: T) => void) => (v: T) => {
    set(v)
    send.reset()
  }

  return (
    <ReasonDialog
      open
      title={t('onboard.title')}
      note={t('onboard.note')}
      busy={send.isPending}
      error={send.error}
      confirmLabel={t('onboard.confirm')}
      confirmDisabled={body.storeCode === '' || body.chainKey === '' || body.vendorId === ''}
      handledCodes={[...STORE_CODES, ...VENDOR_CODES, ...CHAIN_CODES]}
      onEdit={() => send.reset()}
      onConfirm={(reason) => send.mutate(reason)}
      onClose={onClose}
    >
      <div className="flex flex-col gap-3" data-onboard-dialog="">
        <CodeField
          label={t('onboard.store')}
          value={storeCode}
          onChange={edited(setStoreCode)}
          disabled={send.isPending}
          placeholder={t('onboard.storePlaceholder')}
          refusal={fieldRefusal(send.error, STORE_CODES, fallback)}
          autoFocus
          data="data-onboard-store"
        />
        <ChainField
          value={chainKey}
          onChange={edited(setChainKey)}
          rowKeys={rowKeys}
          disabled={send.isPending}
          refusal={fieldRefusal(send.error, CHAIN_CODES, fallback)}
        />
        <CodeField
          label={t('onboard.vendorId')}
          value={vendorId}
          onChange={edited(setVendorId)}
          disabled={send.isPending}
          placeholder={t('onboard.vendorIdPlaceholder')}
          refusal={fieldRefusal(send.error, VENDOR_CODES, fallback)}
          data="data-onboard-vendor"
        />
      </div>
    </ReasonDialog>
  )
}

/**
 * Edit a store's vendor id or chain, with a reason. DHS-00005 shows at the vendor id, DHS-00006 at
 * the chain. DHS-00007 — the store was removed meanwhile — says so and refreshes the list.
 */
export function EditDialog({
  row,
  rowKeys,
  onClose,
  onDone,
}: {
  row: HungerStationStoreRow
  rowKeys: readonly string[]
  onClose: () => void
  onDone: () => void
}) {
  const { t } = useTranslation('hungerstation-stores')
  const qc = useQueryClient()
  const [chainKey, setChainKey] = useState(row.chainKey)
  const [vendorId, setVendorId] = useState(row.vendorId)
  const body = { chainKey: chainKey.trim(), vendorId: vendorId.trim() }
  const unchanged = body.chainKey === row.chainKey && body.vendorId === row.vendorId
  const send = useMutation({
    mutationFn: (reason: string) => storesApi.edit(row.storeCode, { ...body, reason }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: STORES_KEY })
      notify.success(
        t('edit.done'),
        t('edit.doneDetail', { store: fsi(row.storeCode), chain: fsi(body.chainKey), vendorId: fsi(body.vendorId) }),
      )
      onDone()
    },
    // The store is gone (removed meanwhile): the list no longer holds it, so read it again.
    onError: (err) => {
      if (apiErrorCode(err) === E.notOnboarded) void qc.invalidateQueries({ queryKey: STORES_KEY })
    },
  })
  const fallback = t('dialog.failedHint')
  const gone = apiErrorCode(send.error) === E.notOnboarded
  const edited = (set: (v: string) => void) => (v: string) => {
    set(v)
    send.reset()
  }

  return (
    <ReasonDialog
      open
      title={t('edit.title')}
      note={<Trans t={t} i18nKey="edit.note" values={{ store: row.storeCode }} components={{ store: <Ltr /> }} />}
      busy={send.isPending}
      error={send.error}
      confirmLabel={t('edit.confirm')}
      confirmDisabled={unchanged || gone || body.chainKey === '' || body.vendorId === ''}
      handledCodes={[...VENDOR_CODES, ...CHAIN_CODES, E.notOnboarded]}
      onEdit={() => send.reset()}
      onConfirm={(reason) => send.mutate(reason)}
      onClose={onClose}
    >
      <div className="flex flex-col gap-3" data-edit-dialog="">
        <ChainField
          value={chainKey}
          onChange={edited(setChainKey)}
          rowKeys={rowKeys}
          disabled={send.isPending || gone}
          refusal={fieldRefusal(send.error, CHAIN_CODES, fallback)}
        />
        <CodeField
          label={t('onboard.vendorId')}
          value={vendorId}
          onChange={edited(setVendorId)}
          disabled={send.isPending || gone}
          placeholder={t('onboard.vendorIdPlaceholder')}
          refusal={fieldRefusal(send.error, VENDOR_CODES, fallback)}
          autoFocus
          data="data-edit-vendor"
        />
        {unchanged && !send.error && (
          <span className="text-xs text-muted-foreground" data-edit-unchanged="">
            {t('edit.unchanged')}
          </span>
        )}
        {gone && (
          <div role="alert" className="flex flex-col gap-1 rounded-md border border-danger-border bg-danger-050 px-3 py-2 text-xs text-danger-800" data-edit-gone="">
            <p className="font-semibold">{t('edit.gone')}</p>
            <p>{t('edit.goneHint')}</p>
            <InlineRefusal message={apiErrorMessage(send.error, fallback)} code={E.notOnboarded} />
          </div>
        )}
      </div>
    </ReasonDialog>
  )
}
