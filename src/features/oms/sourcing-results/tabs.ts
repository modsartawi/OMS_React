/**
 * The results page's seven tabs, in the spec's order (spec 4354 §17; results ticket decision 2 as amended by BO 4283).
 * Ticket 971 builds the strip; each tab's panel is registered in `./ResultsTabs` (`TAB_PANELS`) by the ticket that
 * builds it: 972 the first five, 973 Trials and Phase 2 bar. A tab with no panel yet says so in its own words.
 */
export const RESULTS_TABS = ['breakdowns', 'outside-rules', 'checks', 'later-slots', 'not-run', 'trials', 'phase-2-bar'] as const
export type ResultsTab = (typeof RESULTS_TABS)[number]
