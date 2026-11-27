/**
 * The planner-data screens' server calls (ticket 968, BackOffice spec 4354 §19; doors BO 4361, 4362, 4375 — "doors to
 * list and change each table", all unbuilt: every drive stubs exactly this wire).
 *
 * Through `@/core/api` (`api-envelope`): the envelope, the error taxonomy and 401 are its.
 *
 * 🚩 PROVISIONAL (spec 4354: not specified) — every path below (`SourcingAdvisor/Planner/<Table>`, `/History`, `/Add`,
 * `/Change`, `/End`, `/Choices`), every query name and every reply field. The three server tickets name each table's
 * content and none of its doors. Reconcile as built.
 */
import { api } from '@/core/api'
import type {
  PlannerAddRequest,
  PlannerChangeRequest,
  PlannerChoicesReply,
  PlannerEndRequest,
  PlannerHistoryReply,
  PlannerRow,
  PlannerTableKey,
  PlannerTableReply,
} from '@/core/models/sourcing-planner'

/** Each table's door segment. PROVISIONAL (spec 4354: not specified). */
export const PLANNER_DOORS: Record<PlannerTableKey, string> = {
  overrides: 'BufferOverrides',
  confidence: 'StockConfidence',
  rules: 'ProductRules',
  restricted: 'RestrictedList',
  bulky: 'BulkyList',
  storeModes: 'StoreModes',
  contracts: 'CarrierContracts',
  slots: 'SlotRules',
}

const door = (table: PlannerTableKey, verb?: string) => `SourcingAdvisor/Planner/${PLANNER_DOORS[table]}${verb ? `/${verb}` : ''}`

export const sourcingPlannerApi = {
  /** `GET SourcingAdvisor/Planner/<Table>?withEnded=` — the rows in force (and, asked, the rows ended with no successor). */
  rows(table: PlannerTableKey, withEnded: boolean): Promise<PlannerTableReply> {
    // PROVISIONAL (spec 4354: not specified)
    return api.get<PlannerTableReply>(door(table), { withEnded: withEnded ? 'true' : null })
  },
  /** `GET SourcingAdvisor/Planner/<Table>/History?rowId=` — every version of one row and the changes that wrote them. */
  history(table: PlannerTableKey, rowId: string): Promise<PlannerHistoryReply> {
    // PROVISIONAL (spec 4354: not specified)
    return api.get<PlannerHistoryReply>(door(table, 'History'), { rowId })
  },
  /** `POST SourcingAdvisor/Planner/<Table>/Add`. */
  add(table: PlannerTableKey, body: PlannerAddRequest): Promise<PlannerRow> {
    // PROVISIONAL (spec 4354: not specified)
    return api.post<PlannerRow>(door(table, 'Add'), body)
  },
  /** `POST SourcingAdvisor/Planner/<Table>/Change` — never in place: the server ends the row and writes a new one. */
  change(table: PlannerTableKey, body: PlannerChangeRequest): Promise<PlannerRow> {
    // PROVISIONAL (spec 4354: not specified)
    return api.post<PlannerRow>(door(table, 'Change'), body)
  },
  /** `POST SourcingAdvisor/Planner/<Table>/End`. */
  end(table: PlannerTableKey, body: PlannerEndRequest): Promise<PlannerRow> {
    // PROVISIONAL (spec 4354: not specified)
    return api.post<PlannerRow>(door(table, 'End'), body)
  },
  /** `GET SourcingAdvisor/Planner/Choices` — the stores, categories and sub-categories the forms pick from. */
  choices(): Promise<PlannerChoicesReply> {
    // PROVISIONAL (spec 4354: not specified)
    return api.get<PlannerChoicesReply>('SourcingAdvisor/Planner/Choices')
  },
}

export const plannerKeys = {
  all: ['sourcing-planner'] as const,
  table: (table: PlannerTableKey) => ['sourcing-planner', 'table', table] as const,
  rows: (table: PlannerTableKey, withEnded: boolean) => ['sourcing-planner', 'table', table, 'rows', withEnded] as const,
  history: (table: PlannerTableKey, rowId: string) => ['sourcing-planner', 'table', table, 'history', rowId] as const,
  choices: ['sourcing-planner', 'choices'] as const,
}
