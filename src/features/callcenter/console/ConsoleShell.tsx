/**
 * The console's spatial contract, rendered from the server's own projection.
 *
 * 135's ruling (variant A, "three fixed columns"): the customer rail at the
 * start edge and the live receipt at the end edge **never move**, and the centre
 * column is the only region that grows — chip row → item search → basket →
 * offer strip, in that vertical order. The furniture is at the same pixels at
 * hour nine as at hour one, which is the one property a twelve-hour shift
 * rewards.
 *
 * Slice 0 renders what an empty order actually has, and nothing it does not:
 * every value below comes off `SessionState`. There is no client-computed total
 * (law 1 / §2.1 — the console never sums lines), no hand-made placeholder, and
 * no control enabled by a client-side predicate: *Place order* is live only
 * because `capabilities.canSubmit` said so (the page reads it and passes the
 * handler, as it does for every other capability-gated control), and the reason
 * under a dead one is `submitBlockers`, the server's own list.
 *
 * Ticket 165 fills the first of those columns: the rail is now the call's
 * opening move rather than furniture (see `CustomerRail.tsx`). The rest — item
 * search, the basket's own verbs, the guidance strip — arrive with tickets
 * 166–172, in the centre column that is the only region that grows.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2, RefreshCw, X } from 'lucide-react'
import type { SessionState } from '@/core/models/callcenter'
import Ltr from '@/core/ui/Ltr'
import { formatMoney } from '@/core/util/number-format'
import BasketPanel, { type BasketActions } from './BasketPanel'
import { receiptView, type DeliveryFeeView } from './basket-view'
import CommandPalette from './CommandPalette'
import { paletteRows } from './palette-model'
import { capabilityGate, feeLine, showsDeliveryRegion } from './fulfilment-view'
import BusyStrip, { type BusyPhase } from './BusyStrip'
import CustomerRail, {
  type CustomerActions,
  type RailRequests,
  type RailSignup,
} from './CustomerRail'
import GuidanceStrip, { type GuidanceActions } from './GuidanceStrip'
import { guidanceView } from './guidance-view'
import { headerChips, type HeaderChip } from './header-chips'
import type { LinkReport, RequestGone, SkippedRow } from './linked-request'
import ItemSearchPanel, { type AddItemActions } from './ItemSearchPanel'
import Money from './Money'
import type { RebindRefusal } from './store-move'
import { submitBlockers } from './submit-blockers'
import { submitRefusalChip, type SubmitFailure, type SubmitOutcome } from './submit-outcome'

/**
 * *Place order* and everything it can answer (174). The call itself is the
 * page's, like every other verb — what travels down here is the request to
 * place, what it is currently doing, and what it last said.
 */
export interface SubmitActions {
  /** Absent once the order is no longer open: a placed order has nothing to
   *  place, and a control that would be refused is worse than no control. */
  onPlace?: () => void
  /** 🚩 In flight. The receipt HOLDS while this is true — no optimistic
   *  hand-off, because a confirmed order that then refuses is a phone call the
   *  agent cannot take back. */
  placing: boolean
  /** The order number, once one exists. The only thing that ends the wait. */
  outcome: SubmitOutcome | null
  failure: SubmitFailure | null
  /**
   * 🚩 The request went away under the agent (195) — `REQUEST_ALREADY_CONVERTED`,
   * the one refusal on this verb that is answered by an act rather than by a fix
   * on the order. It rides beside `failure` rather than inside it because the
   * fact is not the submit's: it is read off the order's own link
   * (`submitRefusal`), which is also what makes it disappear the moment the
   * agent unlinks.
   */
  requestGone?: RequestGone | null
  /** Opens the unlink CONFIRMATION — the same one the rail's card opens, because
   *  it is the same act with the same cost. Absent ⇒ no escape is drawn and the
   *  server's own sentence stands alone. */
  onUnlink?: () => void
}

/**
 * The skipped-line report and the one act it offers (194).
 *
 * 🚩 **`onAddAnyway` is the console's ORDINARY add**, not a second path: it mints
 * an `addItem` for the item and quantity the copy refused to guess at, and the
 * server answers with the same `belowAtp` confirmation any typed add would raise.
 * A below-ATP line may never arrive already added — `HasBelowAtp` is a fraud
 * signal and a flag nobody saw proves nothing — so the agent's press is the whole
 * point.
 */
export interface RequestReportActions {
  report: LinkReport | null
  /** Absent ⇒ the door will not accept an add (a shut item gate, a closed order),
   *  and then the rows are drawn without a handle rather than with a dead one. */
  onAddAnyway?: (row: SkippedRow) => void
  onDismiss?: () => void
}

