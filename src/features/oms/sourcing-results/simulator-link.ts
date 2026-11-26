/**
 * Where "Open the stored run in the simulator" goes (ticket 971, results ticket decision 5).
 *
 * TODO(962 merge): use the core simulator link. Ticket 962 puts the simulator's route path and its link helper in
 * `src/core/`; it was not on this branch's base, so the path below is this ticket's guess and the one place to change.
 * PROVISIONAL (spec 4354: not specified) — the route and its `run` parameter.
 */
export const storedRunInSimulator = (runId: string): string => `/oms/sourcing-simulator?run=${encodeURIComponent(runId)}`
