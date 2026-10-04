/**
 * The caller bar — the first thing that happens on a call, at the top of the centre
 * column (ticket 409, spec 380 C7/C8; 379's variant C). It replaces 135's 260px
 * customer rail, whose other jobs the sentence above the ledger now does: the address
 * word is the address book's only door, and the store word says "Collecting from".
 *
 * Four properties this file exists to hold:
 *
 * 1. 🚩 **The caret is in the phone box the moment an order opens** (US9, CC2 finding
 *    1, 153/165), and it comes back there when the caller is removed. Keyed on the
 *    ORDER rather than left to a mount-time `autoFocus`: *place, then take the next
 *    call* keeps this console up and swaps the order underneath it, and a caret
 *    parked at the top of the document on call two is the same lost keystroke as on
 *    call one.
 * 2. **Finding the caller is two steps** (165): the lookup names who was found,
 *    inline in the bar, and the agent attaches them. A wrong number that attached
 *    itself would have to be removed from a real order, and the second key is
 *    cheaper than that.
 * 3. **The fields are `railFields`'s** (`caller-bar.ts`): 135's six-field cap and its
 *    sourcing rules hold here by construction, re-seated on one line.
 * 4. 🚩 **The bar takes the same pixels before and after the attach** (135's "the
 *    furniture doesn't move", 379 §1): one fixed-height row in both states. What
 *    opens from it — the sign-up, the linked request's detail, a failure — opens in
 *    the flow UNDER it, never over the order (159, 175 §9).
 */
