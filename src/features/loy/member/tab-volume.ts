/**
 * The tab shell's two pure rules (ticket 236): **which tab is open**, and **what
 * a tab is allowed to say about how much it is showing**.
 *
 * One module rather than two, because both are the shell's and neither is a
 * rendering concern — the components below them are thin renderers, which is the
 * posture spec 083 set and spec 231 kept.
 *
 * 🚩 **The ceiling is always stated, and a bare row count never is.** Two of the
 * three reads are `TOP (n)` with no total and no more-rows flag, so a count reads
 * as completeness on exactly the member where it is a lie. This module therefore
 * hands the renderer **keys and the cap**, and never the row count it was given —
 * the count goes in and only a boolean-shaped decision comes out.
 */

/** The three peer tabs, in the order the strip draws them (227 #7). */
export const MEMBER_TABS = ['activities', 'sales', 'actions'] as const

export type MemberTab = (typeof MEMBER_TABS)[number]

/** Activities is the tab an agent lands on — "what happened to my points" is the
 *  question that brought them here (spec 231, story 25). */
export const DEFAULT_MEMBER_TAB: MemberTab = 'activities'

/**
 * Which tab a `?tab=` value opens. 🚩 **An unknown value falls back to
 * Activities rather than erroring** — a link is a thing a colleague pasted, and a
 * screen that refuses to render because a query param was mistyped fails the
 * agent over a detail that costs them nothing to ignore.
 */
export function resolveTab(param: string | null | undefined): MemberTab {
  return MEMBER_TABS.includes(param as MemberTab) ? (param as MemberTab) : DEFAULT_MEMBER_TAB
}

/** The two capped reads and their hard ceilings, read off the report SQL
 *  (`TOP (100)` / `TOP (500)`, 223 §2–3) rather than chosen here. */
export const TAB_CAPS = { activities: 100, sales: 500 } as const

export type CappedTab = keyof typeof TAB_CAPS

/**
 * What a capped tab says above its grid. `cap` is the **only** number here: the
 * caption names the ceiling, the warning says the window may be partial, and the
 * row count that decided the warning is deliberately not carried out of this
 * module.
 */
export interface CappedVolume {
  /** The sentence naming the ceiling. Interpolates `{{cap}}`. */
  captionKey: string
  cap: number
  /** The at-cap warning, or `null` below the cap. */
  warningKey: string | null
}

/**
 * The caption and the warning for a capped tab.
 *
 * 🚩 **The warning fires when the returned count reaches the cap.** At exactly
 * 100 rows that is a harmless false positive — the member may have exactly 100
 * activities. Staying silent would be a false **negative** on a 4,000-row member,
 * which is the failure that matters, so the asymmetry is the decision (226 §6).
 *
 * `>=` rather than `===` is not defensive noise either: a report that ever
 * returns more than its `TOP (n)` is a window even more partial than the cap
 * claims, and `===` would go quiet on precisely that row set.
 */
export function cappedVolume(tab: CappedTab, rowCount: number): CappedVolume {
  const cap = TAB_CAPS[tab]
  return {
    captionKey: `tabs.${tab}.caption`,
    cap,
    warningKey: rowCount >= cap ? `tabs.${tab}.atCap` : null,
  }
}

/**
 * What the **counted** tab says instead. Actions is the one read with a real
 * `recordsCount`, so it states a true total and 🚩 **never a ceiling and never a
 * warning** — the contrast is what tells an agent the other two tabs are windows
 * (spec 231 §8). Consumed by [238](../../../../.issues/238-actions-pages-through-a-real-total.md).
 */
export interface CountedVolume {
  captionKey: string
  total: number
}

export function countedVolume(total: number): CountedVolume {
  return { captionKey: 'tabs.actions.caption', total }
}
