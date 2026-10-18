// Types for `campaigns-fixtures.mjs`, so a vitest proof reads the SAME stub data the drive serves
// (ticket 504) rather than a copy of it. Every shape is the real one of
// `src/core/models/rule-campaign.ts`: the draft doors (ticket 522), the builder's other 2758 doors
// (ticket 523) and the 2759 doors — approvals, versions, order, copy and templates (ticket 524). The
// doors 525-526 still own are PROVISIONAL.
import type {
  RuleApprovalItem,
  RuleApprovalStep,
  RuleBlockCatalogue,
  RuleBudgetLimitSet,
  RuleBudgetView,
  RuleCampaign,
  RuleCopyBody,
  RuleDraft,
  RuleDraftDeleted,
  RuleDraftSave,
  RuleDraftSummary,
  RuleEvaluationTree,
  RuleFromTemplateBody,
  RuleLookupItem,
  RuleLookupKind,
  RuleOfflineVerdict,
  RuleOrder,
  RulePublishReply,
  RuleRuleset,
  RuleTemplate,
  RuleValidation,
  RuleValueMapUpload,
  RuleVersionDetail,
  RuleVersionSummary,
} from '../src/core/models/rule-campaign'

/** A refusal of a stubbed door: its code, status and message. */
type Refused = { refused: string; status: number; message: string }

/** A version as the stub holds it: the summary, and the campaign it holds (null for a disable). */
type StubVersion = RuleVersionSummary & { json: RuleCampaign | null }

/** Drafts/Load replies around schema-1 campaigns (ticket 522). */
export const CAMPAIGNS: RuleDraft[]
export const NEVER: string
export function offlineOf(c: RuleCampaign): RuleOfflineVerdict
export function validationOf(c: RuleCampaign): RuleValidation
export const CATALOGUE: RuleBlockCatalogue
export function catalogueFor(features?: string[]): RuleBlockCatalogue
export const LIVE_VERSION: number
export const TREE: RuleEvaluationTree
export function draftsList(store: RuleDraft[]): RuleDraftSummary[]
export function orderOf(store: RuleDraft[], tree?: RuleEvaluationTree): RuleOrder
export function rulesetOf(store: RuleDraft[], tree?: RuleEvaluationTree): RuleRuleset
export function loadDraft(store: RuleDraft[], code: string): { draft: RuleDraft } | Refused
export function saveDraft(store: RuleDraft[], body: RuleDraftSave, at: string): { draft: RuleDraft } | Refused
export function deleteDraft(store: RuleDraft[], body: { campaign: string; revision: number }): { deleted: RuleDraftDeleted } | Refused
export function copyDraft(store: RuleDraft[], body: RuleCopyBody, at: string): { draft: RuleDraft } | Refused
export const TEMPLATES: RuleTemplate[]
export function fromTemplate(store: RuleDraft[], body: RuleFromTemplateBody, at: string): { draft: RuleDraft } | Refused
export const HISTORY: RuleApprovalStep[]
export function approvalsList(store: RuleDraft[]): RuleApprovalItem[]
export function approval(
  d: RuleDraft | undefined,
  act: 'Request' | 'SendBack' | 'Activate' | 'Disable',
  body: { revision?: number; note?: string },
  o: { by: string; at: string; history: RuleApprovalStep[]; versions: Map<string, StubVersion[]>; tree: { set: (t: RuleEvaluationTree) => void } },
): { draft: RuleDraft } | { published: RulePublishReply } | { version: RuleVersionSummary } | Refused
export const LOOKUPS: Record<RuleLookupKind, RuleLookupItem[]>
export function lookup(kind: string, q?: string): { hits: RuleLookupItem[] } | Refused
export function uploadValueMap(campaign: RuleCampaign, csv: string): RuleValueMapUpload
export function budgetsOf(store: RuleDraft[], code: string, limits?: Map<string, number>): RuleBudgetView[]
export function setLimit(
  store: RuleDraft[],
  limits: Map<string, number>,
  body: { campaign: string; budget: string; limit: number },
): { set: RuleBudgetLimitSet } | Refused
export function versionsOf(store: RuleDraft[]): Map<string, StubVersion[]>
export function versionRow(v: StubVersion): RuleVersionSummary
export function loadVersion(versions: Map<string, StubVersion[]>, code: string, versionNo: number): { detail: RuleVersionDetail } | Refused
export function publishVersion(versions: Map<string, StubVersion[]>, d: RuleDraft, o: { versionNo: number; by: string; at: string }): void
export function restoreVersion(d: RuleDraft, versions: Map<string, StubVersion[]>, n: number, revision: number): { draft: RuleDraft } | Refused
