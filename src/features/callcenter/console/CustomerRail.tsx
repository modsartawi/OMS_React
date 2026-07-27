/**
 * The customer rail — the first thing that happens on a call, and the one column
 * that never moves (135's variant A).
 *
 * Three properties this file exists to hold:
 *
 * 1. 🚩 **The caret is in the phone field the moment the console opens** (US9,
 *    CC2 finding 1, never built in WPF). The agent's first keystroke is the one
 *    the screen expects — they do not click first and they do not hunt. It is an
 *    `autoFocus` on the input rather than an effect chasing a ref, because the
 *    field mounts exactly once, with the console.
 * 2. **Attaching fills a compact card of six fields maximum**, in a fixed order.
 *    The cap and the order are `rail-view.ts`'s; this file only draws what that
 *    module returns, so a seventh field cannot be added by widening some JSX.
 * 3. 🚩 **The address block is what `capabilities` says it is.** Customer-first
 *    is shown as intent, not enforcement: with no caller there is no disabled
 *    control to poke — the console states the next step — and *Pick an address*
 *    appears only once the door will actually answer it (§6.3). The console
 *    never re-derives that rule.
 *
 * Finding the caller is deliberately **two steps**: the lookup names who was
 * found and the agent attaches them. A wrong number that attached itself would
 * have to be removed from a real order, and the second key is cheaper than that.
 * A caller who is not in the loyalty base is said so plainly and no further —
 * signup is [159](.issues/159-coupon-and-loyalty-signup-drawn.md)'s undrawn
 * surface and this slice must not invent one.
 */
import { useEffect, useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Loader2, Search, X } from 'lucide-react'
import { apiErrorMessage } from '@/core/api'
import type {
  LoyaltyMember,
  SessionAddress,
  SessionCustomer,
  SessionState,
} from '@/core/models/callcenter'
import Ltr from '@/core/ui/Ltr'
import { callCenterApi } from './api'
import { addressSlot, railFields, type AddressSlot } from './rail-view'

/**
 * The two customer verbs and their one shared outcome, as one prop. They travel
 * together everywhere (page → shell → rail) and are one act with two
 * directions, so a single `busy` and a single `error` is the honest shape —
 * only one of them can be in flight.
 */
export interface CustomerActions {
  /** Binds the found member to the order (`attachCustomer`). The call, its
   *  `requestId` and the state it returns are the page's — the rail only knows
   *  who the agent chose. */
  onAttach: (member: LoyaltyMember) => void
  onRemove: () => void
  busy: boolean
  /** Whichever of the two last failed, in the server's own words. Drawn under
   *  the control that caused it: a remove that failed on an attached card is not
   *  something to report next to an *Attach* button that is not on screen. */
  error: string | null
}

