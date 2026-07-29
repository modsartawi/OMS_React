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
import { ExternalLink, Loader2, Search, X } from 'lucide-react'
import { apiErrorMessage } from '@/core/api'
import type {
  LoyaltyMember,
  SessionAddress,
  SessionCustomer,
  SessionState,
} from '@/core/models/callcenter'
import Ltr from '@/core/ui/Ltr'
import { callCenterApi } from './api'
import { railBlock } from './fulfilment-view'
import type { LinkedCard, RequestOffer } from './linked-request'
import { addressPlace, addressSlot, railFields, type AddressSlot } from './rail-view'
import SignupPanel, { type SignupActions } from './SignupPanel'
import { beginSignup, type SignupState } from './signup-view'

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

/** The signup's state and its verbs, as one prop — 159. Absent means the console
 *  has no enrolment wired, and then it offers none (the posture the rail already
 *  takes for the address book). */
export interface RailSignup {
  state: SignupState
  actions: SignupActions
}

/**
 * The caller's open sales requests, as one prop (194) — the count to volunteer,
 * the card once one is linked, and the way into the picker.
 *
 * 🚩 **Both are the page's derivations, not the rail's.** `requestOffer` and
 * `linkedCard` are read once, in the page, off the same `SessionState` the picker
 * gets — so the count, the card and the picker cannot disagree about whether this
 * order has a request on it. Absent means the console has no request surface
 * wired, and then it offers none (the posture the rail already takes for the
 * address book and the signup).
 */
export interface RailRequests {
  /** The count block, or `null` for silence — a plain order gains no furniture. */
  offer: RequestOffer | null
  /** What this order converts, once it converts something. Replaces the count. */
  card: LinkedCard | null
  /** Opens the picker. 🚩 Nothing opens by itself: the agent is mid-greeting and
   *  a picker over the basket takes the call away from them. */
  onView: () => void
}

