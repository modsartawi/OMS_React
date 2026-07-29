/**
 * The address book, opened (ticket 166) — and, since 187, **written**.
 *
 * Picking the caller's address is what decides where the order is fulfilled
 * from, and this is the only surface that does it. Three properties it exists to
 * hold:
 *
 * 1. 🚩 **One click applies.** On an empty basket there is nothing to re-price,
 *    so §5.1 raises no confirmation and this dialog must not invent one — a
 *    select-then-confirm step here would be a modal in front of a modal for a
 *    change that costs nothing. A basket WITH lines takes the confirm path
 *    ([167](.issues/167-store-move-shows-the-diff.md)), which is the page's:
 *    the answer to the pick carries the preview, and `StoreMoveConfirm` draws
 *    it in place of this dialog. There is exactly one confirmation mechanism on
 *    this screen and it is not here.
 * 2. 🚩 **Both refusals are explained, and neither reads as "not found."** An
 *    address act before a caller is attached and an address belonging to someone
 *    else are different facts, and the distinction matters to support (§6.3).
 *    `address-book.ts` names them; nothing here shows a machine code.
 * 3. **The book is the door's answer, read when it is opened.** It is fetched
 *    per caller (`addressBookKey`), which is what stops the previous call's
 *    addresses from being offered for this one.
 *
 * 🚩 **One dialog, two views** (187, ruling 6 of
 * [179](.issues/179-the-address-editor-and-its-capture-contract.md)). The form
 * replaces the list **inside** this dialog rather than opening on top of it —
 * property 1 above is the reason, stated for the confirm step and holding
 * exactly as well for the editor.
 *
 * ⚠️ **Edit is offered on rows the order is NOT using.** Editing the one the
 * order holds is an order act — it must be followed by a re-issued `setAddress`
 * on the same number, or the order keeps a plant derived from a district the
 * address has left (§6.5) — and that is
 * [188](.issues/188-editing-re-pins-deleting-is-refused.md)'s slice. Offering
 * the control here before the re-pin exists would be the silent wrong price
 * §6.5 was written to prevent. Deleting is 188's too, on both counts: the
 * control is omitted on the current row and the SERVER refuses it
 * (`ADDRESS_IN_USE_BY_ORDER`) — the refusal is the guard, the omission the
 * courtesy.
 *
 * It derives no store. The plant that comes back is the server's, and the chip
 * row is where it is explained.
 */
import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Check, Loader2, Pencil, Plus, Star } from 'lucide-react'
import { apiErrorCode, apiErrorMessage } from '@/core/api'
import type { CustomerAddressBookEntry, CustomerAddressCapture } from '@/core/models/callcenter'
import Button from '@/core/ui/Button'
import Modal from '@/core/ui/Modal'
import { addressBookKey, callCenterApi } from './api'
import { addressChoices, addressRefusalKey } from './address-book'
import {
  addressFormIsSendable,
  addressFormOf,
  addressPayload,
  emptyAddressForm,
  type AddressFormValues,
} from './address-capture'
import AddressForm from './AddressForm'
import { NOTE } from './console-notes'

/**
 * `setAddress` and everything it is currently saying, as one prop — they are one
 * act's state and always travel together, the shape `CustomerActions` set for the
 * rail's two verbs (165). The call itself is the page's: it returns the whole
 * `SessionState` and the cache is the store of record.
 */
export interface AddressApply {
  /** The `addressNumber` currently being applied, if any. */
  pending: string | null
  /** The failed `setAddress`, raw. Explained here so that the list read and the
   *  apply — which refuse with the SAME two codes — cannot drift apart. */
  error: unknown
  onPick: (addressNumber: string) => void
}

/**
 * The two book WRITES (187). Both are the page's — the mutations, the book
 * invalidation and, for a create, the auto-apply that follows it.
 *
 * 🚩 A create **auto-applies**: `POST` answers the whole row including the new
 * `addressNumber`, and the only reason an agent creates an address mid-call is
 * to deliver to it (179 ruling 6). So `onCreate` resolving is the end of the
 * agent's task, not the start of a second one — the page applies and closes the
 * book, and this component never sees the pick it caused.
 */
export interface AddressWrite {
  onCreate: (capture: CustomerAddressCapture) => Promise<void>
  onUpdate: (addressNumber: string, capture: CustomerAddressCapture) => Promise<void>
}