export default function ConsoleShell({
  state,
  onAbandon,
  onRefresh,
  refreshing = false,
  busy = null,
  customerActions,
  addItem,
  guidance: guidanceActions,
  searchScope = null,
  onClearSearchScope,
  lineEdit,
  onPickAddress,
  onChangeStore,
  onChangeSlot,
  onChangeSource,
  onChangeFulfilment,
  onChangePayment,
  onChangeCoupon,
  onChangeNote,
  signup,
  requests,
  requestReport = null,
  refusal = null,
  onDismissRefusal,
  swallowed = null,
  onDismissSwallowed,
  submit,
}: {
  state: SessionState
  /** Opens the abandon confirmation (163). Absent ⇒ there is nothing to void. */
  onAbandon?: () => void
  /** Re-reads the order (`getState`) — §6.1's *universal recovery action after
   *  any conflict*, and the one verb on this screen that is safe to press twice. */
  onRefresh?: () => void
  refreshing?: boolean
  /** A claim collision being ridden out, or the spent schedule (164). */
  busy?: BusyPhase | null
  /** The two customer verbs and their outcome (165), passed through to the rail.
   *  They are the page's because they return the whole `SessionState`, and the
   *  cache is the store of record. */
  customerActions: CustomerActions
  /** `addItem` and its outcome (168), passed through to the search panel — the
   *  page's for the same reason as every other verb: it returns the whole
   *  `SessionState`. */
  addItem: AddItemActions
  /** The one-click add from a guidance card, and what the engine did with it
   *  (172). The page's for the same reason as every other verb — `addItem`
   *  returns the whole `SessionState`. */
  guidance: GuidanceActions
  /**
   * The offer the item search is currently narrowed to (172's hand-off), or
   * `null`. It is the page's state rather than the panel's because the request
   * to narrow comes from the guidance strip, at the other end of the column —
   * `Search the other 994` must not become a second list.
   */
  searchScope?: { offerId: string; description: string } | null
  onClearSearchScope?: () => void
  /** The basket's own three verbs (170) — quantity, unit of measure, void. The
   *  page's for the same reason as every other verb: each returns the whole
   *  `SessionState`. `null` once the order is no longer open. */
  lineEdit: BasketActions | null
  /** Opens the address book (166). The dialog and the `setAddress` verb are the
   *  page's — it returns the whole `SessionState` — so all that travels down
   *  here is the request to open it. */
  onPickAddress?: () => void
  /** Opens the deliberate store override (167) — the store chip re-opening the
   *  section it collapsed. Absent while `capabilities.canChangeStore` is false,
   *  so the chip is a chip rather than a control that refuses. */
  onChangeStore?: () => void
  /** Opens the slot picker (173) — the slot chip re-opening its own section.
   *  Absent once the order is no longer open, so a settled chip stops being a
   *  control the door would refuse. */
  onChangeSlot?: () => void
  /** Opens the source + reference form (173). ONE handler for the two chips:
   *  they collapse two fields of one section, and a reference belongs to the
   *  source it references. */
  onChangeSource?: () => void
  /** Opens the fulfilment choice (176) — *delivering, or collecting?*. Absent
   *  once the order is no longer open; the SHUT-GATE case is handled inside the
   *  chip row off `capabilities`, because a delivery-only source is a different
   *  fact from a closed order and says a different sentence. */
  onChangeFulfilment?: () => void
  /** Opens the coupon modal (159) — the last chip in the row. Absent once the
   *  order is no longer open; the SHUT-APPLY case lives inside the modal, which
   *  still has an applied list to show and a reason to give. */
  onChangeCoupon?: () => void
  /** Opens the order note (183) — the note chip re-opening its own section.
   *  Absent once the order is no longer open: a submitted order has no header
   *  left to capture, and a control the door would refuse is worse than none. */
  onChangeNote?: () => void
  /** The loyalty signup (159), passed through to the rail. Absent ⇒ the rail
   *  offers no enrolment at all. */
  signup?: RailSignup
  /** The caller's open sales requests (194), passed through to the rail. Absent
   *  ⇒ the rail says nothing about requests at all. */
  requests?: RailRequests
  /**
   * What the copy did NOT put on the order (194) — the interesting half of a link.
   *
   * Console-wide rather than inside the picker, for the same reason `swallowed` is:
   * the picker has closed by the time the agent works through these rows, and one
   * of them raises the below-availability acceptance sheet — a second `<dialog>`
   * over an open one would be two truths on one screen.
   */
  requestReport?: RequestReportActions | null
  /** Opens the payment choice (155). Absent while `canChangePaymentType` is
   *  false, which no phase-1 order reaches — the chip is then settled and
   *  non-interactive, carrying its reason. */
  onChangePayment?: () => void
  /** `REBIND_REFUSED` — atomic, so nothing was persisted (167). It is drawn in
   *  TWO places on purpose: named in the banner and tinted on the line, so
   *  "nothing was changed, fix this line" is legible in one glance. */
  refusal?: RebindRefusal | null
  onDismissRefusal?: () => void
  /** 🚩 An acceptance the server swallowed as a replay (177 / BackOffice 858) —
   *  which of the two two-phase verbs it was, or `null`. Console-wide rather than
   *  per-surface, because by the time it is known the sheet the agent answered has
   *  closed and the panel they were in may have too: the one thing that must not
   *  happen is the agent walking away believing it applied. */
  swallowed?: SwallowedCommit | null
  onDismissSwallowed?: () => void
  /** *Place order* and what it last answered (174) — the page's, like every
   *  other verb, because the outcome is a real OMS order and the cache is the
   *  store of record. */
  submit: SubmitActions
}) {
  // The lines the refusal named, for the tint. A Set because the basket asks per
  // line and a refusal can name several.
  const refusedLines = new Set((refusal?.lines ?? []).map((line) => line.lineId))
  // Read ONCE, here: the strip draws it, the top bar mirrors its count (US51)
  // and the palette lists it (192), and two reads would be two chances for them
  // to disagree about what is actionable.
  const guidance = guidanceView(state.nearMisses)
  const palette = usePalette()
  return (
    <div
      className="flex h-screen flex-col overflow-hidden bg-background text-foreground"
      data-cc-console
      // WHICH order is on screen, for the drives. Not rendered text — a
      // 26-character ULID is nothing an agent reads — but "the order you landed
      // on is not the one you abandoned" is otherwise only provable by its
      // emptiness, which any other empty order would also satisfy.
      data-cc-transaction={state.transactionId}
    >
      <TopBar
        state={state}
        actionableOffers={guidance.actionableCount}
        onAbandon={onAbandon}
        onRefresh={onRefresh}
        refreshing={refreshing}
      />
      {/* 🚩 In the flow, above the columns — never over them. A collision is
          routine (law 7), so it costs the basket no interactivity and the strip
          no pixels it does not need. */}
      <BusyStrip busy={busy} />
      {/* 🚩 A refusal is a banner, not a crash surface — in the flow, above the
          columns, over an order that is exactly as the agent left it. */}
      <RebindBanner refusal={refusal} onDismiss={onDismissRefusal} />
      {/* The same slot, the same shape: something the agent has to read once
          about an order that is otherwise fine. */}
      <SwallowedBanner kind={swallowed} onDismiss={onDismissSwallowed} />
      {/* The same slot again (194): the lines the link did not copy, over an order
          that is otherwise exactly what the agent asked for. */}
      <RequestReportBanner actions={requestReport} />
      {/* 1440×900 by design, degrading to 1280; below that is out of scope —
          it is a desktop console (135's density budget). */}
      <div className="grid min-h-0 flex-1 grid-cols-[260px_minmax(0,1fr)_320px]">
        <CustomerRail state={state} customerActions={customerActions}
            signup={signup} requests={requests} onPickAddress={onPickAddress} />
        <main className="flex min-h-0 min-w-0 flex-col border-x border-border">
          <ChipRow
            state={state}
            onChangeStore={onChangeStore}
            onChangeSlot={onChangeSlot}
            onChangeSource={onChangeSource}
            onChangeFulfilment={onChangeFulfilment}
            onChangePayment={onChangePayment}
            onChangeCoupon={onChangeCoupon}
            onChangeNote={onChangeNote}
          />
          {/* 135's fixed vertical order — chip row → item search → basket. The
              search is above the basket because that is the direction the work
              runs in: what the agent finds lands underneath it. */}
          <ItemSearchPanel
            state={state}
            add={addItem}
            scope={searchScope}
            onClearScope={onClearSearchScope}
          />
          <BasketPanel state={state} refusedLines={refusedLines} actions={lineEdit} />
          {/* Last in the fixed vertical order (135), UNDER the basket it is
              about — the offers the basket nearly qualifies for (171), and the
              one-click add that closes their gap (172). */}
          <GuidanceStrip view={guidance} transactionId={state.transactionId} actions={guidanceActions} />
        </main>
        <Receipt state={state} submit={submit} />
      </div>
      {/* 🚩 One key reaches everything the order can do (192) — and every row it
          runs is a handler this shell was ALREADY given. Nothing here is a new
          route to a verb: an act the page withheld (a shut capability, a closed
          order) arrives as a missing handler and the palette draws it disabled
          with its reason, which is the one place on this console a refused
          control is drawn rather than withheld. */}
      <CommandPalette
        open={palette.open}
        onClose={palette.close}
        returnFocus={palette.returnFocus}
        rows={paletteRows({
          guidance,
          capabilities: state.capabilities,
          hasCaller: state.header.customer != null,
          actions: {
            verbs: {
              // The way home for focus stranded on a chip — and the box the
              // agent lives in. Both targets are addressed by their stable id
              // rather than by a ref threaded through two sibling components:
              // the palette does not own either box, and one row is not worth
              // two more props on two more components.
              searchItems: () => focusBox('cc-item-search'),
              addressBook: onPickAddress,
              changeStore: onChangeStore,
              slot: onChangeSlot,
              source: onChangeSource,
              note: onChangeNote,
              // 🚩 The SAME gate the chip row applies, from the same function on
              // the same state — so a chip that stopped being a control cannot
              // be a live palette row.
              fulfilment: capabilityGate(state.capabilities, 'canChangeFulfilment').open
                ? onChangeFulfilment
                : undefined,
              payment: capabilityGate(state.capabilities, 'canChangePaymentType').open
                ? onChangePayment
                : undefined,
              coupon: onChangeCoupon,
              attachCaller: () => focusBox('cc-phone'),
                // The rail's own gate, mirrored: a removal in flight withdraws
              // the control there, and a palette row that ignored it would be a
              // second `removeCustomer` on one caller.
              removeCaller: customerActions.busy ? null : customerActions.onRemove,
              refresh: onRefresh,
            },
            // 🚩 Dead while it is running, exactly as the receipt's own button
            // is: one press is one action, on the verb that mints a real order.
            place: submit.placing ? null : submit.onPlace,
            abandon: onAbandon,
            // The offer strip's keyboard path: narrow the item search to the
            // offer and land the caret in the box — 172's own hand-off, never a
            // second add route.
            onOffer: guidanceActions.onSearchRest,
          },
        })}
      />
    </div>
  )
}