export default function CustomerRail({
  state,
  customerActions,
  onPickAddress,
}: {
  state: SessionState
  customerActions: CustomerActions
  /** Opens the address book — [166](.issues/166-address-derives-the-store.md)'s
   *  surface. WHEN the offer may appear is this ticket's ruling; what it opens
   *  is the next one's, so until it is wired the offer is drawn as words rather
   *  than as a button that would answer with nothing. */
  onPickAddress?: () => void
}) {
  const { t } = useTranslation('callcenter')
  const { onAttach, busy, error } = customerActions
  const customer = state.header.customer

  /**
   * The member the lookup found, kept after attach so the card can carry the
   * three fields the session projection does not hold (tier, points, email).
   *
   * 🚩 It is only ever used through `railFields`, which drops it when its
   * `loyId` is not the attached customer's — so a member left over from the
   * previous search can decorate nobody.
   */
  const [found, setFound] = useState<LoyaltyMember | null>(null)
  const [mobile, setMobile] = useState('')

  const lookup = useMutation({
    mutationFn: (query: string) => callCenterApi.memberByMobile(query),
    onSuccess: (member) => setFound(member),
    retry: false,
  })

  // The mutation object is new on every render, so the reset below reaches it
  // through a ref — otherwise the effect would re-run on every keystroke.
  const lookupRef = useRef(lookup)
  lookupRef.current = lookup

  /**
   * 🚩 **Who the order holds is what the rail is about, so the search clears
   * when that changes** — in both directions.
   *
   * On remove, leaving the last search standing would hand the agent the
   * previous caller's card with a live *Attach* on it, over a phone box already
   * holding the number they have just finished with — and the next call's first
   * keystroke would land in that number. That is US9's caret pointed at the
   * wrong call. On attach, the found card has done its job.
   *
   * Keyed on the customer's identity rather than on a boolean, so swapping one
   * caller for another clears it too.
   */
  const attachedId = customer?.customerId ?? null
  useEffect(() => {
    setMobile('')
    lookupRef.current.reset()
    // `found` deliberately survives an ATTACH — it is the enrichment the compact
    // card carries — and is dropped the moment there is no caller to enrich.
    if (attachedId === null) setFound(null)
  }, [attachedId])

  const search = (event: React.FormEvent) => {
    event.preventDefault()
    const query = mobile.trim()
    if (!query || lookup.isPending) return
    lookup.mutate(query)
  }

  const slot = addressSlot(state.header, state.capabilities)

  return (
    <aside className="flex min-h-0 flex-col gap-3 overflow-auto bg-sidebar p-4" data-cc-rail>
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {t('rail.caller')}
      </div>

      {customer ? (
        <AttachedCard customer={customer} member={found} actions={customerActions} />
      ) : (
        <form onSubmit={search} className="flex flex-col gap-2">
          <label className="text-xs text-muted-foreground" htmlFor="cc-phone">
            {t('rail.mobile')}
          </label>
          <div className="flex gap-1.5">
            <input
              id="cc-phone"
              // 🚩 US9. The console has nothing else to focus and one obvious
              // first act; anything else here costs the agent a click on every
              // call they take.
              autoFocus
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
              inputMode="tel"
              autoComplete="off"
              placeholder={t('rail.mobilePlaceholder')}
              aria-label={t('rail.mobile')}
              data-numeric
              className="min-w-0 flex-1 rounded-md border border-input bg-card px-3 py-2 text-sm outline-none focus:border-ring"
            />
            <button
              type="submit"
              disabled={!mobile.trim() || lookup.isPending}
              data-cc-find
              aria-label={t('rail.find')}
              title={t('rail.find')}
              className="rounded-md border border-input px-2.5 hover:bg-accent disabled:opacity-40"
            >
              {lookup.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Search className="h-4 w-4" aria-hidden />
              )}
            </button>
          </div>

          {lookup.isError && (
            <p className="text-xs text-danger-800" data-cc-lookup-error>
              {apiErrorMessage(lookup.error, t('rail.lookupFailed'))}
            </p>
          )}

          {/* A miss is an ordinary outcome of the first thing that happens on a
              call, so it is stated and left there. No signup control (159). */}
          {lookup.isSuccess && !lookup.data && (
            <p className="text-xs text-muted-foreground" data-cc-lookup-miss>
              {t('rail.notFound')}
            </p>
          )}

          {lookup.isSuccess && lookup.data && (
            <div className="rounded-md border border-border bg-card p-2.5" data-cc-lookup-found>
              <div className="text-sm font-semibold leading-tight">{lookup.data.fullName}</div>
              <div data-numeric className="text-xs text-muted-foreground">
                <Ltr>{lookup.data.mobile}</Ltr>
              </div>
              <button
                type="button"
                onClick={() => onAttach(lookup.data!)}
                disabled={busy}
                data-cc-attach
                className="mt-2 w-full rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50"
              >
                {busy ? t('rail.attaching') : t('rail.attach')}
              </button>
              <CustomerError error={error} />
            </div>
          )}

          <p className="text-[11px] text-muted-foreground">{t('rail.emptyHint')}</p>
        </form>
      )}

      <div className="mt-2 border-t border-border pt-3">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t('rail.address')}
        </div>
        <AddressBlock address={state.header.address} slot={slot} onPickAddress={onPickAddress} />
      </div>
    </aside>
  )
}

