/**
 * Where the sourcing advisor's simulator lives (ticket 962, BackOffice spec 4354 §19). In `@/core/` because other
 * features link into it and a feature may never import another: the comparison results page (971) opens "the stored
 * run in the simulator", and the old advisor's order route (974) opens the simulator on an order.
 */

/** The simulator's route. */
export const SIMULATOR_PATH = '/oms/sourcing-simulator'

/** The list of the caller's kept runs (ticket 969, BackOffice spec 4354 §12): the simulator's own page. */
export const KEPT_RUNS_PATH = '/oms/sourcing-simulator/kept'

/** The query parameter naming a stored run the simulator opens. */
export const SIMULATOR_RUN_PARAM = 'run'

/**
 * The link that opens a stored run in the simulator (BackOffice 4282: "Open the stored run in the simulator"). Opening
 * a stored run as it was is a read door of the simulator's build, not an advise call (BackOffice 4281 decision 11); that
 * door is the simulator's build: ticket 969 reads this parameter through it (a kept run's link is this link too).
 */
export const simulatorRunPath = (runId: string): string => `${SIMULATOR_PATH}?${new URLSearchParams({ [SIMULATOR_RUN_PARAM]: runId })}`
