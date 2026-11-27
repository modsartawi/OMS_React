/**
 * The simulator's tabs under the plans (spec 4354 §19). The strip is laid by the orchestrator so the tickets that fill
 * it can work in parallel; each tab's panel is registered in `./SimulatorTabs` (`TAB_PANELS`) by the ticket that builds
 * it: 964 `map`, 965 `why` and `used`, 966 `solver`. A tab with no panel yet says so in its own words.
 */
export const SIMULATOR_TABS = ['map', 'why', 'used', 'solver'] as const
export type SimulatorTab = (typeof SIMULATOR_TABS)[number]