import { useEffect, useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import { ExternalLink, Loader2, Search, Star, X } from 'lucide-react'
import { apiErrorMessage } from '@/core/api'
import type { LoyaltyMember, SessionCustomer, SessionState } from '@/core/models/callcenter'
import Ltr from '@/core/ui/Ltr'
import { fsi } from '@/core/util/bidi'
import { callCenterApi } from './api'
import { barFields, OPEN_REQUESTS_SHORT, requestsChip } from './caller-bar'
import ChipSection from './ChipSection'
import type { LinkedCard, RequestOffer } from './linked-request'
import type { RailField } from './rail-view'
import SignupPanel, { type SignupActions } from './SignupPanel'
import { beginSignup, type SignupState } from './signup-view'

/**
 * The two customer verbs and their one shared outcome, as one prop. They travel
 * together (page → shell → bar) and are one act with two directions, so a single
 * `busy` and a single `error` is the honest shape — only one can be in flight.
 */
export interface CustomerActions {
  /** Binds the found member to the order (`attachCustomer`). The call, its
   *  `requestId` and the state it returns are the page's — the bar only knows who
   *  the agent chose. */
  onAttach: (member: LoyaltyMember) => void
  onRemove: () => void
  busy: boolean
  /** Whichever of the two last failed, in the server's own words. Drawn under the
   *  bar, in the flow, whichever state the bar is in. */
  error: string | null
}

/** The signup's state and its verbs, as one prop — 159. Absent means the console
 *  has no enrolment wired, and then it offers none. */
export interface CallerSignup {
  state: SignupState
  actions: SignupActions
}

/**
 * The caller's open sales requests, as one prop (194) — the count to volunteer, the
 * card once one is linked, and the way into the picker.
 *
 * 🚩 **Both are the page's derivations, not the bar's.** `requestOffer` and
 * `linkedCard` are read once, in the page, off the same `SessionState` the picker
 * gets — so the chip and the picker cannot disagree about whether this order has a
 * request on it. Absent means the console has no request surface wired.
 */
export interface CallerRequests {
  /** The count, or `null` for silence — a plain order gains no furniture. */
  offer: RequestOffer | null
  /** What this order converts, once it converts something. Replaces the count. */
  card: LinkedCard | null
  /** Opens the picker. 🚩 Nothing opens by itself: the agent is mid-greeting and a
   *  picker over the basket takes the call away from them. */
  onView: () => void
  /**
   * Asks whether to take the link back (195). 🚩 It opens the CONFIRMATION and never
   * the verb: unlink removes the copied lines. Absent means the act is not available
   * — a submitted order has no link left to take back.
   */
  onUnlink?: () => void
}

/** The bar's one row, the same height in both states (379 §1). */
const ROW = 'flex h-12 items-center gap-3 overflow-hidden border-b border-divider bg-card px-4'

export default function CallerBar({
  state,
  customerActions,
  signup,
  requests,
}: {
  state: SessionState
  customerActions: CustomerActions
  signup?: CallerSignup
  /** 194's surface. Absent ⇒ the bar says nothing about requests at all. */
  requests?: CallerRequests
}) {
  const { t } = useTranslation('callcenter')
  const customer = state.header.customer

  /**
   * The member the lookup found, kept after attach so the bar can carry the three
   * fields the session projection does not hold (tier, points, email).
   *
   * 🚩 Only ever used through `barFields`, which drops it when its `loyId` is not the
   * attached customer's — a member left over from a previous search decorates nobody.
   */
  const [found, setFound] = useState<LoyaltyMember | null>(null)
  const [mobile, setMobile] = useState('')
  /** WHICH linked request's detail is open, by its number — so an unlink and a later
   *  link of another request never inherit an open detail: nothing opens by itself. */
  const [showingRequest, setShowingRequest] = useState<string | null>(null)

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
   * 🚩 **Who the order holds is what the bar is about, so the search clears when
   * that changes** — in both directions. On remove, the last search left standing
   * would hand the agent the previous caller with a live *Attach* over a box still
   * holding their number; on attach, the found member has done its job. Keyed on
   * the identity rather than a boolean, so swapping one caller for another clears
   * it too.
   */
  const attachedId = customer?.customerId ?? null
  useEffect(() => {
    setMobile('')
    lookupRef.current.reset()
    setShowingRequest(null)
    // `found` deliberately survives an ATTACH — it is the enrichment the bar
    // carries — and is dropped the moment there is no caller to enrich.
    if (attachedId === null) setFound(null)
  }, [attachedId])

  /**
   * US9's caret, put in the phone box for **this order** — keyed on the transaction
   * id, so it fires again when the agent places one order and opens the next without
   * the console unmounting, and on the caller, so a remove brings it back. Guarded
   * on there being no caller: a resumed order that arrives with one attached is not
   * a call that starts by typing a number.
   */
  const phoneBox = useRef<HTMLInputElement | null>(null)
  const orderId = state.transactionId
  useEffect(() => {
    if (attachedId !== null) return
    phoneBox.current?.focus()
  }, [orderId, attachedId])

  const search = (event: React.FormEvent) => {
    event.preventDefault()
    const query = mobile.trim()
    if (!query || lookup.isPending) return
    lookup.mutate(query)
  }

  const chip = customer ? requestsChip(requests?.offer ?? null, requests?.card ?? null) : null
  const linked = chip?.kind === 'linked' ? chip.card : null
  // A created member's attach is the signup panel's to report, under its own button
  // (`signupError`) — so the bar does not say it a second time.
  const panelOwnsError = !customer && signup?.state.step === 'created'

  return (
    <div className="shrink-0" data-cc-caller-bar={customer ? 'attached' : 'lookup'}>
      {customer ? (
        <Attached
          customer={customer}
          member={found}
          actions={customerActions}
          linked={linked}
          openCount={chip?.kind === 'offer' ? chip.count : null}
          onViewRequests={requests?.onView}
          showingRequest={linked !== null && showingRequest === linked.documentNo}
          onToggleRequest={() =>
            setShowingRequest((open) => (linked && open !== linked.documentNo ? linked.documentNo : null))
          }
        />
      ) : (
        <div className={ROW} data-cc-caller-lookup>
          <label
            htmlFor="cc-phone"
            className="shrink-0 text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground"
          >
            {t('callerBar.caller')}
          </label>
          <form onSubmit={search} className="flex w-56 shrink-0 gap-1.5">
            <input
              id="cc-phone"
              // 🚩 US9. Put here by the effect above rather than by `autoFocus`,
              // because the second call of a shift mounts no new input.
              ref={phoneBox}
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
              inputMode="tel"
              autoComplete="off"
              placeholder={t('callerBar.mobilePlaceholder')}
              aria-label={t('callerBar.mobile')}
              data-numeric
              className="min-w-0 flex-1 rounded-md border border-input bg-card px-2.5 py-1.5 font-mono text-sm outline-none focus:border-ring"
            />
            <button
              type="submit"
              disabled={!mobile.trim() || lookup.isPending}
              data-cc-find
              aria-label={t('callerBar.find')}
              title={t('callerBar.find')}
              className="shrink-0 rounded-md border border-input px-2 hover:bg-accent disabled:opacity-40"
            >
              {lookup.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Search className="h-4 w-4" aria-hidden />
              )}
            </button>
          </form>

          {lookup.isError && (
            <span className="min-w-0 truncate text-xs text-danger-800" data-cc-lookup-error>
              {apiErrorMessage(lookup.error, t('callerBar.lookupFailed'))}
            </span>
          )}

          {lookup.isSuccess && lookup.data && (
            <Found member={lookup.data} actions={customerActions} />
          )}

          {/* A miss is an ordinary outcome of the first thing that happens on a call —
              said plainly, on no alarm ground, with the enrolment as the next
              ordinary thing rather than a recovery from a failure. */}
          {lookup.isSuccess && !lookup.data && (
            <div className="flex min-w-0 items-center gap-2" data-cc-lookup-miss>
              <span className="min-w-0 truncate text-xs text-muted-foreground" title={t('callerBar.notFound')}>
                {t('callerBar.notFound')}
              </span>
              {/* 🚩 Absent, not disabled: a bar with no signup wired offers no control. */}
              {signup && signup.state.step === 'closed' && (
                <button
                  type="button"
                  onClick={() => signup.actions.onChange(beginSignup(mobile.trim()))}
                  data-cc-signup-open
                  className="shrink-0 rounded-md border border-input px-2.5 py-1 text-xs font-medium hover:bg-accent"
                >
                  {t('callerBar.signUp')}
                </button>
              )}
            </div>
          )}

          {lookup.isIdle && (
            <span className="min-w-0 truncate text-[11px] text-muted-foreground">{t('callerBar.emptyHint')}</span>
          )}
        </div>
      )}

      {/* Whichever of attach/remove last failed, under the bar — never inside the
          one-line row, which would grow it. */}
      {customerActions.error && !panelOwnsError && (
        <p className="border-b border-divider bg-card px-4 py-1.5 text-xs text-danger-800" data-cc-customer-error>
          {customerActions.error}
        </p>
      )}

      {/* 🚩 159's signup, IN FLOW under the bar — never a modal. The wait between
          *Send code* and the code arriving is spoken, and a modal would take the
          basket away for the length of it. */}
      {!customer && signup && signup.state.step !== 'closed' && (
        // `flow-root`, so the panel's own top margin stays inside this block.
        <div className="flow-root border-b border-divider bg-card px-4 pb-3">
          <div className="max-w-md">
            <SignupPanel state={signup.state} actions={signup.actions} attaching={customerActions.busy} />
          </div>
        </div>
      )}

      {linked && (
        <LinkedRequestDetail
          card={linked}
          open={showingRequest === linked.documentNo}
          onClose={() => setShowingRequest(null)}
          onUnlink={requests?.onUnlink}
        />
      )}
    </div>
  )
}