/** The two boxes a palette row hands focus back to. */
function focusBox(id: string) {
  document.getElementById(id)?.focus()
}

/**
 * `Ctrl+K` / `Cmd+K`, and the two rules that make it safe.
 *
 * 🚩 **It must `preventDefault()`** — it is Chrome's omnibox-search key and *is*
 * interceptable (Linear, Slack and GitHub all take it), so without this the
 * agent's hands leave the console mid-call.
 *
 * 🚩 **It is inert while any `<dialog>` is open** — a palette over a
 * confirmation sheet is two truths on one screen, and the sheet is a decision the
 * agent has been asked to make. A native modal makes the content behind it inert
 * but a document `keydown` still fires, so the guard is explicit. It also makes
 * the key a no-op over the palette itself, which is what stops `Ctrl+K` becoming
 * a toggle that re-opens a fresh query over the agent's own.
 *
 * The listener is document-level and mounted with the console, because the key
 * must work **from inside any text box** — this console's resting focus is a
 * text box twice over (the phone field at open, the search box after that), so a
 * grammar gated on *not typing* would almost never be armed (153).
 */
function usePalette() {
  const [open, setOpen] = useState(false)
  /**
   * 🚩 Where the caret was **at the moment of the press** — the way home, and
   * the only moment the answer exists. By the time the palette has rendered, its
   * own box has the caret, so nothing downstream can work this out.
   */
  const cameFrom = useRef<HTMLElement | null>(null)
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'k' && event.key !== 'K') return
      if (!event.ctrlKey && !event.metaKey) return
      // 🚩 Prevented BEFORE the inert check, never after. *Inert* means this
      // console does nothing — it must not mean Chrome does something: left to
      // its default the key puts the caret in the omnibox, so an agent whose
      // hand reaches for it over an open confirmation sheet would leave the
      // application entirely, which is worse than the palette they asked for.
      event.preventDefault()
      if (document.querySelector('dialog[open]')) return
      cameFrom.current = document.activeElement as HTMLElement | null
      setOpen(true)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])
  // Stable, because it is a dependency of the palette's own open/close effect —
  // a fresh closure per render would re-run it on every keystroke.
  const returnFocus = useCallback(() => cameFrom.current?.focus?.(), [])
  // 🚩 A placed order keeps its palette, and nothing here closes it on status.
  // Every act such an order can no longer do is already a disabled row carrying
  // the server's own reason — including *Place order*, whose reason is
  // `ALREADY_SUBMITTED` — and *Refresh* still works. A rule here would be this
  // hook saying worse what the rows already say.
  return { open, close: () => setOpen(false), returnFocus }
}

