/**
 * The insurance-rules doors more than one feature reads (BackOffice spec 3126; doors 3139). The guard
 * ruleset is ONE document (`GET / PUT InsuranceRules/Guards/Draft`, with `revision`; a stale PUT is a 409):
 * the rule page (607), the editor (608), templates (609), item lists (610) and approval (611) all read it,
 * and a feature may not import another, so its read lives here. Each feature keeps its OWN doors in its
 * own `api.ts` (the Guards list's `GET InsuranceRules/Guards` is `features/insurance-rules/guards/api`).
 *
 * As BUILT (oms 618 reconciled 3139): `GET …/Draft` answers the DRAFT — `{ revision, state: none|editing|pending|
 * sentBack, origin, baseVersionNo, updatedBy/At, requestedBy/At, requestNote, reviewedBy, reviewNote, document,
 * warnings }` (no draft: `state: none`, the newest published document at revision 0); a PUT's body is the document
 * itself, answered with the draft at the next revision. The document travels in the engine's spelling and is read
 * through `./guard-wire` into the editor's model. ONE cache entry holds the draft (`GUARD_DRAFT_KEY`):
 * `guardDraftQuery` selects its document, `guardDraftStateQuery` the whole draft (611's approval panel).
 *
 * No access probe: BackOffice has no insurance-rules grant probe yet (618's list for the coordinator), so a session
 * without the grant is answered a bare 403 by each door.
 */
import type { GuardIssue } from './checks'
import type { GuardRuleset } from './model'
import { rulesetDoors, type RulesetDraft } from './ruleset-draft'

export const INSURANCE_RULES_BASE = 'InsuranceRules'

const guardDoors = () => rulesetDoors<GuardRuleset>('Guards')

export const insuranceRulesApi = {
  /** `GET InsuranceRules/Guards/Draft` — the draft, its document in the editor's model. */
  guardDraft(): Promise<RulesetDraft<GuardRuleset>> {
    return guardDoors().draft()
  },
  /** `PUT InsuranceRules/Guards/Draft` (608) — the whole document; answers the draft at its next revision. */
  saveGuardDraft(doc: GuardRuleset): Promise<RulesetDraft<GuardRuleset>> {
    return guardDoors().save(doc)
  },
  /** `POST InsuranceRules/Guards/Validate` (608) — the document on screen → `[{ ruleId, blockPath, field, severity, en, ar }]`. */
  validateGuardDraft(doc: GuardRuleset): Promise<GuardIssue[]> {
    return guardDoors().validate(doc)
  },
}

/** The refusal code of a PUT whose `revision` is stale (409, BackOffice 3139). */
export const STALE_REVISION = 'GUARDS_DRAFT_STALE'

/** Every insurance-rules query key starts here, so a write can invalidate the area at once. */
export const INSURANCE_RULES_KEY = ['insurance-rules'] as const
/** The guard draft's key (the whole draft); 608's save, 609's create from template and 611's restore write it. */
export const GUARD_DRAFT_KEY = [...INSURANCE_RULES_KEY, 'guards', 'draft'] as const

const guardDraftRead = { queryKey: GUARD_DRAFT_KEY, queryFn: () => insuranceRulesApi.guardDraft(), retry: false } as const

/** The guard ruleset the screens edit and read: the draft's document, stamped with the draft's revision. */
export function guardDraftQuery() {
  return { ...guardDraftRead, select: (d: RulesetDraft<GuardRuleset>): GuardRuleset => d.document } as const
}

/** The whole draft: its state, who asked and who reviewed (611). Same cache entry as `guardDraftQuery`. */
export function guardDraftStateQuery() {
  return guardDraftRead
}
