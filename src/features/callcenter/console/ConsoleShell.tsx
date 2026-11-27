/**
 * The console's spatial contract, rendered from the server's own projection.
 *
 * 135's ruling, as 379 amended it (spec 380 C2): **two columns plus a bar.** The
 * live receipt at the end edge never moves, and the centre column is the only
 * region that grows — caller bar → header sentence → item search → basket → offer
 * strip, in that vertical order. 135's 260px customer rail is gone: it collapsed
 * into the caller bar at the top of the centre, which grows from 644 to 904px at
 * 1280. The furniture is at the same pixels at hour nine as at hour one, which is
 * the one property a twelve-hour shift rewards.
 *
 * Slice 0 renders what an empty order actually has, and nothing it does not:
 * every value below comes off `SessionState`. There is no client-computed total
 * (law 1 / §2.1 — the console never sums lines), no hand-made placeholder, and
 * no control enabled by a client-side predicate: *Place order* is live only
 * because `capabilities.canSubmit` said so (the page reads it and passes the
 * handler, as it does for every other capability-gated control), and the reason
 * under a dead one is `submitBlockers`, the server's own list.
 *
 * The caller bar is the call's opening move rather than furniture (165, 409 — see
 * `CallerBar.tsx`).
 *
 * 🚩 **Three columns** (spec 983 D1, ticket 984): the caller (start), the order (centre)
 * and the summary (end). Below 1280px they stack — caller, order, summary — and the
 * console scrolls as one page, never sideways. The centre opens with the step rail
 * (D3), which reads the same `step-rail.ts` model as the summary's *Before you place it*
 * checklist, so the rail, the checklist and *Place order* cannot disagree.
 */
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, CircleDashed, Loader2, PhoneCall, RefreshCw, X } from 'lucide-react'
import { useCommands } from '@/core/commands/registry'
import type { SessionState } from '@/core/models/callcenter'
import Ltr from '@/core/ui/Ltr'
import { formatPair, fsi } from '@/core/util/bidi'
import { formatMoney } from '@/core/util/number-format'
import BasketPanel, { type BasketActions } from './BasketPanel'
import { receipt as receiptOf, type ReceiptFee } from './receipt-view'
import { paletteCommands, type PaletteActions } from './palette-model'
import { capabilityGate, isPickup, showsDeliveryRegion } from './fulfilment-view'
import BusyStrip, { type BusyPhase } from './BusyStrip'
import CallerBar, { type CallerRequests, type CallerSignup, type CustomerActions } from './CallerBar'
import CallerColumn from './CallerColumn'
import type { GuidanceActions } from './GuidanceStrip'
import PromotionsPanel from './PromotionsPanel'
import { promotionsPanel } from './promotions-panel'
import HeaderSentence from './HeaderSentence'
import type { LinkReport, RequestGone, SkippedRow } from './linked-request'
import ItemSearchPanel, { type AddItemActions } from './ItemSearchPanel'
import Money from './Money'
import OpeningSteps from './OpeningSteps'
import ReadBack from './ReadBack'
import { openingSteps } from './opening-steps'
import type { RebindRefusal } from './store-move'
import StepRail from './StepRail'
import { beforeYouPlace, stepRail, type Checklist, type RailStep } from './step-rail'
import { submitRefusalChip, type SubmitFailure, type SubmitOutcome } from './submit-outcome'
import Button from '@/core/ui/Button'
import IconButton from '@/core/ui/IconButton'

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
  /** Opens the unlink CONFIRMATION — the same one the caller bar's detail opens, because
   *  it is the same act with the same cost. Absent ⇒ no escape is drawn and the
   *  server's own sentence stands alone. */
  onUnlink?: () => void
  /**
   * 🚩 **The way out of a placed order** — mints the next one, in this tab, with
   * no confirmation.
   *
   * A placed order is a screen with nothing left to do on it: every verb has
   * stood down on `status`, *Place order* is gone, and the only thing an agent
   * could reach for was the browser's reload button. It needs no `AbandonConfirm`
   * because there is nothing to void — the document exists and the transaction is
   * closed — so this is the plain abandon-free half of *start fresh*: forget the
   * finished order and open a new one.
   */
  onNewOrder?: () => void
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
  headerSection = null,
  headerSectionOpen = false,
  locationLink = null,
  addressBook = null,
  history = null,
  shortcuts,
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
  /** The two customer verbs and their outcome (165), passed through to the bar.
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
   *  header sentence off `capabilities`, because a delivery-only source is a different
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
  /** The loyalty signup (159), passed through to the caller bar. Absent ⇒ the bar
   *  offers no enrolment at all. */
  signup?: CallerSignup
  /** The caller's open sales requests (194), passed through to the caller bar.
   *  Absent ⇒ the bar says nothing about requests at all. */
  requests?: CallerRequests
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
  /**
   * 🚩 What a chip opens into (175 §9's variant 4) — the header sections, drawn
   * **in the flow directly under the row they collapsed** rather than in a
   * dialog over the order.
   *
   * They arrive as a node rather than as eight more handlers because every one
   * of them is a verb the PAGE owns, wired to a mutation the page holds; what
   * this shell owns is only *where they land*, which is the one thing the page
   * cannot say. A closed section renders nothing, so this slot is empty at rest.
   */
  headerSection?: ReactNode
  /** Whether one of those sections is currently open — the sequence card stands
   *  down while it is, so a chip's section is never drawn under a card telling
   *  the agent to open it. */
  headerSectionOpen?: boolean
  /** The location link (574): the page's panel, which owns its own calls. The shell owns
   *  only where it lands — the caller column, under the address book (983 D10, 989). */
  locationLink?: ReactNode
  /** The caller column's address book cards (989). The page's, like the link. */
  addressBook?: ReactNode
  /** 990 — the caller's last orders and usual items, between the caller and the book. */
  history?: ReactNode
  /** 992 (983 D13) — the Ctrl K shortcuts only the page can run (reorder, the location
   *  link, the switch, the next slot, a held coupon). Each absent ⇒ a disabled row. */
  shortcuts?: PaletteActions['verbs']
}) {
  // The lines the refusal named, for the tint. A Set because the basket asks per
  // line and a refusal can name several.
  const refusedLines = new Set((refusal?.lines ?? []).map((line) => line.lineId))
  // Read ONCE, here: the strip draws it, the top bar mirrors its count (US51)
  // and the palette lists it (192), and two reads would be two chances for them
  // to disagree about what is actionable.
  // 987: the promotions panel reads it through `promotionsPanel`, so it is still one read.
  const promotions = promotionsPanel(state)
  const guidance = promotions.guidance
  // 🚩 One model for the rail and the checklist (D3): two reads would be two chances to
  // disagree with *Place order*.
  const rail = stepRail(state)
  const { i18n } = useTranslation()
  // 🚩 One key reaches everything the order can do (192), through the app-wide palette
  // (395, spec 380 K19): these are the console's This screen rows, and every one runs a
  // handler this shell was ALREADY given. Nothing here is a new route to a verb: an act
  // the page withheld (a shut capability, a closed order) arrives as a missing handler
  // and the palette draws it disabled with its reason, which is the one place on this
  // console a refused control is drawn rather than withheld. No command carries a key —
  // 153 stands whole — and the two that end a call are `terminal`.
  useCommands(
    paletteCommands({
      guidance,
      capabilities: state.capabilities,
      hasCaller: state.header.customer != null,
      // Read for one sentence: *Change store* is refused on a delivery order
      // for a reason no capability carries, and the row borrows the store
      // readout's own words for it rather than falling through to the vague one.
      pickup: isPickup(state.header),
      known: (key) => i18n.exists(key),
      actions: {
        verbs: {
          // The way home for focus stranded on a word — and the box the
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
          // 🚩 The SAME gate the sentence applies, from the same function on
          // the same state — so a word that stopped being a control cannot
          // be a live palette row.
          fulfilment: capabilityGate(state.capabilities, 'canChangeFulfilment').open
            ? onChangeFulfilment
            : undefined,
          payment: capabilityGate(state.capabilities, 'canChangePaymentType').open
            ? onChangePayment
            : undefined,
          coupon: onChangeCoupon,
          attachCaller: () => focusBox('cc-phone'),
          // The caller bar's own gate, mirrored: a removal in flight withdraws
          // the control there, and a palette row that ignored it would be a
          // second `removeCustomer` on one caller.
          removeCaller: customerActions.busy ? null : customerActions.onRemove,
          refresh: onRefresh,
          ...shortcuts,
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
    }),
  )
  return (
    <div
      // The shell's content area, filled (ticket 407): the route flags `fill`, so the
      // area below the top bar is the console's whole height and the page never
      // scrolls — the basket and the receipt scroll in their own columns.
      className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-background text-foreground"
      data-cc-console
      // WHICH order is on screen, for the drives. Not rendered text — a
      // 26-character ULID is nothing an agent reads — but "the order you landed
      // on is not the one you abandoned" is otherwise only provable by its
      // emptiness, which any other empty order would also satisfy.
      data-cc-transaction={state.transactionId}
    >
      <TopBar
        state={state}
        actionableOffers={guidance.withinReachCount}
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
      {/* 🚩 Three columns at 1280 and up (spec 983 D1): the caller, the order and the
          summary, each scrolling in itself. Below 1280 they stack in that order and the
          console scrolls as one column — never sideways. Stacked rows are sized to
          their content (`auto-rows-max`): an `auto` row in an overflowing grid falls to
          its min-content, which for the receipt's own scroller is zero. */}
      <div
        className="grid min-h-0 flex-1 auto-rows-max grid-cols-1 overflow-y-auto xl:auto-rows-[minmax(0,1fr)] xl:grid-cols-[288px_minmax(0,1fr)_320px] xl:overflow-hidden"
        data-cc-columns
      >
        {/* The caller column (start, 989): the caller (tier, never points — D2), 990's
            last orders and usual items, the address book, and the location link (D10). */}
        <CallerColumn
          // 🚩 The caller bar (379, C7): the call's opening move, at the top of the
          // caller column.
          caller={
            <CallerBar state={state} customerActions={customerActions} signup={signup} requests={requests} />
          }
          history={history}
          addressBook={addressBook}
          locationLink={locationLink}
        />
        {/* Not a `<main>`: the console sits inside the shell's (407), and a page has one. */}
        <div
          className="flex min-w-0 flex-col border-b border-border xl:min-h-0 xl:border-e xl:border-b-0"
          data-cc-centre
          data-cc-col="order"
        >
          {/* 🚩 The step rail (D3): what is done and what is missing, at a glance. A
              click lands focus on the step's own section. */}
          <StepRail steps={rail} onStep={focusStep} />
          {/* 🚩 The order header as a sentence over a ledger (408, spec 380 C3).
              Each word opens the section it names; the model decides which words
              can be controls at all, and a missing handler here means the page
              will not let that one open now. */}
          <HeaderSentence
            state={state}
            openers={{
              fulfilment: onChangeFulfilment,
              // 166/379: the address word is the address book's ONLY door, once
              // a caller is attached.
              address: onPickAddress,
              store: onChangeStore,
              slot: onChangeSlot,
              payment: onChangePayment,
              source: onChangeSource,
              coupon: onChangeCoupon,
              note: onChangeNote,
            }}
          />
          {/* 🚩 175 §9: **the section a word opens, in the flow, immediately under
              the sentence that opened it** — still in the centre column (984 moves
              where the header lives, not where its sections open). */}
          {headerSection}
          {/* 🚩 The sequence, while the door will take nothing (175). It sits
              exactly where the section would, and it retires the moment the gate
              opens. Never both at once. */}
          {!headerSectionOpen && (
            <OpeningSteps steps={openingSteps(state.header, state.capabilities, state.status)} />
          )}
          {/* 135's fixed vertical order — search above the basket, because that is
              the direction the work runs in. */}
          <ItemSearchPanel
            state={state}
            add={addItem}
            scope={searchScope}
            onClearScope={onClearSearchScope}
          />
          {/* 985 numbers the basket and adds each line's pricing detail, here. */}
          <BasketPanel state={state} refusedLines={refusedLines} actions={lineEdit} />
          {/* Under the basket it is about — D7's promotions panel (987): what fired, and the
              guidance strip's offers one step away (171, 172, 412–415). */}
          <PromotionsPanel
            view={promotions}
            transactionId={state.transactionId}
            plant={state.header.plant}
            actions={guidanceActions}
          />
        </div>
        <Receipt state={state} submit={submit} checklist={beforeYouPlace(state)} />
      </div>
    </div>
  )
}

/** The two boxes a palette row hands focus back to. */
function focusBox(id: string) {
  document.getElementById(id)?.focus()
}

/**
 * Where a step click lands (D3): the first place on screen that answers the step's
 * focus, tried in order. A header word that is a readout rather than a control is made
 * programmatically focusable (`tabindex=-1`) so focus still arrives somewhere visible.
 */
const STEP_TARGETS: Record<RailStep['focus'], string[]> = {
  caller: ['#cc-phone', '[data-cc-col="caller"]'],
  items: ['#cc-item-search', '[data-cc-basket]'],
  fulfilment: ['[data-cc-chips] [data-cc-chip="fulfilment"]', '[data-cc-chips]'],
  address: ['[data-cc-chips] [data-cc-chip="address"]', '[data-cc-chips]'],
  store: ['[data-cc-chips] [data-cc-chip="store"]', '[data-cc-chips]'],
  slot: ['[data-cc-chips] [data-cc-chip="slot"]', '[data-cc-chips]'],
  payment: ['[data-cc-chips] [data-cc-chip="payment"]', '[data-cc-chips]'],
  source: ['[data-cc-chips] [data-cc-chip="source"]', '[data-cc-chips]'],
  reference: ['[data-cc-chips] [data-cc-chip="reference"]', '[data-cc-chips]'],
  review: ['#cc-checklist'],
  placed: ['#cc-checklist'],
  unknown: ['#cc-checklist'],
}

function focusStep(step: RailStep) {
  for (const selector of STEP_TARGETS[step.focus]) {
    const el = document.querySelector<HTMLElement>(selector)
    if (!el) continue
    if (!el.matches('button, input, select, textarea, a[href], [tabindex]')) el.setAttribute('tabindex', '-1')
    el.focus()
    el.scrollIntoView({ block: 'nearest' })
    return
  }
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
          <IconButton
            variant="outlined"
            onClick={onRefresh}
            disabled={refreshing}
            data-cc-refresh
            label={t('console.refresh')}
            className="ms-2"
          >
            <RefreshCw className={`h-3 w-3 ${refreshing ? 'animate-spin' : ''}`} aria-hidden />
          </IconButton>
        )}
        {onAbandon && (
          // Quiet by design and set apart from the receipt's *Place order*: the
          // two terminal acts of a call must not sit side by side. It is the
          // only destructive control on the screen, and it never voids anything
          // on its own — the confirmation names what is thrown away first (US6).
          <Button variant="danger-outlined" onClick={onAbandon} data-cc-abandon className="ms-2">
            {t('abandon.action')}
          </Button>
        )}
      </div>
    </header>
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
                className="shrink-0 rounded-full border border-attention-border px-2 py-0.5 font-semibold hover:opacity-80"
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
        <IconButton
          size="compact"
          onClick={onDismiss}
          data-cc-banner-dismiss
          {...dismissMarker}
          label={t('rebind.dismiss')}
        >
          {/* The banner's own ink on the glyph, so the ✕ reads as part of its banner. */}
          <X className={`h-3 w-3 ${ink}`} aria-hidden />
        </IconButton>
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
          <Ltr>{formatPair(line.itemNumber, line.description) || line.lineId}</Ltr>
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
 * 🚩 **Every figure is the engine's** (`receipt-view.ts` takes `totals` and is never
 * given the lines, §2.1; spec 983 D6). Original and Discount are C1's v1.13 fields:
 * on a v1.12 server they are not drawn, never found by subtraction. It re-quotes as the basket changes because the basket's
 * verbs return the whole state — including the **delivery fee**, so crossing its
 * threshold is something the agent watches happen rather than discovers at
 * submit (US36).
 */