function TopBar({
  state,
  actionableOffers,
  onAbandon,
  onRefresh,
  refreshing,
}: {
  state: SessionState
  /** How many offers are within reach — the strip's own count, mirrored (US51).
   *  A count rather than the view: the strip is the surface, and a top bar
   *  holding the whole model is a top bar that could disagree with it. */
  actionableOffers: number
  onAbandon?: () => void
  onRefresh?: () => void
  refreshing?: boolean
}) {
  const { t } = useTranslation('callcenter')
  return (
    <header className="flex h-11 shrink-0 items-center justify-between border-b border-border-strong bg-card px-4">
      <div className="flex items-center gap-3">
        <span className="text-sm font-semibold">{t('console.title')}</span>
        {/* Server-supplied, passed through as data: the document type is the
            engine's word for this order, not a label the console chooses. */}
        <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground" data-cc-doctype>
          {state.header.documentType}
        </span>
      </div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {/* 🚩 US51 — an offer that arrives while the agent is reading search
            results announces itself HERE, so guidance is not something they have
            to remember to look at. It is the strip's own count, read once. */}
        {actionableOffers > 0 && (
          <span
            data-cc-guidance-count={actionableOffers}
            className="rounded-full border border-primary-border bg-primary-050 px-2 py-0.5 text-[11px] font-medium text-primary-800"
          >
            {t('guidance.topCount', { count: actionableOffers })}
          </span>
        )}
        {/* ABSENT, NOT BLANK (156/176's rule, and 183's: blank in any form reads
            *unset*). `entryStore` is the AUDIT stamp — where the order was entered —
            and it is legitimately NULL for a till-less HQ agent, which is precisely
            who this console is for. Rendering the label anyway prints a bare
            "Store " with nothing after it, which reads as a value that failed to
            load rather than one that correctly does not exist. */}
        {state.header.entryStore ? (
          <>
            <span>{t('console.store', { store: state.header.entryStore })}</span>
            <span aria-hidden>·</span>
          </>
        ) : null}
        <span data-cc-operator>{state.header.operatorId}</span>
        {onRefresh && (
          // `getState` is the console's recovery verb (law 2, §6.1: *the
          // universal recovery action after any conflict*) and this is the
          // agent's hand on it — after a collision, a second tab, or simply a
          // doubt. It is a pure read, so pressing it twice costs nothing.
          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshing}
            data-cc-refresh
            aria-label={t('console.refresh')}
            title={t('console.refresh')}
            className="ms-2 rounded-full border border-input px-2 py-1 hover:bg-accent disabled:opacity-50"
          >
            <RefreshCw className={`h-3 w-3 ${refreshing ? 'animate-spin' : ''}`} aria-hidden />
          </button>
        )}
        {onAbandon && (
          // Quiet by design and set apart from the receipt's *Place order*: the
          // two terminal acts of a call must not sit side by side. It is the
          // only destructive control on the screen, and it never voids anything
          // on its own — the confirmation names what is thrown away first (US6).
          <button
            type="button"
            onClick={onAbandon}
            data-cc-abandon
            className="ms-2 rounded-full border border-danger-border px-2.5 py-0.5 text-[11px] font-medium text-danger-800 hover:bg-danger-050"
          >
            {t('abandon.action')}
          </button>
        )}
      </div>
    </header>
  )
}

function ChipRow({
  state,
  onChangeStore,
  onChangeSlot,
  onChangeSource,
  onChangeFulfilment,
  onChangePayment,
  onChangeCoupon,
  onChangeNote,
}: {
  state: SessionState
  onChangeStore?: () => void
  onChangeSlot?: () => void
  onChangeSource?: () => void
  onChangeFulfilment?: () => void
  onChangePayment?: () => void
  onChangeCoupon?: () => void
  onChangeNote?: () => void
}) {
  const { t } = useTranslation('callcenter')
  const chips = headerChips(state.header, state.capabilities)
  const gate = capabilityGate(state.capabilities, 'canChangeFulfilment')
  const payGate = capabilityGate(state.capabilities, 'canChangePaymentType')
  // 🚩 135's progressive collapse, complete at 173: every chip now re-opens the
  // section it collapsed. Source and reference share one — they are two fields
  // of one act, and a reference belongs to the source it references.
  const opener: Record<HeaderChip['id'], (() => void) | undefined> = {
    // 🚩 A shut gate passes NO handler: a delivery-only source means the door
    // will refuse `setFulfilment`, and the console's standing rule is that a
    // control the door would refuse is worse than no control. The chip stays —
    // the order still HAS a mode — and its reason is drawn beside the row.
    fulfilment: gate.open ? onChangeFulfilment : undefined,
    store: onChangeStore,
    slot: onChangeSlot,
    source: onChangeSource,
    reference: onChangeSource,
    payment: payGate.open ? onChangePayment : undefined,
    // 🚩 The coupon chip opens WHATEVER `canApplyCoupon` says, unlike its two
    // neighbours. A shut apply-gate is not a shut chip: the order may already
    // hold a coupon the agent needs to read out, and the modal is where the
    // reason for the shut gate is stated. There is nothing to say beside the
    // row, so nothing is said there.
    coupon: onChangeCoupon,
    // 🚩 The note has no capability of its own either (§2 lists none) and no
    // blocker can mark it: it opens whenever the order is still open, which is
    // the page's rule, and shuts with it.
    note: onChangeNote,
  }
  const lapsed = chips.some((chip) => chip.lapsed)
  return (
    <div className="border-b border-divider bg-card px-4 py-2" data-cc-chips>
      <div className="flex flex-wrap items-center gap-2">
        {chips.map((chip) => (
          <Chip key={chip.id} chip={chip} onOpen={opener[chip.id]} />
        ))}
      </div>
      {/* 🚩 The soft gate, said out loud (US19): the window the order holds has
          lapsed, and the order can still be placed. It is a warning in the flow
          — never a blocker, and never a modal that stops the call. */}
      {lapsed && (
        <p className="mt-1.5 text-[11px] text-attention-800" data-cc-slot-lapsed>
          {t('slot.lapsedWarning')}
        </p>
      )}
      {/* 🚩 A chip that stopped being a control says why, once, beside the row —
          the same posture 153 took for a refused palette row: an unexplained
          dead control teaches the agent nothing, and *this order's source is
          delivery-only* is a sentence they can repeat to a caller. The reason
          is the SERVER'S typed code (`capabilityReasons`), worded here; an
          unknown code falls back to the general phrase rather than to silence. */}
      {!gate.open && (
        <p className="mt-1.5 text-[11px] text-muted-foreground" data-cc-fulfilment-locked={gate.reason ?? ''}>
          {t(gate.reason ? `fulfilment.locked.${gate.reason}` : 'fulfilment.locked.unknown', {
            defaultValue: t('fulfilment.locked.unknown'),
          })}
        </p>
      )}
      {/* ⚠ Unreachable in phase 1 and implemented anyway (§2.4): a capability
          the client ignores is exactly the failure §2's advisory-but-
          authoritative rule exists to prevent. */}
      {!payGate.open && (
        <p className="mt-1.5 text-[11px] text-muted-foreground" data-cc-payment-locked={payGate.reason ?? ''}>
          {t(payGate.reason ? `payment.locked.${payGate.reason}` : 'payment.locked.unknown', {
            defaultValue: t('payment.locked.unknown'),
          })}
        </p>
      )}
    </div>
  )
}

