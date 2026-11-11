/**
 * The insurance-rules doors more than one feature reads (BackOffice spec 3126; doors 3139). The guard
 * ruleset is ONE document (`GET / PUT InsuranceRules/Guards/Draft`, with `revision`; a stale PUT is a 409):
 * the rule page (607), the editor (608), templates (609), item lists (610) and approval (611) all read it,
 * and a feature may not import another, so its read lives here. Each feature keeps its OWN doors in its
 * own `api.ts` (the Guards list's `GET InsuranceRules/Guards` is `features/insurance-rules/guards/api`).
 *
 * ⚠️ Stubbed until oms 618: no door here has met a real SIS.Api. `tools/insurance-rules-stubs.mjs` serves
 * the brief's shapes; a spelling a BackOffice ticket changes is recorded in the brief and reconciled in 618.
 * No access probe yet — the doors answer a session without the grant a bare 403 (618 adds the probe).
 */
import { api } from '@/core/api'
import type { DraftApproval } from './approval'
import type { GuardIssue } from './checks'
import type { GuardRuleset } from './model'

export const INSURANCE_RULES_BASE = 'InsuranceRules'

export const insuranceRulesApi = {
  /** `GET InsuranceRules/Guards/Draft` — the whole guard ruleset with its `revision`. */
  guardDraft(): Promise<GuardRuleset> {
    return rulesetDraftDoors<GuardRuleset>('Guards').read()
  },
  /** `PUT InsuranceRules/Guards/Draft` (608) — the whole document; see `rulesetDraftDoors`. */
  saveGuardDraft(doc: GuardRuleset): Promise<GuardRuleset> {
    return rulesetDraftDoors<GuardRuleset>('Guards').save(doc)
  },
  /** `POST InsuranceRules/Guards/Validate` (608) — see `rulesetDraftDoors`. */
  validateGuardDraft(doc: GuardRuleset): Promise<GuardIssue[]> {
    return rulesetDraftDoors<GuardRuleset>('Guards').validate(doc)
  },
}

/** The refusal code of a PUT whose `revision` is stale (409, BackOffice 3139). */
export const STALE_REVISION = 'GUARDS_DRAFT_STALE'

/**
 * Every draft reply (BackOffice 3139; the category and coverage documents' doors are the same, 3145/3146):
 * the draft's standing around its document. With no draft, `state: none` and `document` is the newest
 * published one at `revision: 0`.
 */
interface DraftEnvelope<T> {
  revision: number
  state: 'none' | 'editing' | 'pending' | 'sentBack'
  origin: string | null
  baseVersionNo: number | null
  updatedBy: string | null
  updatedAt: string | null
  requestedBy: string | null
  requestedAt: string | null
  requestNote: string | null
  reviewedBy: string | null
  reviewNote: string | null
  document: T
}

/** The document the screens edit: the envelope's, at the envelope's revision (a document may leave `lists` out). */
const draftDocument = <T extends { revision: number }>(e: DraftEnvelope<T>): T => ({ lists: [], ...e.document, revision: e.revision })

/** Where the draft stands. No access probe exists yet, so both actions show and HQ refuses a user without the grant. */
const draftStanding = (e: DraftEnvelope<unknown>, backtestId: string | null): DraftApproval => ({
  revision: e.revision,
  state: e.state === 'pending' ? 'waiting' : 'draft',
  submittedBy: e.state === 'pending' ? e.requestedBy : null,
  submittedAt: e.state === 'pending' ? e.requestedAt : null,
  note: e.state === 'pending' ? e.requestNote : null,
  sentBack: e.state === 'sentBack' && e.reviewedBy ? { by: e.reviewedBy, at: e.updatedAt ?? '', note: e.reviewNote ?? '' } : null,
  backtestId,
  viewer: { author: true, approver: true },
})

/**
 * The draft doors every insurance ruleset shares (oms 608): the guard ruleset under `Guards`, and the category
 * and coverage rulesets under `Categories` / `Coverage` (617; "the same authoring doors"). The draft is saved
 * WHOLE: the PUT carries the `revision` it was read at, and a stale one is answered 409 (`apiErrorCode`
 * `STALE_REVISION`, or read the status: `ApiError.statusCode === 409`).
 *
 * ⚠️ PROVISIONAL (608), 618 reconciles: the PUT is read as answering the saved document with its new revision,
 * and Validate as taking the draft document as it is on screen (body unspelled in the brief) and answering
 * `[{ ruleId, blockPath, field, severity, en, ar }]`.
 */