function Receipt({
  state,
  submit,
  checklist,
}: {
  state: SessionState
  submit: SubmitActions
  /** *Before you place it* (D3) — the same model the step rail reads. */
  checklist: Checklist
}) {
  const { t } = useTranslation('callcenter')
  // 🚩 **Absent, not zero** under `PickInStore` (156, capture 09). The fee block
  // still arrives on the wire — `{ amount: 0, waived: false, thresholdGross: 100 }`
  // — so the flip back re-quotes instantly; what must not happen is this console
  // drawing `Delivery SAR 0.00` and a free-delivery promise on an order nobody is
  // delivering.
  const receipt = receiptOf(state.totals, { delivering: showsDeliveryRegion(state.header) })
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
          {receipt.figures.map((figure) => (
            <Row
              key={figure.id}
              label={t(`receipt.${figure.id}`)}
              value={
                <span data-cc-receipt-figure={figure.id}>
                  <Ltr>
                    {/* A sign is wording, not arithmetic: the server's discount is
                        a positive amount, drawn as one taken off. */}
                    {figure.id === 'discount' && '−'}
                    <Money value={figure.amount} />
                  </Ltr>
                </span>
              }
            />
          ))}
          {receipt.fee && <DeliveryRegion fee={receipt.fee} />}
          <div className="mt-3 flex items-baseline justify-between border-t border-border-strong pt-3">
            <span className="text-sm font-semibold">{t('receipt.total')}</span>
            <span data-cc-payable>
              <Ltr>
                <Money value={receipt.total} size="lg" />
              </Ltr>
            </span>
          </div>
          {/* *Caller saves …* — the server's own discount, only above nought. */}
          {receipt.saves !== null && (
            <div className="flex justify-end">
              <span
                className="rounded-full bg-success-050 px-2.5 py-0.5 text-xs font-medium text-success-800"
                data-cc-saves
              >
                {t('receipt.saves')}{' '}
                <Ltr>
                  <Money value={receipt.saves} />
                </Ltr>
              </span>
            </div>
          )}
        </dl>
        {/* 🚩 *Before you place it* (D3, US12): the server's blockers as rows, the
            same model the rail's Review step reads. Gone once the order is placed —
            `ALREADY_SUBMITTED` beside the order number would read as a problem. */}
        {!placed && <BeforeYouPlace checklist={checklist} />}
        {/* The read-back (D8): what the agent says aloud before *Place order*, from the
            same state — so it changes with every answer the order gets. */}
        {!placed && <ReadBack state={state} />}
      </div>
      <div className="space-y-2 border-t border-divider p-4">
        {placed ? (
          <OrderPlaced documentNo={placed.documentNo} onNewOrder={submit.onNewOrder} />
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
            <Button
              onClick={submit.onPlace}
              // 🚩 Dead unless the page passed a handler — which it does only on
              // the door's own `canSubmit` — dead while any blocker remains (D9:
              // the checklist names what), and dead while it is running: a
              // second press mid-flight is one action sent twice, on the verb
              // that mints a real OMS order.
              disabled={!submit.onPlace || !checklist.ready || submit.placing}
              data-cc-submit
              // The handle the drive asserts *the receipt holds* through: the
              // button says what it is doing and nothing else on screen moves.
              {...(submit.placing ? { 'data-cc-submit-placing': '' } : {})}
              className="w-full justify-center"
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
            </Button>
          </>
        )}
      </div>
    </aside>
  )
}