function Chip({ chip, onOpen }: { chip: HeaderChip; onOpen?: () => void }) {
  const { t } = useTranslation('callcenter')
  const tone =
    chip.state === 'needsAttention'
      ? 'border-attention-border bg-attention-050 text-attention-800'
      : chip.state === 'settled'
        ? 'border-border bg-muted text-foreground'
        : 'border-dashed border-input bg-card text-muted-foreground'
  const body = (
    <>
      <span className="text-[10px] uppercase tracking-wide opacity-70">{t(`chips.${chip.id}`)}</span>
      {/* A key for the two enumerated chips (fulfilment, payment) — the wire's
          `PickInStore` and `CashOnDelivery` are values, not sentences — and
          server-supplied text passed through as data for every other. */}
      {/* 🚩 Clamped for EVERY chip, because one of them is now free text (183):
          the note's column is `NVARCHAR(MAX)` and a note of any length must not
          push the chips that matter off the row. One rule rather than a note-only
          exception — a store name long enough to do the same damage would
          otherwise be a second bug waiting for a long branch name. The text is
          intact in the DOM: this is a rendering limit, never a truncation of what
          the order holds. */}
      <span className="max-w-[16rem] truncate font-medium">
        {chip.valueKey ? t(`chips.value.${chip.valueKey}`) : (chip.value ?? t('chips.notSet'))}
      </span>
      {chip.derived && <span className="text-[10px] opacity-60">({t('chips.derived')})</span>}
      {/* 🚩 The chip stays *settled* — the order holds this window — and only
          says that it has lapsed. Attention ground is the server's to grant, off
          `submitBlockers`, and a soft gate never earns it. */}
      {chip.lapsed && (
        <span className="text-[10px] font-medium text-attention-800" data-cc-chip-lapsed>
          ({t('chips.lapsed')})
        </span>
      )}
    </>
  )
  const shape = `inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs ${tone}`

  // A chip with nowhere to go is not a control. `capabilities` decides that —
  // the page passes the handler only while the door will accept the change —
  // so a disabled button the agent can reach for never appears here.
  if (!onOpen)
    return (
      <span className={shape} data-cc-chip={chip.id} data-cc-chip-state={chip.state}>
        {body}
      </span>
    )

  return (
    <button
      type="button"
      onClick={onOpen}
      className={`${shape} hover:bg-accent`}
      data-cc-chip={chip.id}
      data-cc-chip-state={chip.state}
      data-cc-chip-open={chip.id}
      aria-label={t(`chips.change.${chip.id}`)}
      title={t(`chips.change.${chip.id}`)}
    >
      {body}
    </button>
  )
}

/** Which two-phase verb's acceptance was swallowed (858). */
export type SwallowedCommit = 'belowAtp' | 'storeChange'

/**
 * 🚩 **The acceptance that did nothing** (177, BackOffice 858).
 *
 * The agent accepted a below-availability add or a store move, the server
 * answered `200` — and answered it as a `requestId` REPLAY, so the commit never
 * reached the engine. Nothing changed. The console cannot fix that; what it must
 * not do is stay silent, because silence here is the one outcome that sends an
 * agent on to quote a figure for a basket that did not move.
 *
 * It offers no retry on purpose: the same id would be swallowed identically, and
 * a fresh one would be a genuinely new action against a real basket. What it
 * offers is the truth and a dismissal — the order itself is intact.
 *
 * It disappears on its own when 858 lands: a commit that applies is not a replay.
 */
function SwallowedBanner({
  kind,
  onDismiss,
}: {
  kind: SwallowedCommit | null
  onDismiss?: () => void
}) {
  const { t } = useTranslation('callcenter')
  if (!kind) return null
  return (
    <ConsoleBanner
      tone="attention"
      marker={{ 'data-cc-swallowed': kind }}
      dismissMarker={{ 'data-cc-swallowed-dismiss': '' }}
      onDismiss={onDismiss}
    >
      <div className="text-sm font-medium text-attention-800">{t(`swallowed.${kind}`)}</div>
      <div className="mt-0.5 text-[11px] text-attention-800/80">{t('swallowed.hint')}</div>
    </ConsoleBanner>
  )
}

/**
 * The lines the link did not copy (194) — the interesting half of a link, drawn
 * where the agent cannot miss it.
 *
 * 🚩 **Two kinds of row, two different offers.** A below-ATP row states the two
 * figures and offers the ordinary *add anyway*; a refused row states the server's
 * own code and offers nothing, because a refusal is not something an agent can
 * accept their way past. Which kind a row is belongs to `linked-request.ts`.
 *
 * Nothing is drawn when every line landed: the linked card is then the whole news.
 */
