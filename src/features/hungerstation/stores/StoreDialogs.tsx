import { useId, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import { apiErrorCode, apiErrorMessage } from '@/core/api'
import { hungerStationChainsQuery } from '@/core/hungerstation/api'
import ReasonDialog, { InlineRefusal } from '@/core/hungerstation/ReasonDialog'
import { fieldRefusal, type FieldRefusal } from '@/core/hungerstation/reason'
import { HUNGERSTATION_ERRORS, type HungerStationStoreRow, type HungerStationSyncLogRow } from '@/core/models/hungerstation'
import { notify } from '@/core/services/notify'
import Ltr from '@/core/ui/Ltr'
import { fsi } from '@/core/util/bidi'
import { keyChoices } from '@/core/util/filter-choices'
import { STORES_KEY, storesApi, syncNowKey } from './api'
import { REMOVE_CONSEQUENCES } from './remove'
import { SYNC_NOW_CODES, applyPush, replaceRow, syncNowRefusal } from './sync'
import Field from '@/core/ui/Field'
import Input from '@/core/ui/Input'
import Select from '@/core/ui/Select'

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
  const choices = keyChoices(chains.isSuccess ? chains.data : undefined, rowKeys, [value])

  return (
    <div className="flex flex-col gap-1">
      <Field
        label={t('filters.chain')}
        hint={chains.isError ? <span data-chain-fallback="">{t('chain.fallbackHint')}</span> : undefined}
      >
        {chains.isError ? (
          <>
            <Input
              type="text"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              disabled={disabled}
              dir="ltr"
              list={listId}
              placeholder={t('chain.typePlaceholder')}
              className="font-mono"
              data-chain-input=""
            />
            <datalist id={listId}>
              {choices.map((k) => (
                <option key={k} value={k} />
              ))}
            </datalist>
          </>
        ) : (
          <Select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled || chains.isPending}
            data-chain-select=""
          >
            <option value="">{chains.isPending ? t('chain.loading') : t('chain.choose')}</option>
            {choices.map((k) => (
              <option key={k} value={k}>
                {fsi(k)}
              </option>
            ))}
          </Select>
        )}
      </Field>
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
      <Field label={label}>
        <Input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          dir="ltr"
          autoFocus={autoFocus}
          placeholder={placeholder}
          className="font-mono"
          {...{ [data]: '' }}
        />
      </Field>
      {refusal && <InlineRefusal message={refusal.message} code={refusal.code} />}
    </div>
  )
}

/**
 * DHS-00007 — the store is no longer onboarded (removed meanwhile, or never onboarded): what happened,
 * what the screen did about it (the list was read again), and the server's own sentence with its code.
 * Edit, Remove and Pause / Resume all say it this way, each in its own words (`<prefix>.gone`, `.goneHint`).
 */
function GoneAlert({ prefix, error, data }: { prefix: string; error: unknown; data: string }) {
  const { t } = useTranslation('hungerstation-stores')
  return (
    <div role="alert" className="flex flex-col gap-1 rounded-md border border-danger-border bg-danger-050 px-3 py-2 text-xs text-danger-800" {...{ [data]: '' }}>
      <p className="font-semibold">{t(`${prefix}.gone`)}</p>
      <p>{t(`${prefix}.goneHint`)}</p>
      <InlineRefusal message={apiErrorMessage(error, t('dialog.failedHint'))} code={E.notOnboarded} />
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
        {gone && <GoneAlert prefix="edit" error={send.error} data="data-edit-gone" />}
      </div>
    </ReasonDialog>
  )
}

/**
 * Remove a store's onboarding, with a reason (ticket 552). The dialog says in words what that does
 * (`REMOVE_CONSEQUENCES`): the stock sync stops and its orders are no longer fetched, its vendor id
 * is free for another store, its logs / orders / history stay readable, and it is NOT taken off
 * HungerStation — that is done in HungerStation's portal. Onboarding the same code revives it.
 *
 * The door answers `data: null` and a removed store is never listed, so the row is dropped from
 * every cached list at once and the list is read again. DHS-00007 (already removed, or never
 * onboarded) says so inline, refreshes the list and turns Remove off.
 */