/** The compact card. Six fields maximum, in `rail-view.ts`'s fixed order — the
 *  agent's eye lands in the same place on the ninth call as on the first. */
function AttachedCard({
  customer,
  member,
  actions: { onRemove, busy, error },
}: {
  customer: SessionCustomer
  member: LoyaltyMember | null
  actions: CustomerActions
}) {
  const { t } = useTranslation('callcenter')
  const fields = railFields(customer, member)
  return (
    <div className="rounded-md border border-border bg-card p-2.5" data-cc-caller>
      <div className="flex items-start justify-between gap-2">
        <dl className="min-w-0 flex-1 space-y-1">
          {fields.map((field) => (
            <div key={field.id} data-cc-rail-field={field.id}>
              <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">
                {t(`rail.field.${field.id}`)}
              </dt>
              <dd
                className={field.id === 'name' ? 'text-sm font-semibold leading-tight' : 'text-xs'}
                {...(field.id === 'name' ? {} : { 'data-numeric': '' })}
              >
                {/* Server-supplied, passed through as data. */}
                {field.id === 'mobile' ? <Ltr>{field.value}</Ltr> : field.value}
              </dd>
            </div>
          ))}
        </dl>
        {/* 🚩 Removing the caller clears the address and KEEPS the derived store
            — both are the server's doing (§6.3), arriving in the projection.
            Nothing here clears anything on its own. */}
        <button
          type="button"
          onClick={onRemove}
          disabled={busy}
          data-cc-remove-caller
          aria-label={t('rail.remove')}
          title={t('rail.remove')}
          className="shrink-0 rounded-full border border-input p-1 text-muted-foreground hover:bg-accent disabled:opacity-50"
        >
          {busy ? (
            <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
          ) : (
            <X className="h-3 w-3" aria-hidden />
          )}
        </button>
      </div>
      <CustomerError error={error} />
    </div>
  )
}

/** Whichever of attach/remove last failed, under the control that caused it. */
function CustomerError({ error }: { error: string | null }) {
  if (!error) return null
  return (
    <p className="mt-2 text-xs text-danger-800" data-cc-customer-error>
      {error}
    </p>
  )
}

function AddressBlock({
  address,
  slot,
  onPickAddress,
}: {
  address: SessionAddress | null
  slot: AddressSlot
  onPickAddress?: () => void
}) {
  const { t } = useTranslation('callcenter')

  if (slot === 'set' && address)
    return (
      <div className="rounded-md border border-border bg-card p-2 text-xs" data-cc-address="set">
        <div className="font-medium">{address.label}</div>
        <div className="text-muted-foreground">{address.line}</div>
      </div>
    )

  if (slot === 'pick')
    return (
      // US12 — the empty dashed slot with its own *Pick an address*. The next
      // step is the shape of the thing, not a message to read.
      <div
        className="rounded-md border border-dashed border-input p-3 text-center"
        data-cc-address="pick"
      >
        <p className="text-xs text-muted-foreground">{t('rail.noAddress')}</p>
        {/* 🚩 A button appears only once there is a book to open (166). Until
            then the offer is the same words, unclickable: a control that answers
            with silence is the same harm as one that answers with a refusal. */}
        {onPickAddress ? (
          <button
            type="button"
            onClick={onPickAddress}
            data-cc-pick-address
            className="mt-2 text-xs font-medium text-primary underline-offset-2 hover:underline"
          >
            {t('rail.pickAddress')}
          </button>
        ) : (
          <p className="mt-2 text-xs font-medium text-foreground" data-cc-pick-address>
            {t('rail.pickAddress')}
          </p>
        )}
      </div>
    )

  // 🚩 `noCaller` and `unavailable` are drawn WITHOUT a control. A disabled
  // button is still a thing the agent reaches for; the console says what the
  // next step is instead.
  return (
    <div
      className="rounded-md border border-dashed border-input p-3 text-center text-xs text-muted-foreground"
      data-cc-address={slot}
    >
      {t(slot === 'noCaller' ? 'rail.addressNeedsCaller' : 'rail.addressUnavailable')}
    </div>
  )
}
