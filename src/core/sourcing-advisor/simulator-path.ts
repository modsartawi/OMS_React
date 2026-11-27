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

/** The query parameter naming an order the simulator opens set to replay (ticket 974). */
export const SIMULATOR_REPLAY_PARAM = 'replay'

/**
 * The link that opens the simulator set to replay an order (ticket 974, BackOffice 4397: an old order link with no
 * stored run "offers a replay"). It only sets the replay up: nothing runs until the user presses Run.
 */
export const simulatorReplayPath = (orderNumber: string): string =>
  `${SIMULATOR_PATH}?${new URLSearchParams({ [SIMULATOR_REPLAY_PARAM]: orderNumber })}`

/** The order the simulator's address asks it to replay, trimmed; `''` when none. */
export const replayOrderOf = (params: URLSearchParams): string => (params.get(SIMULATOR_REPLAY_PARAM) ?? '').trim()
