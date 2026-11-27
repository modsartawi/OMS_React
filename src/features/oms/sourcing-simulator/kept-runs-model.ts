/**
 * Kept runs (ticket 969, BackOffice spec 4354 §12, BackOffice 4380). Pure.
 *
 * A user keeps the run on screen under a name; the full record is then stored for good with a link that any holder of
 * the run grant can open, and only its keeper may delete it. The list shows the caller's own kept runs (§12 says
 * nothing of listing another keeper's: those open by their link). The link opens the simulator straight away on the run
 * (owner, on the 969 prototype), which reads it through the stored-run read door (BackOffice 4281 decision 11).
 */
import type { AdviseReply, KeptRun } from '@/core/models/sourcing-run'
import { SIMULATOR_RUN_PARAM, simulatorRunPath } from '@/core/sourcing-advisor/simulator-path'
import type { CartForm } from './cart'
import type { ReplayForm } from './replay'

/** The longest name a kept run takes. PROVISIONAL (spec 4354: not specified) — 80 characters is ours. */
export const KEPT_NAME_MAX = 80

/** The caller's own kept runs, newest first. */
export const keptRunsList = (runs: readonly KeptRun[]): KeptRun[] => runs.filter((r) => r.mine).sort((a, b) => b.keptAt.localeCompare(a.keptAt))

/** Only its keeper may delete a kept run (BackOffice 4380). */
export const canDelete = (run: KeptRun): boolean => run.mine

/** The link to copy: the simulator, opened on the run. */
export const keptRunLink = (runId: string, origin: string): string => `${origin}${simulatorRunPath(runId)}`

/** The stored run the simulator's address names (`?run=`), or null. */
export function runToOpen(search: string | URLSearchParams): string | null {
  const params = typeof search === 'string' ? new URLSearchParams(search) : search
  const id = params.get(SIMULATOR_RUN_PARAM)?.trim() ?? ''
  return id === '' ? null : id
}

/** What the simulator is set to when it opens a stored run: the run's cart, or the order it replayed. */
export type OpenedSetting = { start: 'build'; form: CartForm } | { start: 'replay'; replay: ReplayForm }

/**
 * The stored run's cart or order set back on the left, so the user can run it again. The customer's point is never
 * stored (spec 4354 §12): a cart comes back without it, and a replay plans from the order's own point.
 */
export function openedSetting(record: Pick<AdviseReply, 'kind' | 'orderNumber' | 'channel' | 'plannedFor' | 'lines'>): OpenedSetting {
  if (record.orderNumber) return { start: 'replay', replay: { orderNumber: record.orderNumber, withPoint: false, movedTo: null } }
  return {
    start: 'build',
    form: {
      channel: record.channel,
      time: /^\d{4}-\d{2}-\d{2} (\d{2}:\d{2})/.exec(record.plannedFor ?? '')?.[1] ?? '',
      goodsTotal: '',
      lines: record.lines.map((l, i) => ({ key: i + 1, item: l.item, quantity: String(l.quantity) })),
      lat: '',
      lng: '',
    },
  }
}

/**
 * Whether the run on screen can be kept: a run the door held (a user's for 30 minutes), not one it could not hold
 * (`NOT_HELD`), nor a stored run opened by its link.
 */
export function keepOffer(reply: Pick<AdviseReply, 'held' | 'solve'>, stored: boolean): 'keep' | 'notHeld' | 'stored' {
  if (stored) return 'stored'
  return reply.held && !reply.solve.marks.includes('NOT_HELD') ? 'keep' : 'notHeld'
}

/** What stops a name from being kept. */
export function keepProblem(name: string): 'noName' | 'tooLong' | null {
  const n = name.trim()
  if (n === '') return 'noName'
  return n.length > KEPT_NAME_MAX ? 'tooLong' : null
}