/** Who the lookup found, inline in the bar, and the second of the two steps. */
function Found({ member, actions: { onAttach, busy } }: { member: LoyaltyMember; actions: CustomerActions }) {
  const { t } = useTranslation('callcenter')
  return (
    <div
      className="flex min-w-0 items-center gap-2 rounded-md border border-border bg-card-2 py-1 ps-2.5 pe-1"
      data-cc-lookup-found
    >
      {/* Server-supplied, passed through as data. */}
      <bdi className="min-w-0 truncate text-sm font-semibold">{member.fullName}</bdi>
      <span className="shrink-0 font-mono text-xs text-muted-foreground" data-numeric>
        <Ltr>{member.mobile}</Ltr>
      </span>
      <button
        type="button"
        onClick={() => onAttach(member)}
        disabled={busy}
        data-cc-attach
        className="shrink-0 rounded-md bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground disabled:opacity-50"
      >
        {busy ? t('callerBar.attaching') : t('callerBar.attach')}
      </button>
    </div>
  )
}

/**
 * The attached caller on one line: `barFields` in their fixed order, the requests
 * chip, and the icon-only ✕ at the inline end (379 §3).
 */
function Attached({
  customer,
  member,
  actions: { onRemove, busy },
  linked,
  openCount,
  onViewRequests,
  showingRequest,
  onToggleRequest,
}: {
  customer: SessionCustomer
  member: LoyaltyMember | null
  actions: CustomerActions
  linked: LinkedCard | null
  /** The open-request count to offer, or `null`. */
  openCount: number | null
  onViewRequests?: () => void
  showingRequest: boolean
  onToggleRequest: () => void
}) {
  const { t } = useTranslation('callcenter')
  return (
    <div className={ROW} data-cc-caller>
      {/* Everything but ✕, in one clipping cluster: whatever a long caller costs, the
          way to remove them is never pushed off the bar. */}
      <div className="flex min-w-0 flex-1 items-center gap-3 overflow-hidden">
        {barFields(customer, member).map((field) => (
          <BarField key={field.id} field={field} />
        ))}

        {linked && (
          <span
            className="inline-flex shrink-0 items-center gap-0.5 rounded-md border border-border bg-card-2 text-xs"
            data-cc-request-card
          >
            {/* 🚩 The chip opens the request's detail IN FLOW under the bar (379 §2) —
                never a tooltip, which keyboard and touch never see. */}
            <button
              type="button"
              onClick={onToggleRequest}
              aria-expanded={showingRequest}
              title={t('linkedRequest.show')}
              data-cc-request-chip
              className="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 hover:bg-accent"
            >
              <span className="text-muted-foreground">{t('linkedRequest.chip')}</span>
              <span className="font-mono font-semibold">
                <Ltr>{linked.documentNo}</Ltr>
              </span>
            </button>
            <RequestLink href={linked.href} marker={{ 'data-cc-request-chip-open': '' }} />
          </span>
        )}

        {!linked && openCount !== null && onViewRequests && (
          // 🚩 An unnoticed request is the failure 194 exists to prevent, so the bar
          // volunteers it — on attention ground — and opens 194's picker unchanged.
          <button
            type="button"
            onClick={onViewRequests}
            title={t('request.title')}
            data-cc-request-offer={String(openCount)}
            data-cc-request-view
            // Prose, so it reads in its own language's direction — an English key that
            // an Arabic locale falls back to keeps its count at its start (408's ruling
            // for the sentence).
            dir="auto"
            className="shrink-0 rounded-md border border-attention-border bg-attention-050 px-2 py-0.5 text-xs font-medium text-attention-800 hover:opacity-80"
          >
            <Trans t={t} ns="callcenter" i18nKey={OPEN_REQUESTS_SHORT} count={openCount} components={{ n: <Ltr /> }} />
          </button>
        )}
      </div>
      {/* 🚩 Removing the caller clears the address and KEEPS the derived store — both
          the server's doing (§6.3), arriving in the projection. */}
      <button
        type="button"
        onClick={onRemove}
        disabled={busy}
        data-cc-remove-caller
        aria-label={t('callerBar.remove')}
        title={t('callerBar.remove')}
        className="shrink-0 rounded-full border border-input p-1 text-muted-foreground hover:bg-accent disabled:opacity-50"
      >
        {busy ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden /> : <X className="h-3 w-3" aria-hidden />}
      </button>
    </div>
  )
}