function RequestReportBanner({ actions }: { actions: RequestReportActions | null }) {
  const { t } = useTranslation('callcenter')
  const rows = actions?.report?.skipped ?? []
  if (!actions?.report || rows.length === 0) return null
  return (
    <ConsoleBanner
      tone="attention"
      marker={{ 'data-cc-request-report': String(rows.length) }}
      dismissMarker={{ 'data-cc-request-report-dismiss': '' }}
      onDismiss={actions.onDismiss}
    >
      <div className="text-sm font-medium text-attention-800">
        {t('request.report.title', { count: rows.length })}
      </div>
      <ul className="mt-1 space-y-1">
        {rows.map((row) => (
          <li
            key={`${row.itemNumber}-${row.kind}`}
            className="flex items-baseline gap-2 text-[11px] text-attention-800"
            data-cc-request-skipped={row.itemNumber}
            data-cc-request-skipped-kind={row.kind}
          >
            <span data-numeric>
              <Ltr>{row.itemNumber}</Ltr>
            </span>
            <span className="min-w-0 flex-1">
              {row.kind === 'belowAtp'
                ? t('request.report.belowAtp', {
                    requested: row.requested,
                    available: row.available,
                  })
                : // The server's own code, worded where the console has a sentence
                  // for it and fallen back to a phrase that claims nothing where it
                  // has not — the same posture `submitBlockers` takes, and for the
                  // same reason: a raw code is not a thing to read to a caller, and
                  // a sentence invented for an unknown code would claim to know why.
                  t(`request.report.refused.${row.code}`, {
                    defaultValue: t('request.report.refused.unknown'),
                  })}
            </span>
            {/* 🚩 The ordinary acceptance path, on the one kind of row that has
                one. Absent when the door would refuse the add. */}
            {row.addAnyway && actions.onAddAnyway && (
              <button
                type="button"
                onClick={() => actions.onAddAnyway?.(row)}
                data-cc-request-add-anyway={row.itemNumber}
                className="shrink-0 rounded-md border border-attention-border px-2 py-0.5 font-semibold hover:opacity-80"
              >
                {t('request.report.addAnyway')}
              </button>
            )}
          </li>
        ))}
      </ul>
    </ConsoleBanner>
  )
}

/**
 * The console's one in-the-flow banner: something the agent has to read once
 * about an order that is otherwise fine, pinned above the columns so it survives
 * the modal or panel the news came out of closing.
 *
 * It exists because there are now TWO of them (167's atomic refusal and 177's
 * swallowed acceptance) and they were identical down to the dismiss button. The
 * tone is the only thing that differs, and it differs meaningfully: `danger` is
 * a refusal, `attention` is a thing that silently did not happen.
 */
function ConsoleBanner({
  tone,
  marker,
  dismissMarker,
  children,
  onDismiss,
}: {
  tone: 'danger' | 'attention'
  /** The drive's hook, as the attribute it should carry — each banner names its
   *  own, because a shared `data-cc-banner` would make two states one selector. */
  marker: Record<string, string>
  /** The dismiss button's own hook. Named by each banner for the same reason
   *  `marker` is: three banners share two tones now, so the tone cannot be what
   *  picks the selector a drive was written against. */
  dismissMarker: Record<string, string>
  children: React.ReactNode
  onDismiss?: () => void
}) {
  const { t } = useTranslation('callcenter')
  const ink = tone === 'danger' ? 'text-danger-800' : 'text-attention-800'
  const edge = tone === 'danger' ? 'border-danger-border bg-danger-050' : 'border-attention-border bg-attention-050'
  return (
    <div className={`flex shrink-0 items-start gap-3 border-b px-4 py-2 ${edge}`} role="alert" {...marker}>
      <div className="min-w-0 flex-1">{children}</div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          data-cc-banner-dismiss
          {...dismissMarker}
          aria-label={t('rebind.dismiss')}
          title={t('rebind.dismiss')}
          className={`shrink-0 rounded-full border p-1 hover:opacity-80 ${ink} ${
            tone === 'danger' ? 'border-danger-border' : 'border-attention-border'
          }`}
        >
          <X className="h-3 w-3" aria-hidden />
        </button>
      )}
    </div>
  )
}

/**
 * `REBIND_REFUSED`, drawn (167). Atomic by contract — nothing partial is ever
 * persisted — so the sentence is *nothing was changed*, and the offending line
 * is named here as well as tinted in the basket.
 *
 * It is dismissible because the order is fine: it is a refusal the agent has to
 * read once, not a state the console is stuck in.
 */
function RebindBanner({ refusal, onDismiss }: { refusal: RebindRefusal | null; onDismiss?: () => void }) {
  const { t } = useTranslation('callcenter')
  if (!refusal) return null
  return (
    <ConsoleBanner
      tone="danger"
      marker={{ 'data-cc-rebind-refused': '' }}
      dismissMarker={{ 'data-cc-rebind-refused-dismiss': '' }}
      onDismiss={onDismiss}
    >
      {/* Server-supplied, passed through as data (§7). */}
      <div className="text-sm font-medium text-danger-800">{refusal.message}</div>
      {refusal.lines.map((line) => (
        <div key={line.lineId} className="mt-0.5 text-xs text-danger-800" data-cc-refused-line={line.lineId}>
          {[line.itemNumber, line.description].filter(Boolean).join(' · ') || line.lineId}
        </div>
      ))}
      <div className="mt-0.5 text-[11px] text-danger-800/80">{t('rebind.nothingChanged')}</div>
    </ConsoleBanner>
  )
}

/**
 * The live receipt — never goes below the fold, with *Place order* pinned to its
 * foot where it never scrolls away (US53).
 *
 * 🚩 **Every figure is the engine's** (`receiptView` takes `totals` and is never
 * given the lines, §2.1). It re-quotes as the basket changes because the basket's
 * verbs return the whole state — including the **delivery fee**, so crossing its
 * threshold is something the agent watches happen rather than discovers at
 * submit (US36).
 */
