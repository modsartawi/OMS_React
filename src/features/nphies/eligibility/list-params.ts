/**
 * The eligibility list's criteria, its **visible window**, and the query they
 * become (ticket 212, contract v1.0 §3.3).
 *
 * Pure: no React, no i18n, no network, no `Date.now()` — every function that
 * needs today takes it as an argument, so the default window is testable rather
 * than only observable. This is the seam ticket 212's first three Proof bullets
 * are written against, and it is where the one rule the client genuinely owns
 * lives: **what the window is, and what happens when the agent removes it.**
 *
 * Why the window is the point. The underlying read is an unordered
 * `Take(20000)`, so a list with a silent window reads as *"that's everything"*.
 * Making it a removable chip is what lets an agent tell the difference between
 * *that's everything* and *that's everything this week*, and widen it on purpose.
 */

/** The applied date window, inclusive at both ends. `''` on a bound means that
 *  half is open — the agent widened in one direction only. */
export interface EligibilityListWindow {
  /** ISO `yyyy-MM-dd`, what a native date input speaks. */
  fromDate: string
  toDate: string
}

/**
 * Everything the list is filtered by. Five filters (the ticket's own list, minus
 * one — see below) plus the window and the page.
 *
 * 🚩 **No `preAuthRef`.** The ticket names a preauth-reference filter, but §3.3's
 * eligibility query string has no such parameter: `preAuthRef` is on the
 * *authorization* list, and upstream `GetEligibilityResponses` has no field to
 * match it against — an eligibility check has no preauthorization reference,
 * because no authorization has been raised yet. Sending one would be inventing a
 * server shape. It belongs to 214. Logged in `.afk/HITL-212.md`.
 */
export interface EligibilityListCriteria {
  patientId: string
  payerCode: string
  /**
   * `''` = **all providers**, and that is the default (§3.3, spec 209 story 8) —
   * deliberately the opposite of the till, which is pinned to its own store. Note
   * what follows: the provider filter does *not* narrow the underlying read. The
   * window and the patient/status filters are what do.
   */
  providerCode: string
  /** `''` = any. Otherwise a `RequestState` (`@/core/nphies/status`). */
  request: string
  /** `''` = any. Otherwise an `EligibilityVerdict`. Independent of `request`. */
  verdict: string
  /** `null` = **the chip was removed** — no window at all, not a wider one. */
  window: EligibilityListWindow | null
  /** 1-based. A field of the criteria rather than separate state, so a new filter
   *  necessarily builds a fresh query at page 1 (the Ua Users precedent, 148). */
  page: number
}

/**
 * The page size. Not configurable: the list is a scan surface, and the contract
 * gives no size vocabulary to negotiate with. 50 matches the Ua Users grid, the
 * repo's only other server-paged list.
 */
export const ELIGIBILITY_PAGE_SIZE = 50

/** How many days back the default window reaches (ticket 212: "the last 7 days"). */
export const DEFAULT_WINDOW_DAYS = 7

/** Local-calendar `yyyy-MM-dd`. Deliberately not `toISOString()`, which would
 *  shift the boundary by the UTC offset and open the window on the wrong day for
 *  an agent in Riyadh. */