export function RemoveDialog({ row, onClose, onDone }: { row: HungerStationStoreRow; onClose: () => void; onDone: () => void }) {
  const { t } = useTranslation('hungerstation-stores')
  const qc = useQueryClient()
  const send = useMutation({
    mutationFn: (reason: string) => storesApi.remove(row.storeCode, reason),
    onSuccess: () => {
      qc.setQueriesData<HungerStationStoreRow[]>({ queryKey: STORES_KEY }, (rows) => rows?.filter((r) => r.storeCode !== row.storeCode))
      void qc.invalidateQueries({ queryKey: STORES_KEY })
      notify.success(t('remove.done'), t('remove.doneDetail', { store: fsi(row.storeCode) }))
      onDone()
    },
    onError: (err) => {
      if (apiErrorCode(err) === E.notOnboarded) void qc.invalidateQueries({ queryKey: STORES_KEY })
    },
  })
  const gone = apiErrorCode(send.error) === E.notOnboarded

  return (
    <ReasonDialog
      open
      title={t('remove.title')}
      note={<Trans t={t} i18nKey="remove.note" values={{ store: row.storeCode }} components={{ store: <Ltr /> }} />}
      busy={send.isPending}
      error={send.error}
      confirmLabel={t('remove.confirm')}
      danger
      confirmDisabled={gone}
      handledCodes={[E.notOnboarded]}
      onEdit={() => send.reset()}
      onConfirm={(reason) => send.mutate(reason)}
      onClose={onClose}
    >
      <div className="flex flex-col gap-2 text-xs" data-remove-dialog="">
        <ul className="flex list-disc flex-col gap-1 ps-5 text-foreground">
          {REMOVE_CONSEQUENCES.map((key) => (
            <li key={key} data-remove-consequence={key}>
              {t(`remove.consequences.${key}`)}
            </li>
          ))}
        </ul>
        <p className="text-muted-foreground" data-remove-revive="">
          {t('remove.revive')}
        </p>
        {gone && <GoneAlert prefix="remove" error={send.error} data="data-remove-gone" />}
      </div>
    </ReasonDialog>
  )
}

/**
 * Pause an active store's stock sync, or resume a paused one, with a reason (ticket 553). The door
 * answers the store row, which replaces the row where it stands in every cached list — no refetch.
 * DHS-00007 (removed meanwhile) says so inline, refreshes the list and turns Confirm off.
 */
export function SyncActiveDialog({ row, onClose, onDone }: { row: HungerStationStoreRow; onClose: () => void; onDone: () => void }) {
  const { t } = useTranslation('hungerstation-stores')
  const qc = useQueryClient()
  // The state the write asks for, and the word for it — the key prefix of the dialog's copy.
  const nextActive = !row.sync.active
  const verb = nextActive ? 'resume' : 'pause'
  const send = useMutation({
    mutationFn: (reason: string) => storesApi.setActive(row.storeCode, { active: nextActive, reason }),
    onSuccess: (next) => {
      qc.setQueriesData<HungerStationStoreRow[]>({ queryKey: STORES_KEY }, (rows) => replaceRow(rows, next))
      notify.success(t(`${verb}.done`), t(`${verb}.doneDetail`, { store: fsi(row.storeCode) }))
      onDone()
    },
    onError: (err) => {
      if (apiErrorCode(err) === E.notOnboarded) void qc.invalidateQueries({ queryKey: STORES_KEY })
    },
  })
  const gone = apiErrorCode(send.error) === E.notOnboarded

  return (
    <ReasonDialog
      open
      title={t(`${verb}.title`)}
      note={<Trans t={t} i18nKey={`${verb}.note`} values={{ store: row.storeCode }} components={{ store: <Ltr /> }} />}
      busy={send.isPending}
      error={send.error}
      confirmLabel={t(`${verb}.confirm`)}
      confirmDisabled={gone}
      handledCodes={[E.notOnboarded]}
      onEdit={() => send.reset()}
      onConfirm={(reason) => send.mutate(reason)}
      onClose={onClose}
    >
      <div data-sync-active-dialog={verb}>
        {gone && <GoneAlert prefix={verb} error={send.error} data="data-sync-active-gone" />}
      </div>
    </ReasonDialog>
  )
}

