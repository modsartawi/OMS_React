// Types for `campaigns-fixtures.mjs`, so a vitest proof reads the SAME stub data the drive serves
// (ticket 504) rather than a copy of it. The draft doors' shapes are the real ones of
// `src/core/models/rule-campaign.ts` (ticket 522), the builder's other 2758 doors too (ticket 523);
// the doors 524-526 still own are PROVISIONAL.
import type {
  RuleBlockCatalogue,
  RuleBudgetLimitSet,
  RuleBudgetView,
  RuleCampaign,
  RuleDraft,
  RuleDraftDeleted,
  RuleDraftSave,
  RuleValidation,
  RuleCampaignListRow,
  RuleCampaignVersion,
  RuleCampaignVersionDetail,
  RuleLookupItem,
  RuleLookupKind,
  RuleOfflineVerdict,
  RuleValueMapUpload,
} from '../src/core/models/rule-campaign'

/** A refusal of a stubbed door: its code, status and message. */
type Refused = { refused: string; status: number; message: string }

/** Drafts/Load replies around schema-1 campaigns (ticket 522). */
export const CAMPAIGNS: RuleDraft[]
export const NEVER: string
export function offlineOf(c: RuleCampaign): RuleOfflineVerdict
export function validationOf(c: RuleCampaign): RuleValidation
export const CATALOGUE: RuleBlockCatalogue
export function catalogueFor(features?: string[]): RuleBlockCatalogue
export function listRow(d: RuleDraft): RuleCampaignListRow
export function loadDraft(store: RuleDraft[], code: string): { draft: RuleDraft } | Refused
export function saveDraft(store: RuleDraft[], body: RuleDraftSave, at: string): { draft: RuleDraft } | Refused
export function deleteDraft(store: RuleDraft[], body: { campaign: string; revision: number }): { deleted: RuleDraftDeleted } | Refused
export function copyOf(store: RuleDraft[], source: RuleDraft, at: string): RuleDraft
export const LOOKUPS: Record<RuleLookupKind, RuleLookupItem[]>
export function lookup(kind: string, q?: string): { hits: RuleLookupItem[] } | Refused
export function uploadValueMap(campaign: RuleCampaign, csv: string): RuleValueMapUpload
export function lifecycle(
  d: RuleDraft,
  act: 'AskForApproval' | 'Activate' | 'SendBack' | 'Disable',
  o: { note?: string; by: string; at: string },
): { campaign: RuleDraft; refused?: undefined } | { refused: string; campaign?: undefined }
export function budgetsOf(store: RuleDraft[], code: string, limits?: Map<string, number>): RuleBudgetView[]
export function setLimit(
  store: RuleDraft[],
  limits: Map<string, number>,
  body: { campaign: string; budget: string; limit: number },
): { set: RuleBudgetLimitSet } | Refused
export function versionsOf(store: RuleDraft[]): Map<string, RuleCampaignVersionDetail[]>
export function versionRow(v: RuleCampaignVersionDetail): RuleCampaignVersion
export function publishVersion(versions: Map<string, RuleCampaignVersionDetail[]>, d: RuleDraft, note?: string): void
export function restoreVersion(
  d: RuleDraft,
  versions: Map<string, RuleCampaignVersionDetail[]>,
  n: number,
): { campaign: RuleDraft; refused?: undefined } | { refused: string; message: string; campaign?: undefined }
