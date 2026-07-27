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
