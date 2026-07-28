/**
 * The two-phase confirm protocol, as three functions that know nothing about
 * which verb is being confirmed (CONTRACT.md §5).
 *
 * A verb that needs confirmation answers `200` with the **unchanged** state and a
 * `confirmToken`; re-sending the same verb with that token commits exactly what
 * was previewed. Two of the console's actions take that path — the plant rebind
 * ([167](.issues/167-store-move-shows-the-diff.md)) and the below-availability
 * acceptance ([169](.issues/169-below-availability-accepted.md)) — and the
 * discipline they share is not a coincidence to be re-typed per action:
 *
 * 1. 🚩 **One user action keeps one `requestId`** (law 3 / §4), *including* the
 *    re-send that carries the token and the re-send that drops it after
 *    `CONFIRM_TOKEN_STALE`. A fresh id on the confirm would make the server's
 *    ledger see two actions on a verb that mutates a real basket — the
 *    double-apply the ring buffer exists to prevent.
 * 2. **A token is single-use and two-minute**, so a re-preview drops it rather
 *    than carrying a spent one back out.
 *
 * Each action still owns its own shape (what it targets, what it previews). All
 * that lives here is the part that must be identical, so that the second kind of
 * confirmation is a **body** rather than a second mechanism.
 */

/** Anything the console sends through the confirm path: one action's id, and the
 *  token while it is holding one. */
export interface ConfirmableAction {
  /** Minted ONCE, when the agent acts, and never re-minted for that action. */
  requestId: string
  /** The token pinning what was previewed. Absent on the first send, and dropped
   *  again on a re-preview. */
  confirmToken?: string
}

/** The confirm re-send: the same verb, the same id, plus the token (§5). */
export function committing<T extends ConfirmableAction>(action: T, confirmToken: string): T {
  return { ...action, confirmToken }
}

/**
 * 🚩 The `CONFIRM_TOKEN_STALE` / `CONFIRM_TOKEN_INVALID` answer: what was pinned
 * can no longer commit, so the console re-sends **without** the token and shows a
 * fresh preview. It never commits something the agent did not see — and it is
 * still the same action, so it is still the same id.
 */
export function repreviewing<T extends ConfirmableAction>(action: T): T {
  const { confirmToken: _spent, ...rest } = action
  return rest as T
}

/** True while the action is holding a token — i.e. the next send commits. */
export function isCommitting(action: ConfirmableAction | null | undefined): boolean {
  return action?.confirmToken !== undefined
}

/**
 * 🚩 **The acceptance that did nothing** (ticket 177, BackOffice 858).
 *
 * The live server swallows both two-phase commits today: the ask's own claim
 * advances the engine version past the ledger's reservation, so the confirming
 * retry — on the same `requestId`, as law 3 requires — resolves as already-applied
 * and never touches the engine. The agent accepts a below-availability add or a
 * store move, gets a `200`, and nothing happens. Fixtures 04 and 05 record it.
 *
 * The console cannot fix that; it must not be **silent** about it, because
 * silence is the outcome that sends an agent on to quote a price for a line that
 * is not in the basket.
 *
 * 🚩 **`replayed: true` alone is NOT evidence, and reading it as evidence was the
 * first version of this function.** §4's replay means *not re-applied*, which is
 * true of a commit that never landed **and** of one that already had: §6.4's
 * crash-between-2-and-3 resolution is by construction a replay answer over an
 * applied mutation, and a `SESSION_BUSY` retry of a commit reaches it. Nor does
 * the version help — both captures advance it (6→11, 10→15) while applying
 * nothing, because `SaveAsync` blind-increments it (§2.1). Fixture 04 rules out
 * the last tempting shortcut too: its swallowed commit answers
 * `hasBelowAtp: true` over **zero lines**, the sidecar patch having landed where
 * the engine mutation did not.
 *
 * So the caller passes `applied` — *did the thing the agent accepted actually
 * happen, in the projection just returned*. That is verb-specific by nature (a
 * line exists; the plant moved) and it is the only honest question. Getting it
 * wrong the other way would be worse than the silence this replaces: a banner
 * saying *nothing changed* over a basket that did move is a lie the agent would
 * act on.
 *
 * It disappears on its own the day 858 lands — a commit that applies is applied.
 */
export function commitWasSwallowed(
  action: ConfirmableAction | null | undefined,
  state: { replayed?: boolean } | null | undefined,
  /** Whether the projection just returned shows the accepted change. */
  applied: boolean,
): boolean {
  return isCommitting(action) && state?.replayed === true && !applied
}
