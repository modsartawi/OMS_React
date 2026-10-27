// The draft and approval doors of the CATEGORY and COVERAGE rulesets as BUILT (BackOffice 3145 / 3146: "the guard
// document's doors over the category / coverage document", 3139's shapes; oms 617). Under
// `InsuranceRules/{Categories|Coverage}`, cookie session, `BackOfficeScreen[InsuranceRuleAuthoring, 02 author | 03
// reader | 06 approver]`:
//   GET  …/Draft → `RulesetDraft` (state none = no draft: `document` is the newest published one at revision 0);
//   PUT  …/Draft (body = the document, its root `revision` the draft's) → the draft at the next revision;
//        409 `GUARDS_DRAFT_STALE`, 409 `GUARDS_DRAFT_PENDING` while submitted;
//   POST …/Validate (body = a document) → issues;
//   POST …/Submit `{ revision, note }` → the draft (no back-test for these documents);
//   POST …/Approve `{ revision, note }` → the version; POST …/SendBack `{ note }` → the draft;
//        403 `GUARDS_SELF_APPROVAL` for whoever submitted or last edited it, 409 `GUARDS_DRAFT_NOT_PENDING`;
//   GET  …/Versions → newest first; POST …/Versions/{v}/Restore → a new draft (409 `GUARDS_DRAFT_EXISTS`).
// An approved category / coverage document publishes LIVE: no shadow state per rule, no promote, no back-test.
// No access probe yet: actions follow the draft's state and the user; HQ refuses a missing grant.
import { api } from '@/core/api'
import type { GuardIssue } from './checks'

export type RulesetDoorKind = 'Categories' | 'Coverage'

/** Where the draft stands: none (nothing to approve), editing, pending (asked for approval), sentBack. */
export type DraftState = 'none' | 'editing' | 'pending' | 'sentBack'

export interface RulesetDraft<T> {
  revision: number
  state: DraftState
  /** `restore:v` when a version was restored into it. */
  origin: string | null
  baseVersionNo: number | null
  updatedBy: string | null
  /** Local moment. */
  updatedAt: string | null
  requestedBy: string | null
  requestedAt: string | null
  requestNote: string | null
  reviewedBy: string | null
  reviewNote: string | null
  document: T
}

/** `GET …/Versions` row and the Approve reply. */
export interface RulesetVersionRow {
  versionNo: number
  publishedAt: string
  publishedBy: string
  requestedBy: string | null
  action: 'approve' | 'promote' | ''
  note: string | null
}

export const DRAFT_STALE = 'GUARDS_DRAFT_STALE'
export const DRAFT_PENDING = 'GUARDS_DRAFT_PENDING'

/** The document the editor holds, stamped with the draft's revision (the PUT's root `revision`). */
export const draftDocument = <T extends { revision: number }>(d: RulesetDraft<T>): T => ({ ...d.document, revision: d.revision })

export function rulesetDoors<T extends { revision: number }>(kind: RulesetDoorKind) {
  const base = `InsuranceRules/${kind}`
  return {
    draft: (): Promise<RulesetDraft<T>> => api.get<RulesetDraft<T>>(`${base}/Draft`),
    save: (doc: T): Promise<RulesetDraft<T>> => api.put<RulesetDraft<T>>(`${base}/Draft`, doc),
    validate: async (doc: T): Promise<GuardIssue[]> => (await api.post<GuardIssue[] | null>(`${base}/Validate`, doc)) ?? [],
    submit: (revision: number, note: string): Promise<RulesetDraft<T>> => api.post<RulesetDraft<T>>(`${base}/Submit`, { revision, note }),
    approve: (revision: number, note: string): Promise<RulesetVersionRow> => api.post<RulesetVersionRow>(`${base}/Approve`, { revision, note }),
    sendBack: (note: string): Promise<RulesetDraft<T>> => api.post<RulesetDraft<T>>(`${base}/SendBack`, { note }),
    versions: async (): Promise<RulesetVersionRow[]> => (await api.get<RulesetVersionRow[] | null>(`${base}/Versions`)) ?? [],
    restore: (v: number): Promise<RulesetDraft<T>> => api.post<RulesetDraft<T>>(`${base}/Versions/${v}/Restore`, {}),
  }
}

export type RulesetSubmitWhy = 'unsaved' | 'checking' | 'checks'
export type RulesetAction =
  | { kind: 'submit'; enabled: boolean; why: RulesetSubmitWhy | null }
  | { kind: 'approve' | 'sendBack'; enabled: boolean; why: 'ownSubmission' | null }

const same = (a: string | null | undefined, b: string | null | undefined) => !!a && !!b && a.toLowerCase() === b.toLowerCase()

/** What the session may do with the draft: ask for approval of the SAVED revision, or approve / send it back. */
export function rulesetActions({
  draft,
  userId,
  checks,
  dirty = false,
}: {
  draft: Pick<RulesetDraft<unknown>, 'state' | 'requestedBy' | 'updatedBy'>
  userId: string | null
  /** `checksVerdict` of HQ's Validate on the saved revision; null while it is asked. */
  checks: { errors: number; warnings: number; blocked: boolean } | null
  dirty?: boolean
}): RulesetAction[] {
  if (draft.state === 'none') return []
  if (draft.state === 'pending') {
    const own = !userId || same(userId, draft.requestedBy) || same(userId, draft.updatedBy)
    const why = own ? ('ownSubmission' as const) : null
    return [
      { kind: 'approve', enabled: !own, why },
      { kind: 'sendBack', enabled: !own, why },
    ]
  }
  const why: RulesetSubmitWhy | null = dirty ? 'unsaved' : !checks ? 'checking' : checks.blocked ? 'checks' : null
  return [{ kind: 'submit', enabled: why === null, why }]
}