function Receipt({ state, submit }: { state: SessionState; submit: SubmitActions }) {
  const { t } = useTranslation('callcenter')
  const { capabilities } = state
  const receipt = receiptView(state.totals)
  const blockers = submitBlockers(capabilities.submitBlockers)
  // 🚩 The order number outranks everything else in this foot. Once it exists
  // there is nothing left to press and nothing left to fix — including the
  // `ALREADY_SUBMITTED` blocker, which is the projection saying the same thing
  // in the negative and would read as a problem beside the confirmation.
  const placed = submit.outcome
  return (
    <aside className="flex min-h-0 flex-col bg-card" data-cc-receipt>
      <div className="border-b border-divider px-4 py-2 text-[11px] uppercase tracking-wide text-muted-foreground">
        {t('receipt.heading')}
      </div>
      <div className="min-h-0 flex-1 overflow-auto px-4 py-3">
        <dl className="space-y-1.5 text-sm">
          <Row label={t('receipt.items')} value={<Money value={receipt.net} />} />
          <Row label={t('receipt.vat')} value={<Money value={receipt.vat} />} />
          {/* 🚩 **Absent, not zero** under `PickInStore` (156, capture 09). The
              block still arrives on the wire — `{ amount: 0, waived: false,
              thresholdGross: 100 }` — so the flip back re-quotes instantly; what
              must not happen is this console drawing `Delivery SAR 0.00` and a
              free-delivery promise on an order nobody is delivering. */}
          {showsDeliveryRegion(state.header) && receipt.delivery && (
            <DeliveryRegion fee={receipt.delivery} />
          )}
          <div className="mt-3 flex items-baseline justify-between border-t border-border-strong pt-3">
            <span className="text-sm font-semibold">{t('receipt.total')}</span>
            <span data-cc-payable>
              <Money value={receipt.payable} size="lg" />
            </span>
          </div>
        </dl>
      </div>
      <div className="space-y-2 border-t border-divider p-4">
        {placed ? (
          <OrderPlaced documentNo={placed.documentNo} />
        ) : (
          <>
            {/* 🚩 What the last attempt said, between the figures and the
                button — never a modal, and never over the basket: on every one
                of these the order is still Open and exactly as the agent left
                it, so the call carries on from here. */}
            <SubmitFailureNote
              failure={submit.failure}
              requestGone={submit.requestGone ?? null}
              onUnlink={submit.onUnlink}
            />
            {blockers.length > 0 && (
              // 🚩 US54 / US22 — *Place order* is never mysteriously dead: while
              // something is missing the reason is NAMED, from the server's own
              // list. The wording and the chip ownership are `submit-blockers.ts`'s,
              // so a code this client has never heard of still reaches the agent as
              // words rather than as `MISSING_PAYMENT_TYPE`, and the chip row cannot
              // disagree with this sentence about which section is at fault.
              <div className="text-xs text-attention-800" data-cc-blockers>
                {t('receipt.needed', { list: blockers.map((blocker) => t(blocker.key)).join(' · ') })}
              </div>
            )}
            <button
              type="button"
              onClick={submit.onPlace}
              // 🚩 Dead unless the page passed a handler — which it does only on
              // the door's own `canSubmit` — and dead while it is running: a
              // second press mid-flight is one action sent twice, on the verb
              // that mints a real OMS order.
              disabled={!submit.onPlace || submit.placing}
              data-cc-submit
              // The handle the drive asserts *the receipt holds* through: the
              // button says what it is doing and nothing else on screen moves.
              {...(submit.placing ? { 'data-cc-submit-placing': '' } : {})}
              className="flex w-full items-center justify-center gap-2 rounded-md bg-primary px-3 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-40"
            >
              {submit.placing && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
              {/* 🚩 The retryable outage is the ONE case where this button
                  changes its word — and it re-sends the SAME action rather than
                  starting a second one. A separate *Try again* beside it would
                  be two controls for one act (164's ruling). */}
              {submit.placing
                ? t('submit.placing')
                : submit.failure?.retryable
                  ? t('submit.tryAgain')
                  : t('receipt.placeOrder')}
            </button>
          </>
        )}
      </div>
    </aside>
  )
}

/**
 * The delivery line and the sentence under it — drawn only where the order is
 * actually being delivered (176).
 *
 * 🚩 **The waived state stops being a bare green word** (contract v1.5, ticket
 * 156). `ConsoleShell.tsx` used to gate *"free over SAR 100"* on `!waived`, so
 * the sentence that would EXPLAIN a waiver vanished at the instant it became
 * true — and during a free-delivery campaign an agent would fill that silence
 * with *"because you're over 100"*, which may be false. The server ships the
 * branch it took; this draws it.
 *
 * ⚠ **`waivedReason` is not reachable yet** — capture 09 is a v1.4 response and
 * carries no such field (BackOffice 874 is unbuilt), so the `waived` arm below is
 * proved from a stubbed state in the drive and the drive says so. 177's lesson:
 * an unreachable path is drawn *and named*, never drawn and assumed.
 */
function DeliveryRegion({ fee }: { fee: DeliveryFeeView }) {
  const { t } = useTranslation('callcenter')
  const line = feeLine(fee)
  return (
    <>
      <Row
        label={t('receipt.delivery')}
        value={
          line.kind === 'amount' ? (
            <span data-cc-delivery-fee>
              <Money value={line.amount} />
            </span>
          ) : (
            // 🚩 `waived` is an OUTCOME the agent is shown, never a control they
            // operate — the manual waiver was removed (map note 4's correction),
            // so there is nothing here to switch.
            <span className="text-xs font-medium text-success-800" data-cc-delivery-waived>
              {t('receipt.waived')}
            </span>
          )
        }
      />
      {/* What the basket has to reach for the fee to fall away — the server's own
          threshold, so the agent can say it out loud while the caller is still
          deciding. */}
      {line.kind === 'amount' && line.thresholdGross !== null && (
        <p className="text-[11px] text-muted-foreground" data-cc-delivery-threshold>
          {/* Engine money, so it carries the currency word — read from the one
              key that holds it rather than spelled into the sentence. */}
          {t('receipt.freeOver', {
            amount: formatMoney(line.thresholdGross),
            currency: t('money.currency'),
          })}
        </p>
      )}
      {/* The reason it fell away, in the server's own branch. An unrecognised
          category never reaches here at all — `feeLine` has already degraded it
          to `waivedNoReason`, the bare word above and no sentence (§9), which is
          exactly what v1.4 does today. So this key always exists. */}
      {line.kind === 'waived' && (
        <p className="text-[11px] text-success-800" data-cc-delivery-waived-reason={line.reason}>
          {t(`receipt.waivedReason.${line.reason}`)}
        </p>
      )}
    </>
  )
}

/**
 * The order number, and the sentence that tells the agent what to do with it.
 *
 * 🚩 It appears only when a `documentNo` exists — there is no optimistic
 * hand-off on this screen (174). And it is the SAME panel whichever success
 * produced it: `submit-outcome.ts` has already dropped the outcome word, so
 * there is nothing here that could tell a replay from a first submit.
 */
function OrderPlaced({ documentNo }: { documentNo: string }) {
  const { t } = useTranslation('callcenter')
  return (
    <div
      className="rounded-md border border-success-border bg-success-050 p-3 text-center"
      role="status"
      data-cc-order-placed
    >
      <div className="text-xs font-medium uppercase tracking-wide text-success-800">
        {t('submit.placed')}
      </div>
      <div className="mt-1 text-[11px] text-muted-foreground">{t('submit.orderNo')}</div>
      {/* Server-supplied, passed through as data — and read out loud, so it is
          the biggest thing in the receipt's foot. LTR-pinned like every other
          identifier: an order number is not text that mirrors. */}
      <div data-numeric className="text-xl font-semibold tracking-wide" data-cc-order-no>
        <Ltr>{documentNo}</Ltr>
      </div>
      <p className="mt-1 text-[11px] text-muted-foreground">{t('submit.readToCaller')}</p>
    </div>
  )
}

const TONES = {
  attention: { box: 'border-attention-border bg-attention-050', ink: 'text-attention-800' },
  danger: { box: 'border-danger-border bg-danger-050', ink: 'text-danger-800' },
} as const

/**
 * What the last attempt said. Two shapes, and the difference between them is
 * what the agent does next:
 *
 * - **refused** — something on the order needs fixing first, and the section is
 *   named so it is somewhere to look rather than a word in a sentence.
 * - **unavailable** — 🚩 retryable, and it must never read as *unexpected*: the
 *   order is Open and safe, and the button beside this already says *Try again*.
 *
 * Either way the last line says the order is still open, because that is the
 * fact that decides whether the agent keeps the caller on the phone.
 *
 * 🚩 And one refusal is answered by an ACT rather than by a fix (195): the
 * request this order converts was converted or cancelled behind the agent's back,
 * so nothing on the order is wrong and there is nothing to correct — the escape
 * is *unlink, then submit*, and the refusal names the request it is about.
 */
function SubmitFailureNote({
  failure,
  requestGone,
  onUnlink,
}: {
  failure: SubmitFailure | null
  requestGone: RequestGone | null
  onUnlink?: () => void
}) {
  const { t } = useTranslation('callcenter')
  if (!failure) return null
  const chip = submitRefusalChip(failure.field)
  // 🚩 A retryable outage is drawn in the ATTENTION register, not the danger
  // one — nothing is wrong with the order, and the agent's next move is simply
  // to press again. Spelled as whole class strings rather than composed from a
  // tone word: Tailwind scans source text, and an interpolated class name is one
  // that never reaches the stylesheet.
  const tone = failure.retryable ? TONES.attention : TONES.danger
  return (
    <div
      className={`rounded-md border p-2.5 ${tone.box}`}
      role="alert"
      data-cc-submit-failed={failure.kind}
      {...(failure.retryable ? { 'data-cc-submit-retryable': '' } : {})}
    >
      <div className={`text-xs font-medium ${tone.ink}`}>
        {t(failure.kind === 'unavailable' ? 'submit.unavailableTitle' : 'submit.refusedTitle')}
      </div>
      {/* The server's own sentence (§7), passed through as data — it is what
          names the field, in words the agent can act on.
          🚩 Except under the one refusal the console words itself: §7's
          `REQUEST_ALREADY_CONVERTED` sentence names the same request the block
          below does, and printing both would say one thing twice in two voices.
          The console's is the one that carries the escape, so it is the one that
          survives — the same posture `COUPON_REVERSAL_REFUSED` takes (189). */}
      {!requestGone && <p className={`mt-0.5 text-[11px] ${tone.ink}`}>{failure.message}</p>}
      {chip && (
        <p className="mt-0.5 text-[11px] text-muted-foreground" data-cc-submit-fix={chip}>
          {t('submit.fixSection', { section: t(`chips.${chip}`) })}
        </p>
      )}
      {/* 🚩 The request is gone, and the order is perfectly good. Named — the
          agent has to be able to say WHICH request to whoever converted it — and
          offered the one act that resolves it. The button opens the ordinary
          unlink confirmation: the escape costs the copied lines like any other
          unlink, and this is not the place to discover that. */}
      {requestGone && (
        <div className="mt-1.5" data-cc-submit-request-gone={requestGone.documentNo}>
          <p className={`text-[11px] ${tone.ink}`}>
            {t('submit.requestGone', { documentNo: requestGone.documentNo })}
          </p>
          {onUnlink && (
            <button
              type="button"
              onClick={onUnlink}
              data-cc-submit-unlink
              className="mt-1 rounded-md border border-danger-border px-2.5 py-1 text-[11px] font-semibold text-danger-800 hover:opacity-80"
            >
              {t('request.unlink.action')}
            </button>
          )}
        </div>
      )}
      {/* 🚩 Said out loud on every failure: only the two successes close the
          transaction (§7), so a refusal is a correction and not a lost basket. */}
      <p className="mt-0.5 text-[11px] text-muted-foreground">{t('submit.stillOpen')}</p>
    </div>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between">
      <dt className="text-muted-foreground">{label}</dt>
      <dd>{value}</dd>
    </div>
  )
}