/**
 * Push a store's stock to HungerStation now, IN FULL, with a reason (ticket 553). The note says it
 * is a full push to the live HungerStation vendor. The door answers the push's log row: the row's
 * sync block takes it at once (`applyPush`), the list is read again, and `onDone` hands the log row
 * to the page, which shows the result (rows sent, status).
 *
 * The mutation is keyed by `syncNowKey`, so the actions cell shows the push running and cannot
 * start a second one. Sync now's own refusals (`syncNowRefusal`) read in words beside the server's:
 * DHS-00013 paused, DHS-00014 HungerStation refused (its answer is `message`; the push was recorded
 * as failed), DHS-00007 removed meanwhile — and 409 `HungerStationSyncBusy`, which is NOT an error:
 * a push is already running, nothing was recorded, try again shortly.
 */
export function SyncNowDialog({
  row,
  onClose,
  onDone,
}: {
  row: HungerStationStoreRow
  onClose: () => void
  onDone: (log: HungerStationSyncLogRow) => void
}) {
  const { t } = useTranslation('hungerstation-stores')
  const qc = useQueryClient()
  // One push per click: the shared ReasonDialog ignores a second Confirm while the first is sending.
  const send = useMutation({
    mutationKey: syncNowKey(row.storeCode),
    mutationFn: (reason: string) => storesApi.syncNow(row.storeCode, { reason }),
    onSuccess: (log) => {
      qc.setQueriesData<HungerStationStoreRow[]>({ queryKey: STORES_KEY }, (rows) =>
        rows?.map((r) => (r.storeCode === row.storeCode ? applyPush(r, log) : r)),
      )
      void qc.invalidateQueries({ queryKey: STORES_KEY })
      notify.success(t('syncNow.done'), t('syncNow.doneDetail', { store: fsi(row.storeCode) }))
      onDone(log)
    },
    onError: (err) => {
      // Busy recorded nothing, so the list has nothing new; every other refusal of its own has.
      const kind = syncNowRefusal(apiErrorCode(err))
      if (kind === 'gone' || kind === 'paused' || kind === 'hungerStationFailed') void qc.invalidateQueries({ queryKey: STORES_KEY })
    },
  })
  const code = apiErrorCode(send.error)
  const kind = syncNowRefusal(code)
  const message = apiErrorMessage(send.error, t('dialog.failedHint'))

  return (
    <ReasonDialog
      open
      title={t('syncNow.title')}
      note={
        <Trans
          t={t}
          i18nKey="syncNow.note"
          values={{ store: row.storeCode, vendorId: row.vendorId }}
          components={{ store: <Ltr />, vendor: <Ltr /> }}
        />
      }
      busy={send.isPending}
      error={send.error}
      confirmLabel={t('syncNow.confirm')}
      confirmDisabled={!row.sync.active || kind === 'gone' || kind === 'paused'}
      handledCodes={SYNC_NOW_CODES}
      onEdit={() => send.reset()}
      onConfirm={(reason) => send.mutate(reason)}
      onClose={onClose}
    >
      <div data-sync-now-dialog="">
        {kind === 'busy' ? (
          <div role="status" className="flex flex-col gap-1 rounded-md border border-border bg-muted px-3 py-2 text-xs text-foreground" data-sync-now-refusal="busy">
            <p className="font-semibold">{t('syncNow.refusal.busy')}</p>
            <p className="text-muted-foreground">{t('syncNow.refusal.busyHint')}</p>
          </div>
        ) : (
          kind && (
            <div role="alert" className="flex flex-col gap-1 rounded-md border border-danger-border bg-danger-050 px-3 py-2 text-xs text-danger-800" data-sync-now-refusal={kind}>
              <p className="font-semibold">{t(`syncNow.refusal.${kind}`)}</p>
              <p>{t(`syncNow.refusal.${kind}Hint`)}</p>
              <InlineRefusal message={message} code={code} />
            </div>
          )
        )}
      </div>
    </ReasonDialog>
  )
}
