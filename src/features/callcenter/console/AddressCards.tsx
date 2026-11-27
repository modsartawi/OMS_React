/**
 * The caller column's address book (989, spec 983 D10): the attached caller's addresses as
 * selectable cards, with the one the order holds selected.
 *
 * - **One click applies**, through the page's ordinary rebind — the same `onPick` the
 *   `AddressPicker` dialog uses, so a basket with lines still meets §5.1's store-move
 *   confirmation and nothing else (166/167).
 * - 🚩 **An applied pin shows as the selected address** (`bookCards`): the location link's
 *   *Apply* writes the pin onto the order's address, and that card says so.
 * - **Editing, deleting and creating stay in the dialog** (`AddressPicker`, 187/188):
 *   *Manage* opens it. The cards only choose.
 * - It reads the book once a caller is attached, keyed by the customer (`addressBookKey`),
 *   sharing the dialog's cache — so a create or an edit there re-draws the cards here.
 *
 * It derives no store and never composes the order's own address line: the cards are book
 * rows (`address-book.ts`), the selection is a comparison of numbers.
 */
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Check, Loader2, MapPin, Star } from 'lucide-react'
import { apiErrorCode, apiErrorMessage } from '@/core/api'
import type { SessionAddress } from '@/core/models/callcenter'
import Button from '@/core/ui/Button'
import { addressBookKey, callCenterApi } from './api'
import { addressRefusalKey, bookCards } from './address-book'
import type { AddressApply } from './AddressPicker'
import { NOTE } from './console-notes'

export default function AddressCards({
  customerId,
  orderAddress,
  apply,
  onManage,
}: {
  /** Whose book this is — the cache key; the read itself is session-scoped server-side. */
  customerId: string
  /** The address the order holds (and its pin), straight off the projection. */
  orderAddress: SessionAddress | null
  apply: AddressApply
  /** Opens the address book dialog (edit, delete, add). Absent ⇒ no *Manage*. */
  onManage?: () => void
}) {
  const { t } = useTranslation('callcenter')
  const { pending, error, onPick } = apply

  const book = useQuery({
    queryKey: addressBookKey(customerId),
    queryFn: () => callCenterApi.customerAddresses(),
    retry: false,
  })

  const cards = bookCards(book.data, orderAddress)
  const busy = pending !== null
  const refused = error !== null && error !== undefined
  const explained = refused ? addressRefusalKey(apiErrorCode(error)) : null

  return (
    <section className="flex flex-col gap-2 border-b border-divider px-4 py-3" data-cc-address-cards>
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">
          {t('callerColumn.addresses')}
        </h2>
        {onManage && (
          <Button variant="text" onClick={onManage} disabled={busy} data-cc-address-manage>
            {t('callerColumn.manageAddresses')}
          </Button>
        )}
      </div>

      {book.isPending && (
        <p className="flex items-center gap-2 text-xs text-muted-foreground" data-cc-address-cards-loading>
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          {t('address.loading')}
        </p>
      )}

      {book.isError && (
        <>
          <p className={NOTE.danger} data-cc-address-cards-error>
            {apiErrorMessage(book.error, t('address.loadFailed'))}
          </p>
          {/* Never a dead end: the read is pure, so trying it again costs the order nothing.
              `retry: false` keeps automatic retries off — this is the agent's hand on it. */}
          <Button
            variant="outlined"
            onClick={() => void book.refetch()}
            disabled={book.isFetching}
            data-cc-address-cards-reload
            className="self-start"
          >
            {t('actions.retry')}
          </Button>
        </>
      )}

      {book.isSuccess && cards.length === 0 && (
        <p className="text-xs text-muted-foreground" data-cc-address-cards-empty>
          {t('address.emptyBook')}
        </p>
      )}

      {cards.map((card) => (
        <button
          key={card.addressNumber}
          type="button"
          // 🚩 One click applies — the ordinary rebind (166). The selected card is not a
          // control: re-applying the address the order holds is a wasted verb.
          onClick={() => onPick(card.addressNumber)}
          disabled={busy || card.isCurrent}
          aria-pressed={card.isCurrent}
          data-cc-address-card={card.addressNumber}
          data-cc-address-card-selected={card.isCurrent ? '' : undefined}
          className={`flex min-w-0 items-start gap-2 rounded-md border p-2.5 text-start ${
            card.isCurrent
              ? 'border-primary bg-accent'
              : 'border-border bg-card hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-card'
          }`}
        >
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              {/* Server-supplied where there is one; the console words only an unlabelled row. */}
              <bdi className="text-sm font-medium">{card.label ?? t('address.unlabelled')}</bdi>
              {card.isDefault && (
                <span className="inline-flex items-center gap-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                  <Star className="h-2.5 w-2.5" aria-hidden />
                  {t('address.default')}
                </span>
              )}
            </div>
            <div className="text-xs text-muted-foreground">
              {card.line ? <bdi>{card.line}</bdi> : t('address.noLine')}
            </div>
            {card.isCurrent && (
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px]">
                <span className="inline-flex items-center gap-1 text-success-800" data-cc-address-card-current>
                  <Check className="h-3 w-3" aria-hidden />
                  {t('address.onThisOrder')}
                </span>
                {card.pinned && (
                  <span className="inline-flex items-center gap-1 text-success-800" data-cc-address-card-pinned>
                    <MapPin className="h-3 w-3" aria-hidden />
                    {t('callerColumn.pinApplied')}
                  </span>
                )}
              </div>
            )}
          </div>
          {pending === card.addressNumber && (
            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" aria-hidden />
          )}
        </button>
      ))}

      {refused && (
        <p className={NOTE.danger} data-cc-address-cards-refused>
          {explained ? t(explained) : apiErrorMessage(error, t('address.applyFailed'))}
        </p>
      )}
    </section>
  )
}
