/**
 * Where the sourcing advisor's simulator lives (ticket 962, BackOffice spec 4354 §19). In `@/core/` because other
 * features link into it and a feature may never import another: the comparison results page (971) opens "the stored
 * run in the simulator", and the old advisor's order route (974) opens the simulator on an order.
 */

/** The simulator's route. */
export const SIMULATOR_PATH = '/oms/sourcing-simulator'

/** The query parameter naming a stored run the simulator opens. */
export const SIMULATOR_RUN_PARAM = 'run'

/**
 * The link that opens a stored run in the simulator (BackOffice 4282: "Open the stored run in the simulator"). Opening
 * a stored run as it was is a read door of the simulator's build, not an advise call (BackOffice 4281 decision 11); that
 * door, and the simulator's reading of this parameter, come with their tickets — 962 builds the link only.
 */
export const simulatorRunPath = (runId: string): string => `${SIMULATOR_PATH}?${new URLSearchParams({ [SIMULATOR_RUN_PARAM]: runId })}`