export default function CustomerRail({
  state,
  customerActions,
  onPickAddress,
  requests,
  signup,
}: {
  state: SessionState
  customerActions: CustomerActions
  signup?: RailSignup
  /** 194's surface. Absent ⇒ the rail says nothing about requests at all. */
  requests?: RailRequests
  /** Opens the address book — [166](.issues/166-address-derives-the-store.md)'s
   *  surface, wired at that ticket. **Absent means the door will not answer it**:
   *  the page passes it only while `capabilities.canOpenAddressBook` holds, so
   *  the capability is read in one place rather than re-tested here, and an
   *  offer with nothing behind it is drawn as words rather than as a button. */
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

  /**
   * 🚩 **The retained address is the SERVER'S to say** (176, contract v1.8).
   *
   * Under `PickInStore` the address leaves the projection entirely — capture 09's
   * flip answers `address: null` — but the sidecar keeps it, and a flip back
   * re-derives the store from it (§2.2). An agent looking at a collection order
   * therefore has no way to know that switching back will MOVE the store: the
   * diff would arrive as a confirmation about a store they never chose.
   *
   * The obvious client answer — remember the last address this tab saw — was
   * **built and rejected** (owner ruling, 2026-07-29). It is invisible after a
   * refresh, absent in a second tab and absent on a resumed order, so the same
   * order reads two ways depending on how the agent arrived at it. That is the
   * failure this map has ruled against everywhere else, and the sidecar already
   * holds the truth. So the header carries the label and the console renders it.
   */
  const retained = state.header.retainedAddressLabel ?? null

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
              call — so it is stated plainly, on no alarm ground, and 159 hangs
              the enrolment off it as the next ordinary thing rather than as a
              recovery from a failure. */}
          {lookup.isSuccess && !lookup.data && (
            <div data-cc-lookup-miss>
              <p className="text-xs text-muted-foreground">{t('rail.notFound')}</p>
              {/* 🚩 Absent, not disabled — the console's standing posture (175,
                  156, 176). A rail with no signup wired offers no control at
                  all rather than one that answers with silence. */}
              {signup && signup.state.step === 'closed' && (
                <button
                  type="button"
                  onClick={() => signup.actions.onChange(beginSignup(mobile.trim()))}
                  data-cc-signup-open
                  className="mt-1.5 w-full rounded-md border border-input px-3 py-1.5 text-xs font-medium hover:bg-accent"
                >
                  {t('signup.open')}
                </button>
              )}
            </div>
          )}

          {signup && (
            <SignupPanel state={signup.state} actions={signup.actions} attaching={busy} />
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

      {/* 🚩 **The count is drawn, the modal is not** (194) — under the caller card,
          because a request belongs to the CALLER and not to the order: it arrives
          with them and 880 §6 takes it away with them. Under rather than beside,
          which was the ticket's own open question: the rail is 260px and the card
          already carries name, mobile and tier, so a second column would have cost
          the compact layout its one property. */}
      {requests && <RequestBlock requests={requests} />}

      {/* 🚩 **The two modes are two blocks in the SAME place, never one block
          with a conditional label** (176). 135's one winning property is that
          the furniture does not move, and a rail whose second section collapses
          under collection would move everything under it. They are the same
          question asked of two different orders — *where is this going* /
          *where are they collecting it* — so they get the same pixels and
          different words. */}
      <div className="mt-2 border-t border-border pt-3">
        {railBlock(state.header) === 'collection' ? (
          <CollectionBlock state={state} retained={retained} />
        ) : (
          <>
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t('rail.address')}
            </div>
            <AddressBlock address={state.header.address} slot={slot} onPickAddress={onPickAddress} />
          </>
        )}
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

/**
 * The request block: either *"2 open requests · view"* or the card of the one this
 * order converts. Never both — one order converts at most one request
 * (`RefDocumentNo` is singular and 055c makes the conversion one-shot), so the
 * card **replaces** the count rather than sitting under it.
 *
 * 🚩 **No money on the card at all.** The request is unpriced; the basket and the
 * receipt are where this order's money lives. *Unlink* is
 * [195](.issues/195-unlinking-and-the-request-that-went-away.md)'s and is
 * deliberately not offered yet — it is a full undo of the copy, not a stamp being
 * cleared, and it asks first.
 */
function RequestBlock({ requests: { offer, card, onView } }: { requests: RailRequests }) {
  const { t } = useTranslation('callcenter')

  if (card)
    return (
      <div className="rounded-md border border-border bg-card p-2.5 text-xs" data-cc-request-card>
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
          {t('request.cardTitle')}
        </div>
        <div className="mt-0.5 flex items-center gap-1.5">
          <span data-numeric className="font-semibold">
            <Ltr>{card.documentNo}</Ltr>
          </span>
          {/* The same escape hatch the picker offers, kept on the card because the
              picker is gone by now and the request is the one thing on this order
              an agent may still need to read in full. A new tab: the call keeps its
              console, and this is the ONLY thing said here about that screen. */}
          <a
            href={card.href}
            target="_blank"
            rel="noreferrer"
            data-cc-request-card-open
            aria-label={t('request.openDocument')}
            title={t('request.openDocument')}
            className="text-muted-foreground hover:text-foreground"
          >
            <ExternalLink className="h-3 w-3" aria-hidden />
          </a>
        </div>
        {/* The reason in words, or nothing — never the code (880 §3). */}
        {card.reason && (
          <div className="text-muted-foreground" data-cc-request-card-reason>
            {card.reason}
          </div>
        )}
        <div className="mt-1 text-muted-foreground" data-cc-request-card-store>
          {t('request.raisedAt', { store: card.storeCode })}
        </div>
        {/* The pharmacist's own words, shown and copied nowhere (880 §4.4). */}
        {card.note && (
          <p className="mt-1 text-muted-foreground" data-cc-request-card-note>
            {t('request.noteFrom', { note: card.note })}
          </p>
        )}
      </div>
    )

  if (!offer) return null

  return (
    <div
      className="rounded-md border border-attention-border bg-attention-050 p-2.5"
      data-cc-request-offer={String(offer.count)}
    >
      {/* 🚩 An unnoticed request is the failure this slice exists to prevent, so
          the console volunteers it — on attention ground, because it is something
          that happened and the agent has to read it, not a refusal. */}
      <p className="text-xs text-attention-800">
        {t('request.openCount', { count: offer.count })}
      </p>
      <button
        type="button"
        onClick={onView}
        data-cc-request-view
        className="mt-1.5 w-full rounded-md border border-attention-border px-3 py-1.5 text-xs font-semibold text-attention-800 hover:opacity-80"
      >
        {t('request.view')}
      </button>
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

/**
 * The rail under `PickInStore` — *collecting from*, in the address block's own
 * pixels (176).
 *
 * Three things it deliberately holds:
 *
 * 1. **No control.** The store's control is the store chip, which already opens
 *    the picker. A second *Choose a store* here would be two doors onto one act,
 *    and the console's rule is one section, one way in.
 * 2. 🚩 **It says when nobody has chosen** — `plantSource: seededAtOpen` is the
 *    value that means the plant is the agent's own entry store and no human
 *    picked it (§2.3). The same fact reaches the chip row as a
 *    `STORE_NOT_CHOSEN` blocker; this is the rail saying it in the place the
 *    agent is looking while they talk.
 * 3. 🚩 **The retained-address trace.** One line, no data the agent can act on —
 *    enough that *switch back and the store may move* is not a surprise.
 */
function CollectionBlock({
  state,
  retained,
}: {
  state: SessionState
  /** `header.retainedAddressLabel` — the label alone, never the address. The
   *  agent cannot act on it and must not read it out; it exists so that
   *  *switching back moves the store* is not a surprise. */
  retained: string | null
}) {
  const { t } = useTranslation('callcenter')
  const { header } = state
  const chosen = header.plantSource !== 'seededAtOpen'
  return (
    <>
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {t('rail.collectingFrom')}
      </div>
      <div
        className={`rounded-md border p-2 text-xs ${
          chosen ? 'border-border bg-card' : 'border-dashed border-input'
        }`}
        data-cc-collection={chosen ? 'chosen' : 'unchosen'}
      >
        {chosen ? (
          <>
            {/* Server-supplied, passed through as data — `plantName` is always
                the server's, because a delivery-only store is in no list this
                client holds. */}
            <div className="font-medium">{header.plantName}</div>
            <div data-numeric className="text-muted-foreground">
              <Ltr>{header.plant}</Ltr>
            </div>
          </>
        ) : (
          <p className="text-attention-800">{t('rail.storeNotChosen')}</p>
        )}
      </div>
      {/* 🚩 The trace. Drawn only where there IS one — an order that has never
          held an address has nothing to keep, and a sentence promising a kept
          address that does not exist is worse than silence. */}
      {retained && (
        <p className="mt-1.5 text-[11px] text-muted-foreground" data-cc-address-retained>
          {t('rail.addressRetained', { label: retained })}
        </p>
      )}
    </>
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

  const place = addressPlace(address)

  if (slot === 'set' && address)
    return (
      <div className="rounded-md border border-border bg-card p-2 text-xs" data-cc-address="set">
        <div className="font-medium">{address.label}</div>
        {/* The server's own line — the STREET, and only the street. Absent
            rather than an empty run: plenty of book rows carry no street at
            all, and a blank line under the label reads as something that failed
            to arrive. */}
        {address.line?.trim() && <div className="text-muted-foreground">{address.line}</div>}
        {/* 🚩 WHERE THE ORDER IS GOING (owner-stated 2026-07-29). The district is
            what derives the fulfilment store, and until now the rail could show
            an agent *Home* and nothing else — the label is the caller's word for
            an address, not a place. Rendered from the two fields the projection
            already sends, never re-composed from the line. */}
        {place && (
          <div className="text-muted-foreground" data-cc-address-place>
            {place.district && place.city
              ? // The same sentence the district picker settles on, so the two
                // surfaces name one place the same way.
                t('address.form.districtLine', { district: place.district, city: place.city })
              : (place.district ?? place.city)}
          </div>
        )}
        {/* A settled section re-opens in place. Changing it on a basket with
            lines moves the store and is previewed first (167) — which is the
            server's call, raised on the answer to `setAddress`, not a rule
            this button checks. */}
        {onPickAddress && (
          <button
            type="button"
            onClick={onPickAddress}
            data-cc-change-address
            className="mt-1.5 text-xs font-medium text-primary underline-offset-2 hover:underline"
          >
            {t('rail.changeAddress')}
          </button>
        )}
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