/**
 * One of the caller's fields. Points and member carry their label on screen, as 379's
 * capture draws them; the rest say who they are to a screen reader only.
 *
 * Bidi (C7, 359): the name and the tier are free text in `<bdi>`; the mobile and the
 * member id are machine values in `Ltr` and mono; points are a quantity, so `Ltr` in
 * sans. Every value is server-supplied, passed through as data.
 *
 * 🚩 One line at 1280 means something gives on a long caller: the email, which is the
 * only field that shrinks; the name never shrinks and clamps only past 16rem. Each
 * clamps on its OWN isolate, so the ellipsis lands at the value's end in either script
 * — clamped from outside, an Arabic name under LTR (or an email under RTL) would lose
 * its first letters instead.
 */
function BarField({ field }: { field: RailField }) {
  const { t } = useTranslation('callcenter')
  const label = t(`callerBar.field.${field.id}`)
  const handle = { 'data-cc-rail-field': field.id }
  switch (field.id) {
    case 'name':
      return (
        <span {...handle} className="flex min-w-0 max-w-[16rem] shrink-0 text-[15px] font-semibold leading-tight">
          <span className="sr-only">{label} </span>
          <bdi className="min-w-0 truncate">{field.value}</bdi>
        </span>
      )
    case 'tier':
      return (
        <span
          {...handle}
          className="inline-flex shrink-0 items-center gap-1 rounded-full bg-attention-050 px-2 py-px text-[11px] font-semibold text-attention-800"
        >
          <Star className="h-3 w-3" aria-hidden />
          <span className="sr-only">{label} </span>
          <bdi>{field.value}</bdi>
        </span>
      )
    case 'points':
      return (
        <span {...handle} className="shrink-0 text-xs text-muted-foreground">
          {label}{' '}
          <span className="text-foreground">
            <Ltr>{field.value}</Ltr>
          </span>
        </span>
      )
    case 'member':
      return (
        <span {...handle} className="shrink-0 text-xs text-muted-foreground" data-numeric>
          {label}{' '}
          <span className="font-mono text-foreground">
            <Ltr>{field.value}</Ltr>
          </span>
        </span>
      )
    case 'mobile':
      return (
        <span {...handle} className="shrink-0 font-mono text-xs" data-numeric>
          <span className="sr-only">{label} </span>
          <Ltr>{field.value}</Ltr>
        </span>
      )
    case 'email':
      return (
        <span {...handle} className="flex min-w-0 text-xs text-muted-foreground">
          <span className="sr-only">{label} </span>
          {/* `dir` makes the clamp's own direction left-to-right, so the ellipsis is at
              the address's end under RTL too. */}
          <span dir="ltr" className="min-w-0 truncate">
            <Ltr>{field.value}</Ltr>
          </span>
        </span>
      )
  }
}

