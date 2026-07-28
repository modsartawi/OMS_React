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
import { useTranslation } from 'react-i18next'
import { Loader2, RefreshCw, X } from 'lucide-react'
import type { SessionState } from '@/core/models/callcenter'
import Ltr from '@/core/ui/Ltr'
import { formatMoney } from '@/core/util/number-format'
import BasketPanel, { type BasketActions } from './BasketPanel'
import { receiptView } from './basket-view'
import BusyStrip, { type BusyPhase } from './BusyStrip'
import CustomerRail, { type CustomerActions } from './CustomerRail'
import GuidanceStrip, { type GuidanceActions } from './GuidanceStrip'
import { guidanceView } from './guidance-view'
import { headerChips, type HeaderChip } from './header-chips'
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
  refusal = null,
  onDismissRefusal,
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
  /** `REBIND_REFUSED` — atomic, so nothing was persisted (167). It is drawn in
   *  TWO places on purpose: named in the banner and tinted on the line, so
   *  "nothing was changed, fix this line" is legible in one glance. */
  refusal?: RebindRefusal | null
  onDismissRefusal?: () => void
  /** *Place order* and what it last answered (174) — the page's, like every
   *  other verb, because the outcome is a real OMS order and the cache is the
   *  store of record. */
  submit: SubmitActions
}) {
  // The lines the refusal named, for the tint. A Set because the basket asks per
  // line and a refusal can name several.
  const refusedLines = new Set((refusal?.lines ?? []).map((line) => line.lineId))
  // Read ONCE, here: the strip draws it and the top bar mirrors its count
  // (US51), and two reads would be two chances for the two to disagree about
  // what is actionable.
  const guidance = guidanceView(state.nearMisses)
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
      {/* 1440×900 by design, degrading to 1280; below that is out of scope —
          it is a desktop console (135's density budget). */}
      <div className="grid min-h-0 flex-1 grid-cols-[260px_minmax(0,1fr)_320px]">
        <CustomerRail state={state} customerActions={customerActions} onPickAddress={onPickAddress} />
        <main className="flex min-h-0 min-w-0 flex-col border-x border-border">
          <ChipRow
            state={state}
            onChangeStore={onChangeStore}
            onChangeSlot={onChangeSlot}
            onChangeSource={onChangeSource}
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
    </div>
  )
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
        <span>{t('console.store', { store: state.header.entryStore })}</span>
        <span aria-hidden>·</span>
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
}: {
  state: SessionState
  onChangeStore?: () => void
  onChangeSlot?: () => void
  onChangeSource?: () => void
}) {
  const { t } = useTranslation('callcenter')
  const chips = headerChips(state.header, state.capabilities)
  // 🚩 135's progressive collapse, complete at 173: every chip now re-opens the
  // section it collapsed. Source and reference share one — they are two fields
  // of one act, and a reference belongs to the source it references.
  const opener: Record<HeaderChip['id'], (() => void) | undefined> = {
    store: onChangeStore,
    slot: onChangeSlot,
    source: onChangeSource,
    reference: onChangeSource,
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
      <span className="font-medium">{chip.value ?? t('chips.notSet')}</span>
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
    <div
      className="flex shrink-0 items-start gap-3 border-b border-danger-border bg-danger-050 px-4 py-2"
      role="alert"
      data-cc-rebind-refused
    >
      <div className="min-w-0 flex-1">
        {/* Server-supplied, passed through as data (§7). */}
        <div className="text-sm font-medium text-danger-800">{refusal.message}</div>
        {refusal.lines.map((line) => (
          <div key={line.lineId} className="mt-0.5 text-xs text-danger-800" data-cc-refused-line={line.lineId}>
            {[line.itemNumber, line.description].filter(Boolean).join(' · ') || line.lineId}
          </div>
        ))}
        <div className="mt-0.5 text-[11px] text-danger-800/80">{t('rebind.nothingChanged')}</div>
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          data-cc-rebind-refused-dismiss
          aria-label={t('rebind.dismiss')}
          title={t('rebind.dismiss')}
          className="shrink-0 rounded-full border border-danger-border p-1 text-danger-800 hover:bg-danger-050"
        >
          <X className="h-3 w-3" aria-hidden />
        </button>
      )}
    </div>
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
          {receipt.delivery && (
            <Row
              label={t('receipt.delivery')}
              value={
                receipt.delivery.waived ? (
                  // 🚩 `waived` is an OUTCOME the agent is shown, never a control
                  // they operate — the manual waiver was removed (map note 4's
                  // correction), so there is nothing here to switch.
                  <span className="text-xs font-medium text-success-800" data-cc-delivery-waived>
                    {t('receipt.waived')}
                  </span>
                ) : (
                  <span data-cc-delivery-fee>
                    <Money value={receipt.delivery.amount} />
                  </span>
                )
              }
            />
          )}
          {/* What the basket has to reach for the fee to fall away — the
              server's own threshold, so the agent can say it out loud while the
              caller is still deciding. */}
          {receipt.delivery && !receipt.delivery.waived && receipt.delivery.thresholdGross !== null && (
            <p className="text-[11px] text-muted-foreground" data-cc-delivery-threshold>
              {/* Engine money, so it carries the currency word — read from the
                  one key that holds it rather than spelled into the sentence. */}
              {t('receipt.freeOver', {
                amount: formatMoney(receipt.delivery.thresholdGross),
                currency: t('money.currency'),
              })}
            </p>
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
            <SubmitFailureNote failure={submit.failure} />
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
 */
function SubmitFailureNote({ failure }: { failure: SubmitFailure | null }) {
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
          names the field, in words the agent can act on. */}
      <p className={`mt-0.5 text-[11px] ${tone.ink}`}>{failure.message}</p>
      {chip && (
        <p className="mt-0.5 text-[11px] text-muted-foreground" data-cc-submit-fix={chip}>
          {t('submit.fixSection', { section: t(`chips.${chip}`) })}
        </p>
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
