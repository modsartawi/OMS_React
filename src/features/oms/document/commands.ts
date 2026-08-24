/**
 * The action bar's grammar (spec 083 D-10, ticket 094): three labelled clusters
 * in order of increasing consequence, plus an unlabelled terminal tier.
 *
 * Pure, and `t` is passed in for the same reason `rail.ts` and `fields.ts` do
 * it: the labels must come from i18n, but reaching for the global `i18n.t` here
 * would bind the rule to module state.
 *
 * **Gating is evidence-only.** There are no state gates in the code to drive a
 * promotion table off, by design — `documentCategory` picks the endpoint and
 * never decides whether a command is *offered*, `deliveryType` gates nothing,
 * and `status` is read only by the rail. So this module gates **only where live
 * data proves a contradiction** (a cancellation request already open, a
 * delivery the server will not take a return against) and leaves everything
 * else static. The server remains the authority on legality and says so in its
 * `400`.
 *
 * **Nothing is ever hidden.** Every command appears on every document; a
 * command that vanishes is a command an operator cannot discover, and a bar
 * whose contents shift between visits cannot be learned.
 */
import type { SdDocumentLineModel } from '@/core/models/sd-document'
import { isDeliveryCategory, type CommandKind, type OpenedAs } from './actions'
import { returnableLines } from './return-order'

/** The three labelled clusters, in reading order. */
export type ClusterId = 'fulfilment' | 'cancel-request' | 'notes'

/**
 * The terminal tier's two members, as a type. Narrowing it (rather than letting
 * the tier be "some `CommandKind`s") is what makes the panel's variant map
 * exhaustive: a third terminal command would fail to compile rather than
 * silently painting as the FILLED red, which is exactly the "two filled reds
 * read as equal alternatives" outcome 072 rejected.
 */
export type TerminalKind = 'force-close' | 'close'

/** One command as the bar renders it. */
export interface CommandState<K extends CommandKind = CommandKind> {
  kind: K
  disabled: boolean
  /**
   * Why it is disabled, for the hover/focus explanation — `null` when the
   * command is takeable, and `null` when it is merely BUSY. A busy command is
   * disabled with no reason: the spinner already reports it, and a tooltip that
   * appears and vanishes with a request is noise, not an explanation.
   */
  reason: string | null
}

/** One labelled cluster. Every cluster holds exactly two commands. */
export interface CommandCluster {
  id: ClusterId
  label: string
  commands: CommandState[]
}

/**
 * The whole bar. `terminal` is deliberately **unlabelled** — a label would make
 * it read as a fourth family rather than as the edge of the bar — and is a
 * *tier, not a commit*: same button height as every cluster button, never
 * enlarged. No command on this screen is a positive outcome, so the promoted
 * commit slot is permanently empty.
 */
export interface CommandBar {
  clusters: CommandCluster[]
  terminal: CommandState<TerminalKind>[]
}

/** What the bar reads off the live document to decide its two gates. */
export interface CommandContext {
  /** `status.closeStatus` — `'R'` means a cancellation request is already open. */
  closeStatus: string | null | undefined
  /** `documentCategory` — half of Return Document's first cause (spec 289 D2). */
  documentCategory: string | null | undefined
  /**
   * Whether the ROUTE opened this as a delivery — the OTHER half of it.
   *
   * ⚠ **Neither field answers it alone.** Delivery `9000000003` is opened as a
   * delivery and carries `documentCategory: 'T'`, so the category alone tells
   * the operator to *open the delivery* they are already looking at; and a
   * plain `'D'` delivery reached through `/oms/document/:documentNo` is a
   * delivery whatever the route says, so the route alone buries the two causes
   * that can actually be acted on. Both must say "not a delivery" before the
   * screen claims there is one to go and open.
   */
  openedAs: OpenedAs
  /**
   * The server's own verdict on whether a bonded return may be created here
   * (BackOffice spec 1283 §2b). **Return Document's `disabled` follows this and
   * nothing else**, and an absent field reads as `false` — the field is not on
   * the wire yet, and the command fails closed until it is.
   */
  canReturn: boolean | null | undefined
  /**
   * The delivery's lines, read ONLY to split `canReturn`'s two folded causes
   * into two reason strings. Never an eligibility input.
   */
  lines: SdDocumentLineModel[] | null | undefined
  /** An action is posting, its follow-up reload is running, or a dialog is open. */
  busy: boolean
}

/** The translator, passed in. Same contract as `rail.ts`'s `TFn`. */
type TFn = (key: string, options?: Record<string, unknown>) => string

/** `closeStatus` code for "cancellation requested". */
const CANCELLATION_REQUESTED = 'R'

