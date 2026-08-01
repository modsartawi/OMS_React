/**
 * The **visible window** and the server pager that both Nphies lists share
 * (contract v1.0 §3.3, tickets 212 + 214).
 *
 * It lives in `core/` for the same reason the two status axes do: the
 * authorization list (214) opens on the same seven days, states them in the same
 * removable chip and pages the same envelope as the eligibility list (212), and a
 * feature may never import another feature
 * (`.claude/rules/feature-structure.md`). Copying the window into the second list
 * would put the one rule this pair of screens genuinely owns in two places, where
 * the two could disagree about what "last 7 days" means.
 *
 * Pure: no React, no i18n, no network, no `Date.now()` — every function that
 * needs today takes it as an argument, so the default window is testable rather
 * than only observable.
 *
 * Why the window is the point. Both underlying reads are an unordered
 * `Take(20000)`, so a list with a silent window reads as *"that's everything"*.
 * Making it a removable chip is what lets an agent tell the difference between
 * *that's everything* and *that's everything this week*, and widen it on purpose.
 */

/** The applied date window, inclusive at both ends. `''` on a bound means that
 *  half is open — the agent widened in one direction only. */
export interface NphiesListWindow {
  /** ISO `yyyy-MM-dd`, what a native date input speaks. */
  fromDate: string
  toDate: string
}

/**
 * The page size for both lists. Not configurable: they are scan surfaces, and the
 * contract gives no size vocabulary to negotiate with. 50 matches the Ua Users
 * grid, the repo's only other server-paged list.
 */
export const NPHIES_PAGE_SIZE = 50

/** How many days back the default window reaches ("the last 7 days"). */
export const DEFAULT_WINDOW_DAYS = 7

/** Local-calendar `yyyy-MM-dd`. Deliberately not `toISOString()`, which would
 *  shift the boundary by the UTC offset and open the window on the wrong day for
 *  an agent in Riyadh. */
export function isoDate(day: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}`
}

/**
 * The window both screens open on: seven calendar days ending today, **inclusive
 * at both ends** — so `today - 6` … `today` and not `today - 7`.
 *
 * The off-by-one matters because the chip says the number out loud: an eight-day
 * span under the words "Last 7 days" is a small version of exactly the lie the
 * chip exists to remove. Upstream makes `toDate` exclusive by adding a day
 * (`EligibilityService.cs:996`, `AuthService.cs:1396`), so "today" really does
 * include today's work on both lists.
 */
export function lastSevenDays(today: Date): NphiesListWindow {
  const from = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate() - (DEFAULT_WINDOW_DAYS - 1),
  )
  return { fromDate: isoDate(from), toDate: isoDate(today) }
}

/**
 * Is this window still the one the screen opened on?
 *
 * What it is for: the chip must not keep saying *"Last 7 days"* over a window the
 * agent has widened to seven months. The chip states the dates honestly either
 * way; this is what stops it stating the **span** dishonestly.
 */
export function isDefaultWindow(window: NphiesListWindow | null, today: Date): boolean {
  if (!window) return false
  const week = lastSevenDays(today)
  return window.fromDate === week.fromDate && window.toDate === week.toDate
}

/**
 * Move one bound of the window, from a date input.
 *
 * Clearing **both** bounds collapses to `null` — the same state the chip's ✕
 * produces, so there is one representation of "no window" rather than two that
 * would build different queries.
 */
export function setWindowBound(
  window: NphiesListWindow | null,
  bound: keyof NphiesListWindow,
  value: string,
): NphiesListWindow | null {
  const next: NphiesListWindow = {
    fromDate: window?.fromDate ?? '',
    toDate: window?.toDate ?? '',
    [bound]: value,
  }
  return next.fromDate === '' && next.toDate === '' ? null : next
}

/**
 * Put a window's bounds into an already-built query, dropping an empty one.
 *
 * 🚩 **Removing the chip drops the window, it does not widen it.** No `fromDate`,
 * no `toDate`, no substituted larger range: the agent asked for everything and the
 * query says so. (⚠️ Upstream *defaults* a null `fromDate` to three days ago —
 * `EligibilityService.cs:985`, `AuthService.cs:1384`. SIS.Api re-models both reads
 * and owns that default; a re-model that fell through to the upstream's would
 * silently give a removed chip a window four times narrower than the one it
 * removed. Named in `.afk/HITL-212.md` in the server's own terms, and it applies
 * to the authorization list identically.)
 */
export function putWindow(params: Record<string, unknown>, window: NphiesListWindow | null): void {
  if (!window) return
  if (window.fromDate.trim() !== '') params.fromDate = window.fromDate.trim()
  if (window.toDate.trim() !== '') params.toDate = window.toDate.trim()
}

/**
 * How many pages a total spans. An empty result is one (empty) page, not zero —
 * "Page 1 of 0" is not a thing a footer should be able to read.
 */
export function pageCountFor(total: number, pageSize = NPHIES_PAGE_SIZE): number {
  return Math.max(1, Math.ceil(Math.max(0, total) / Math.max(1, pageSize)))
}

/**
 * Which of Previous / Next is live. Unlike the Ua Users pager there is no
 * `isCapped` guess to make: both envelopes carry the true `total`, so the last
 * page is arithmetic.
 *
 * It takes an already-counted `pages` rather than a total, because the count has
 * to be made with the page size the **server** served — a server that capped 50
 * to 25 would otherwise leave the tail of the result behind a disabled Next.
 */
export function pagerEnablement(p: { page: number; pages: number }): {
  previous: boolean
  next: boolean
} {
  return { previous: p.page > 1, next: p.page < p.pages }
}