export function rulesetDraftDoors<T extends { revision: number }>(kind: 'Guards' | 'Categories' | 'Coverage') {
  const base = `${INSURANCE_RULES_BASE}/${kind}`
  return {
    read: async (): Promise<T> => draftDocument(await api.get<DraftEnvelope<T>>(`${base}/Draft`)),
    save: async (doc: T): Promise<T> => draftDocument(await api.put<DraftEnvelope<T>>(`${base}/Draft`, doc)),
    validate: async (doc: T): Promise<GuardIssue[]> => (await api.post<GuardIssue[] | null>(`${base}/Validate`, doc)) ?? [],
  }
}

/** `GET …/Versions`' row as HQ spells it (3139). */
interface WireVersion {
  versionNo: number
  publishedAt: string
  publishedBy: string
  requestedBy: string | null
  action: 'approve' | 'promote' | ''
  note: string | null
}

/** One published version of a ruleset: who, when, note. */
export interface RulesetVersion {
  version: number
  by: string
  /** Local moment. */
  at: string
  note: string | null
}

/**
 * The approval doors every insurance ruleset shares (611 for the guards; review 3126 P6b for the category and
 * coverage rulesets on "the same authoring doors"): where the draft stands (PROVISIONAL `GET …/Approval`), Submit /
 * Approve / SendBack `{ note }` answering it again, the versions newest first, and Restore making a NEW draft.
 */
export function rulesetApprovalDoors<T extends { revision: number }>(kind: 'Guards' | 'Categories' | 'Coverage') {
  const base = `${INSURANCE_RULES_BASE}/${kind}`
  // Only the guard ruleset is back-tested (3140); its back-tests list newest first.
  const latestBacktest = async (): Promise<string | null> =>
    kind === 'Guards' ? ((await api.get<{ id: string }[] | null>(`${base}/Backtests`)) ?? [])[0]?.id ?? null : null
  const approval = async (): Promise<DraftApproval> => {
    const [draft, backtestId] = await Promise.all([api.get<DraftEnvelope<unknown>>(`${base}/Draft`), latestBacktest()])
    return draftStanding(draft, backtestId)
  }
  const standingAfter = async (e: DraftEnvelope<unknown>): Promise<DraftApproval> => draftStanding(e, await latestBacktest())
  return {
    approval,
    submit: async (note: string): Promise<DraftApproval> => standingAfter(await api.post<DraftEnvelope<unknown>>(`${base}/Submit`, { note })),
    // Approve answers the published version, not the draft: the standing is read again.
    approve: async (note: string): Promise<DraftApproval> => {
      await api.post<unknown>(`${base}/Approve`, { note })
      return approval()
    },
    sendBack: async (note: string): Promise<DraftApproval> => standingAfter(await api.post<DraftEnvelope<unknown>>(`${base}/SendBack`, { note })),
    versions: async (): Promise<RulesetVersion[]> =>
      ((await api.get<WireVersion[] | null>(`${base}/Versions`)) ?? []).map((v) => ({ version: v.versionNo, by: v.publishedBy, at: v.publishedAt, note: v.note || null })),
    restore: async (version: number): Promise<T> => draftDocument(await api.post<DraftEnvelope<T>>(`${base}/Versions/${version}/Restore`, {})),
  }
}

/** Every insurance-rules query key starts here, so a write can invalidate the area at once. */
export const INSURANCE_RULES_KEY = ['insurance-rules'] as const
/** The guard draft's key; 608's save, 609's create from template and 611's restore invalidate it. */
export const GUARD_DRAFT_KEY = [...INSURANCE_RULES_KEY, 'guards', 'draft'] as const

export function guardDraftQuery() {
  return { queryKey: GUARD_DRAFT_KEY, queryFn: () => insuranceRulesApi.guardDraft(), retry: false } as const
}
