/**
 * The address book, opened (ticket 166).
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
 * It derives no store. The plant that comes back is the server's, and the chip
 * row is where it is explained.
 */
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Check, Loader2, Star } from 'lucide-react'
import { apiErrorCode, apiErrorMessage } from '@/core/api'
import Button from '@/core/ui/Button'
import Modal from '@/core/ui/Modal'
import { addressBookKey, callCenterApi } from './api'
import { addressChoices, addressRefusalKey } from './address-book'
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

export default function AddressPicker({
  open,
  customerId,
  currentAddressNumber,
  apply,
  onClose,
}: {
  open: boolean
  /** Whose book this is. The read itself is session-scoped server-side; this is
   *  only what the cache is keyed by. */
  customerId: string
  /** The address already on the order, if any — shown as held, not offered. */
  currentAddressNumber: string | null
  apply: AddressApply
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

  const choices = addressChoices(book.data, currentAddressNumber)
  const busy = pending !== null

  return (
    <Modal
      open={open}
      // A dismissal mid-apply would leave the agent unsure whether the store
      // moved. The request settles either way, so the dialog holds until it does.
      onClose={() => !busy && onClose()}
      title={t('address.title')}
      width="30rem"
      footer={
        <Button variant="text" onClick={onClose} disabled={busy} data-cc-address-close>
          {t('address.close')}
        </Button>
      }
    >
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
          // The caller has no addresses on file. Stated and left there — adding
          // one is the address-book WRITE surface, which this slice does not
          // build and must not half-offer.
          <p className="text-muted-foreground" data-cc-address-empty>
            {t('address.emptyBook')}
          </p>
        )}

        {choices.map((choice) => (
          <button
            key={choice.addressNumber}
            type="button"
            // 🚩 One click applies. No radio, no *Apply* — an empty basket has
            // nothing to re-price and the server raises no confirmation.
            onClick={() => onPick(choice.addressNumber)}
            disabled={busy || choice.isCurrent}
            data-cc-address-option={choice.addressNumber}
            className="flex w-full items-start gap-2 rounded-md border border-border bg-card p-2.5 text-start hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-card"
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
        ))}

        {applyError !== null && applyError !== undefined && (
          <Refusal error={applyError} fallbackKey="address.applyFailed" />
        )}
      </div>
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