/** The ↗ to the request's own screen, in a new tab: the call keeps its console. */
function RequestLink({
  href,
  marker,
  withText = false,
}: {
  href: string
  /** The drive's handle — the chip's ↗ and the detail's are two places. */
  marker: Record<string, string>
  /** Spelled out in the detail; icon-only on the one-line chip. */
  withText?: boolean
}) {
  const { t } = useTranslation('callcenter')
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      {...marker}
      aria-label={withText ? undefined : t('request.openDocument')}
      title={t('request.openDocument')}
      className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-xs text-muted-foreground hover:text-foreground"
    >
      <ExternalLink className="h-3 w-3" aria-hidden />
      {withText && t('request.openDocument')}
    </a>
  )
}

/**
 * What the linked request is, opened from its chip IN THE FLOW under the bar (379 §2,
 * 175 §9's idiom — the same `ChipSection` a sentence word opens, so Esc closes it and
 * focus returns to the chip): the reason, the store it was raised at, the pharmacist's
 * note, the ↗, and **Unlink**, which opens 195's confirmation unchanged.
 *
 * ⚠ Not prototyped (379): drawn at build from the bar's and the sign-up's idiom; the
 * owner signs it off at S6.
 *
 * 🚩 **No money on it at all.** The request is unpriced; the basket and the receipt
 * are where this order's money lives.
 */
function LinkedRequestDetail({
  card,
  open,
  onClose,
  onUnlink,
}: {
  card: LinkedCard
  open: boolean
  onClose: () => void
  onUnlink?: () => void
}) {
  const { t } = useTranslation('callcenter')
  return (
    <ChipSection
      open={open}
      onClose={onClose}
      // A title is a string-only sink, so the number is isolated with `fsi`.
      title={t('linkedRequest.detail.title', { documentNo: fsi(card.documentNo) })}
      name="linked-request"
      width="36rem"
      footer={
        <>
          <RequestLink href={card.href} marker={{ 'data-cc-request-card-open': '' }} withText />
          {/* 🚩 The way back out, and the only one: one order converts at most one
              request. It asks before it empties anything (195). */}
          {onUnlink && (
            <button
              type="button"
              onClick={onUnlink}
              data-cc-request-unlink
              className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              {t('request.unlink.action')}
            </button>
          )}
        </>
      }
    >
      <dl className="grid grid-cols-[max-content_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-xs" data-cc-request-detail>
        {/* The reason in words, or nothing — never the code (880 §3). */}
        {card.reason && (
          <>
            <dt className="text-muted-foreground">{t('linkedRequest.detail.reason')}</dt>
            <dd data-cc-request-card-reason>
              <bdi>{card.reason}</bdi>
            </dd>
          </>
        )}
        <dt className="text-muted-foreground">{t('linkedRequest.detail.raisedAt')}</dt>
        <dd className="font-mono" data-cc-request-card-store>
          <Ltr>{card.storeCode}</Ltr>
        </dd>
        {/* The pharmacist's own words, shown and copied nowhere (880 §4.4). */}
        {card.note && (
          <>
            <dt className="text-muted-foreground">{t('linkedRequest.detail.note')}</dt>
            <dd className="whitespace-pre-wrap" data-cc-request-card-note>
              <bdi>{card.note}</bdi>
            </dd>
          </>
        )}
      </dl>
    </ChipSection>
  )
}