/** The cluster membership, in order of increasing consequence (= reading order). */
const CLUSTERS: { id: ClusterId; commands: CommandKind[] }[] = [
  { id: 'fulfilment', commands: ['reschedule', 'change-store'] },
  { id: 'cancel-request', commands: ['request-close', 'cancel-close-request'] },
  { id: 'notes', commands: ['add-note', 'return-document'] },
]

/**
 * The terminal tier: the override first, the sanctioned cancel last, so the end
 * of the bar means exactly one thing — this order stops here.
 */
const TERMINAL: TerminalKind[] = ['force-close', 'close']

/** Normalise a raw server code for comparison. */
function code(value: string | null | undefined): string {
  return (value ?? '').trim().toUpperCase()
}

/**
 * Whether a cancellation request is already open on this document. When it is,
 * **Request Cancellation** is the contradiction and its inverse **Withdraw
 * Request** becomes the cluster's only takeable member — *that is the
 * promotion*. Nothing grows, moves or changes colour.
 */
export function hasOpenCancellationRequest(closeStatus: string | null | undefined): boolean {
  return code(closeStatus) === CANCELLATION_REQUESTED
}

/**
 * Why Return Document cannot be taken on this document, as an i18n KEY, or
 * `null` when it can — the three causes of spec 289 D2, in the order they are
 * checked.
 *
 * ⚠ **`canReturn` is one boolean carrying two of the three causes.** The server
 * folds the store rule and the exhausted-lines rule together, so a `false` on a
 * delivery does not say which. The split below is made off data the screen
 * already holds — every line exhausted → exhaustion, otherwise → the store —
 * and it is a *reason-string* choice, never an eligibility one: `disabled`
 * follows `canReturn` alone, so a wrong split can only mislabel a tooltip and
 * can never offer a command the server would refuse.
 */
export function returnBlockedBecause(ctx: CommandContext): string | null {
  // `canReturn` is asked FIRST and on its own, so the eligibility answer can
  // never come from anything the screen derived. Strictly `true`: absent,
  // `null` and `undefined` all fail closed. Live proof this matters: delivery
  // `9000000003` is opened as a delivery yet carries `documentCategory: 'T'`,
  // so a category pre-check would refuse a return the server had allowed and
  // tell the operator to open the delivery they are already looking at.
  if (ctx.canReturn === true) return null
  // Everything below is a REASON STRING, in the order spec 289 D2 checks them.
  // BOTH signals, and only when both refuse: the category is what spec 289 D2
  // names, and the route is what keeps `9000000003` — category `T`, opened as a
  // delivery — from being told to open the delivery it is already on. An order
  // or an eRx satisfies neither and still gets the sentence that names its way
  // out.
  if (ctx.openedAs !== 'delivery' && !isDeliveryCategory(ctx.documentCategory))
    return 'command.disabled.returnNeedsDelivery'
  const { rows, hiddenCount } = returnableLines(ctx.lines)
  // Exhaustion has to be PROVEN: lines that were all returned. A document whose
  // lines are absent or empty proves nothing, and falls to the store rule.
  return rows.length === 0 && hiddenCount > 0
    ? 'command.disabled.returnNothingLeft'
    : 'command.disabled.returnStarlinksOnly'
}

/**
 * The disabled reason for one command, or `null` when it is takeable.
 * Busy is handled by the caller: it outranks every reason and carries none.
 */
function stateReason(kind: CommandKind, ctx: CommandContext, t: TFn): string | null {
  if (kind === 'request-close' && hasOpenCancellationRequest(ctx.closeStatus)) {
    return t('command.disabled.requestOpen')
  }
  if (kind === 'return-document') {
    const blocked = returnBlockedBecause(ctx)
    return blocked === null ? null : t(blocked)
  }
  return null
}

function state<K extends CommandKind>(kind: K, ctx: CommandContext, t: TFn): CommandState<K> {
  // Busy first, and it carries no reason — the two causes never stack, because
  // a transient state has nothing to explain that the spinner is not already
  // saying in place.
  if (ctx.busy) return { kind, disabled: true, reason: null }
  const reason = stateReason(kind, ctx, t)
  return { kind, disabled: reason !== null, reason }
}

/** The whole bar for one document: three clusters plus the terminal tier. */
export function commandBar(ctx: CommandContext, t: TFn): CommandBar {
  return {
    clusters: CLUSTERS.map(({ id, commands }) => ({
      id,
      label: t(`command.clusters.${id}`),
      commands: commands.map((kind) => state(kind, ctx, t)),
    })),
    terminal: TERMINAL.map((kind) => state(kind, ctx, t)),
  }
}