type View = { kind: 'list' } | { kind: 'create' } | { kind: 'edit'; addressNumber: string }

export default function AddressPicker({
  open,
  customerId,
  currentAddressNumber,
  apply,
  write,
  onClose,
}: {
  open: boolean
  /** Whose book this is. The read itself is session-scoped server-side; this is
   *  only what the cache is keyed by. */
  customerId: string
  /** The address already on the order, if any — shown as held, not offered. */
  currentAddressNumber: string | null
  apply: AddressApply
  write: AddressWrite
  onClose: () => void
}) {
  const { t } = useTranslation('callcenter')
  const { pending, error: applyError, onPick } = apply

  const book = useQuery({
    queryKey: addressBookKey(customerId),
    queryFn: () => callCenterApi.customerAddresses(),
    // Fetched only once the agent actually opens the book — a console that read
    // it on every attach would call the door for every caller who never needs an
    // address changed. `staleTime: 0` re-reads it on each open, so an address
    // added elsewhere is not invisible for the rest of a call.
    enabled: open,
    staleTime: 0,
    retry: false,
  })

  const [view, setView] = useState<View>({ kind: 'list' })
  const [form, setForm] = useState<AddressFormValues>(emptyAddressForm)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<unknown>(null)

  // A closed dialog holds no half-typed address: the next open starts on the
  // book, which is what an agent opening it is looking for. Same rule the source
  // form follows — a re-opened section shows what is settled, not what was typed
  // into it last time.
  useEffect(() => {
    if (open) return
    setView({ kind: 'list' })
    setSaveError(null)
  }, [open])

  const choices = addressChoices(book.data, currentAddressNumber)
  const busy = pending !== null
  const listing = view.kind === 'list'

  const startCreate = () => {
    setForm(emptyAddressForm())
    setSaveError(null)
    setView({ kind: 'create' })
  }

  const startEdit = (entry: CustomerAddressBookEntry) => {
    setForm(addressFormOf(entry))
    setSaveError(null)
    setView({ kind: 'edit', addressNumber: entry.addressNumber })
  }

  const save = async () => {
    if (view.kind === 'list' || saving || !addressFormIsSendable(form)) return
    setSaving(true)
    setSaveError(null)
    try {
      const capture = addressPayload(form)
      if (view.kind === 'create') await write.onCreate(capture)
      else await write.onUpdate(view.addressNumber, capture)
      // A landed write leaves the agent on the book, reading the row they just
      // corrected. (After a CREATE the page has already applied and closed it.)
      setView({ kind: 'list' })
    } catch (err) {
      // Held here rather than thrown on: the form is where the agent is, and
      // what they typed is still in front of them to correct.
      setSaveError(err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      // A dismissal mid-apply would leave the agent unsure whether the store
      // moved. The request settles either way, so the dialog holds until it does.
      onClose={() => !busy && !saving && onClose()}
      title={
        listing
          ? t('address.title')
          : view.kind === 'create'
            ? t('address.form.createTitle')
            : t('address.form.editTitle')
      }
      width="30rem"
      footer={
        listing ? (
          <>
            {/* The foot control 179 ruling 6 named. Offered whatever the read
                answered — an empty book is the state it most exists for. */}
            <Button variant="outlined" onClick={startCreate} disabled={busy} data-cc-address-add>
              <Plus className="h-3.5 w-3.5" aria-hidden />
              {t('address.form.add')}
            </Button>
            <Button variant="text" onClick={onClose} disabled={busy} data-cc-address-close>
              {t('address.close')}
            </Button>
          </>
        ) : (
          <>
            <Button
              variant="text"
              onClick={() => setView({ kind: 'list' })}
              disabled={saving}
              data-cc-address-back
            >
              {t('address.form.back')}
            </Button>
            <Button
              variant="primary"
              onClick={() => void save()}
              // The gate is the form's own predicate, not a second reading of
              // it — `addressFormIsSendable` is what `addressFormErrors` says.
              disabled={saving || !addressFormIsSendable(form)}
              data-cc-address-save
            >
              {saving ? t('address.form.saving') : t('address.form.save')}
            </Button>
          </>
        )
      }
    >
      {!listing ? (
        <AddressForm
          values={form}
          onChange={setForm}
          busy={saving}
          error={
            saveError !== null && saveError !== undefined ? (
              <Refusal
                error={saveError}
                fallbackKey={view.kind === 'create' ? 'address.form.createFailed' : 'address.form.updateFailed'}
              />
            ) : null
          }
        />
      ) : (
        <div className="space-y-2 text-sm" data-cc-address-picker>
          {book.isPending && (
            <p className="flex items-center gap-2 text-muted-foreground" data-cc-address-loading>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              {t('address.loading')}
            </p>
          )}

          {book.isError && (
            <>
              <Refusal error={book.error} fallbackKey="address.loadFailed" />
              {/* Never a dead end: the read is pure, so trying it again costs the
                  order nothing. `retry: false` keeps the automatic retries off —
                  this is the agent's hand on it, not a loop. */}
              <Button
                variant="outlined"
                onClick={() => void book.refetch()}
                disabled={book.isFetching}
                data-cc-address-reload
              >
                {t('actions.retry')}
              </Button>
            </>
          )}

          {book.isSuccess && choices.length === 0 && (
            // The caller has no addresses on file — a first-time caller, and the
            // state 187's editor exists to serve. Stated, with the foot control
            // one press away.
            <p className="text-muted-foreground" data-cc-address-empty>
              {t('address.emptyBook')}
            </p>
          )}

          {choices.map((choice) => (
            <div
              key={choice.addressNumber}
              className="flex items-stretch gap-1.5"
              data-cc-address-row={choice.addressNumber}
            >
              <button
                type="button"
                // 🚩 One click applies. No radio, no *Apply* — an empty basket has
                // nothing to re-price and the server raises no confirmation.
                onClick={() => onPick(choice.addressNumber)}
                disabled={busy || choice.isCurrent}
                data-cc-address-option={choice.addressNumber}
                className="flex min-w-0 flex-1 items-start gap-2 rounded-md border border-border bg-card p-2.5 text-start hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-card"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-medium">
                      {/* Server-supplied where there is one; the console owns only
                          the wording for a row that carries no label. */}
                      {choice.label ?? t('address.unlabelled')}
                    </span>
                    {choice.isDefault && (
                      <span
                        className="inline-flex items-center gap-0.5 text-[10px] uppercase tracking-wide text-muted-foreground"
                        data-cc-address-default
                      >
                        <Star className="h-2.5 w-2.5" aria-hidden />
                        {t('address.default')}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {choice.line ?? t('address.noLine')}
                  </div>
                </div>
                {choice.isCurrent && (
                  <span className="inline-flex shrink-0 items-center gap-1 text-[11px] text-success-800" data-cc-address-current>
                    <Check className="h-3 w-3" aria-hidden />
                    {t('address.onThisOrder')}
                  </span>
                )}
                {pending === choice.addressNumber && (
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" aria-hidden />
                )}
              </button>
              {/* ⚠️ Absent — not disabled — on the address the order is using:
                  correcting that one re-pins the store, which is 188. A control
                  the agent's hand lands on is worse than no control (165). */}
              {!choice.isCurrent && (
                <button
                  type="button"
                  onClick={() => {
                    const entry = (book.data ?? []).find(
                      (e) => e.addressNumber === choice.addressNumber,
                    )
                    if (entry) startEdit(entry)
                  }}
                  disabled={busy}
                  aria-label={t('address.form.edit')}
                  title={t('address.form.edit')}
                  data-cc-address-edit={choice.addressNumber}
                  className="flex shrink-0 items-center rounded-md border border-border bg-card px-2 text-muted-foreground hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Pencil className="h-3.5 w-3.5" aria-hidden />
                </button>
              )}
            </div>
          ))}

          {applyError !== null && applyError !== undefined && (
            <Refusal error={applyError} fallbackKey="address.applyFailed" />
          )}
        </div>
      )}
    </Modal>
  )
}

/**
 * A refusal, explained. The two the address door has of its own get the
 * console's own sentence; anything else is the server's own words, which is the
 * rule for every other refusal on this screen (`api-envelope`).
 */
function Refusal({ error, fallbackKey }: { error: unknown; fallbackKey: string }) {
  const { t } = useTranslation('callcenter')
  const explained = addressRefusalKey(apiErrorCode(error))
  return (
    <p className={NOTE.danger} data-cc-address-error>
      {explained ? t(explained) : apiErrorMessage(error, t(fallbackKey))}
    </p>
  )
}