/**
 * *Before you place it* (spec 983 D3, US12): every row the order still needs, in the
 * server's own words, beside the ones already settled. Its id is the Review step's
 * landing place.
 */
function BeforeYouPlace({ checklist }: { checklist: Checklist }) {
  const { t } = useTranslation('callcenter')
  return (
    <section
      id="cc-checklist"
      tabIndex={-1}
      aria-labelledby="cc-checklist-heading"
      className="mt-4 border-t border-divider pt-3"
      data-cc-checklist={checklist.ready ? 'ready' : 'blocked'}
    >
      <h2
        id="cc-checklist-heading"
        className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
      >
        {t('checklist.heading')}
      </h2>
      <ul className="mt-1.5 space-y-1">
        {checklist.rows.map((row) => {
          const done = row.state === 'done'
          return (
            <li
              key={row.id}
              className={`flex items-start gap-1.5 text-xs ${done ? 'text-success-800' : 'text-attention-800'}`}
              data-cc-check={row.id}
              data-cc-check-state={row.state}
              // The wire codes, for the drive and the log — never for the eye.
              data-cc-check-codes={row.codes.join(' ') || undefined}
            >
              {done ? (
                <Check className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
              ) : (
                <CircleDashed className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
              )}
              <span className="first-letter:uppercase">{t(row.key)}</span>
            </li>
          )
        })}
      </ul>
    </section>
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
 * Spec 983 / ticket 986: a waived fee is **struck out and marked free**, its reason
 * under it — the fee the caller would have paid, read off `deliveryFee.amount`,
 * never a figure the console worked out.
 */
function DeliveryRegion({ fee }: { fee: ReceiptFee }) {
  const { t } = useTranslation('callcenter')
  return (
    <>
      <Row
        label={t('receipt.delivery')}
        value={
          fee.kind === 'amount' ? (
            <span data-cc-delivery-fee>
              <Ltr>
                <Money value={fee.amount} />
              </Ltr>
            </span>
          ) : (
            // 🚩 `waived` is an OUTCOME the agent is shown, never a control they
            // operate — the manual waiver was removed (map note 4's correction),
            // so there is nothing here to switch.
            <span className="inline-flex items-baseline gap-1.5" data-cc-delivery-waived>
              {fee.struck !== null && (
                <s className="text-muted-foreground" data-cc-delivery-struck>
                  <Ltr>
                    <Money value={fee.struck} />
                  </Ltr>
                </s>
              )}
              <span className="text-xs font-medium text-success-800">{t('receipt.free')}</span>
            </span>
          )
        }
      />
      {/* What the basket has to reach for the fee to fall away — the server's own
          threshold, so the agent can say it out loud while the caller is still
          deciding. */}
      {fee.kind === 'amount' && fee.thresholdGross !== null && (
        <p className="text-[11px] text-muted-foreground" data-cc-delivery-threshold>
          {/* Engine money, so it carries the currency word — read from the one
              key that holds it rather than spelled into the sentence. */}
          {t('receipt.freeOver', {
            amount: fsi(formatMoney(fee.thresholdGross)),
            currency: t('money.currency'),
          })}
        </p>
      )}
      {/* The reason it fell away, in the server's own branch. An unrecognised
          category arrives as `reason: null` (receipt-view degrades it) — *free*
          and no sentence (§9), which is exactly what v1.4 does today. */}
      {fee.kind === 'waived' && fee.reason !== null && (
        <p className="text-[11px] text-success-800" data-cc-delivery-waived-reason={fee.reason}>
          {t(`receipt.waivedReason.${fee.reason}`)}
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
 *
 * 🚩 **And it carries the next act.** The order number is read out and then the
 * call ends; what follows is another call, not another look at this order. Until
 * this button existed the finished screen offered nothing at all — the agent
 * reloaded the tab, or opened a change to the placed order just to be asked
 * whether they wanted a new one, which is a junction reached by pretending to do
 * something else.
 */
function OrderPlaced({
  documentNo,
  onNewOrder,
}: {
  documentNo: string
  /** Absent while the page has no order to replace — the panel then states the
   *  outcome and offers nothing, rather than offering a dead control. */
  onNewOrder?: () => void
}) {
  const { t } = useTranslation('callcenter')
  return (
    <>
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
      {onNewOrder && (
        // In the place *Place order* just left, and shaped like it: after a
        // placement this is the only live control on the screen, so it is the
        // one the agent's hand is already over.
        <Button onClick={onNewOrder} data-cc-new-order className="w-full justify-center">
          <PhoneCall className="h-3.5 w-3.5" aria-hidden />
          {t('submit.newOrder')}
        </Button>
      )}
    </>
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
            <Button variant="danger-outlined" onClick={onUnlink} data-cc-submit-unlink className="mt-1">
              {t('request.unlink.action')}
            </Button>
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