export function isoDate(day: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}`
}

/**
 * The window the screen opens on: seven calendar days ending today, **inclusive
 * at both ends** — so `today - 6` … `today` and not `today - 7`.
 *
 * The off-by-one matters because the chip says the number out loud: an eight-day
 * span under the words "Last 7 days" is a small version of exactly the lie this
 * ticket exists to remove. Upstream makes `toDate` exclusive by adding a day
 * (`EligibilityService.cs:996`), so "today" really does include today's checks.
 */
export function lastSevenDays(today: Date): EligibilityListWindow {
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
export function isDefaultWindow(window: EligibilityListWindow | null, today: Date): boolean {
  if (!window) return false
  const week = lastSevenDays(today)
  return window.fromDate === week.fromDate && window.toDate === week.toDate
}

/** The criteria the list opens on — the window, and nothing else narrowed. */
export function defaultEligibilityCriteria(today: Date): EligibilityListCriteria {
  return {
    patientId: '',
    payerCode: '',
    // All providers. There is no code anywhere that seeds this from the acting
    // store — that would be the till's rule on a back-office screen.
    providerCode: '',
    request: '',
    verdict: '',
    window: lastSevenDays(today),
    page: 1,
  }
}

/**
 * Move one bound of the window, from a date input.
 *
 * Clearing **both** bounds collapses to `null` — the same state the chip's ✕
 * produces, so there is one representation of "no window" rather than two that
 * would build different queries.
 */
export function setWindowBound(
  window: EligibilityListWindow | null,
  bound: keyof EligibilityListWindow,
  value: string,
): EligibilityListWindow | null {
  const next: EligibilityListWindow = {
    fromDate: window?.fromDate ?? '',
    toDate: window?.toDate ?? '',
    [bound]: value,
  }
  return next.fromDate === '' && next.toDate === '' ? null : next
}

/**
 * Criteria → the `GET Nphies/EligibilityResponses` query (§3.3).
 *
 * 🚩 **`showAll` is always `true`, and it is not a preference.** Upstream reads
 * `if (!showAll) query = query.Where(c => c.IsEligible)`
 * (`EligibilityService.cs:976`) — so without it a *not eligible* check, a *not in
 * force* one and every failed request are invisible, and the screen whose whole
 * subject is "what did the payer say" would only ever show the yeses. The
 * contract flags this trap on the authorization list; it is worse here, because
 * the eligibility filter is on the verdict itself.
 *
 * 🚩 **Removing the chip drops the window, it does not widen it.** No `fromDate`,
 * no `toDate`, no substituted larger range: the agent asked for everything and
 * the query says so. (⚠️ Upstream *defaults* a null `fromDate` to three days ago
 * — `:985`. SIS.Api re-models this read and owns that default; a re-model that
 * fell through to the upstream's would silently give a removed chip a window four
 * times narrower than the one it removed. Named in `.afk/HITL-212.md` and in the
 * server ticket's terms.)
 *
 * Empty strings are dropped rather than sent blank — matching `buildQuery`'s own
 * contract in `@/core/api`, which would drop them anyway; omitting them here
 * keeps the object honest for the test that asserts it.
 *
 * No `sort` is sent. §3.3 lists the parameter but names no vocabulary for its
 * value, this slice ships no sort control, and "newest first" is the re-modelled
 * endpoint's stated default — so inventing a token here would be inventing a
 * server shape for no behaviour.
 */
export function buildEligibilityListParams(
  criteria: EligibilityListCriteria,
): Record<string, unknown> {
  const params: Record<string, unknown> = {
    showAll: true,
    page: Math.max(1, Math.floor(criteria.page) || 1),
    pageSize: ELIGIBILITY_PAGE_SIZE,
  }

  const put = (key: string, raw: string) => {
    const value = raw.trim()
    if (value !== '') params[key] = value
  }

  if (criteria.window) {
    put('fromDate', criteria.window.fromDate)
    put('toDate', criteria.window.toDate)
  }
  put('patientId', criteria.patientId)
  put('payerCode', criteria.payerCode)
  put('providerCode', criteria.providerCode)
  // The two axes narrow independently: a Verdict filter with no Request filter is
  // a legal question ("show me everyone the payer refused"), and so is the
  // reverse ("show me what never got an answer").
  put('request', criteria.request)
  put('verdict', criteria.verdict)

  return params
}

/**
 * How many pages a total spans. An empty result is one (empty) page, not zero —
 * "Page 1 of 0" is not a thing a footer should be able to read.
 */
export function pageCountFor(total: number, pageSize = ELIGIBILITY_PAGE_SIZE): number {
  return Math.max(1, Math.ceil(Math.max(0, total) / Math.max(1, pageSize)))
}

/**
 * Which of Previous / Next is live. Unlike the Ua Users pager there is no
 * `isCapped` guess to make: this envelope carries the true `total`, so the last
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
