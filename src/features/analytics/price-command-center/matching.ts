/**
 * The Matching tab's logic (oms 937, BackOffice spec 4127 decision 8; doors BO 3501): which candidate is up, what each
 * decision sends and how the queue moves on, the Mindsite label (BO 4135, GUESSED), coverage per competitor, and the
 * confirm-by-URL check. Pure apart from the four senders, which go through `priceMatchingApi`.
 *
 * The queue page is read once; decisions are kept here as closed materials and closed candidates, so the next pair comes
 * up at once without a re-read (the server drops a decided material / candidate from its queue the same way).
 */
import { MATCH_URL_MAX, type MatchingCandidate, type MatchingQueueItem, type PriceWatchCoverage } from '@/core/models/price-watch'
import { priceMatchingApi } from './api'

/** The four decisions on a queued material. */
export const MATCHING_ACTIONS = ['exact', 'comparable', 'notTheSame', 'notCarried'] as const
export type MatchingAction = (typeof MATCHING_ACTIONS)[number]

/** One decision: Not carried is about the material, and may be taken with no candidate. */
export interface MatchingDecision {
  action: MatchingAction
  item: MatchingQueueItem
  candidate: MatchingCandidate | null
}

/** What has been decided on this queue page. */
export interface MatchingDecisions {
  closedMaterials: readonly string[]
  closedCandidates: readonly string[]
}

export const NO_DECISIONS: MatchingDecisions = { closedMaterials: [], closedCandidates: [] }

/** The pair up now: the first open material in our sales order and its best open candidate (null = none left). */
export interface MatchingPair {
  item: MatchingQueueItem
  candidate: MatchingCandidate | null
}

/** The material and candidate to work now, or null when every material on the page is decided. */
export function currentPair(items: readonly MatchingQueueItem[], decisions: MatchingDecisions): MatchingPair | null {
  const item = items.find((i) => !decisions.closedMaterials.includes(i.materialNumber))
  if (!item) return null
  const candidate = [...item.candidates]
    .sort((a, b) => a.rank - b.rank)
    .find((c) => !decisions.closedCandidates.includes(c.candidateId))
  return { item, candidate: candidate ?? null }
}

/** The decisions once the material is closed (matched, not carried, or confirmed by URL). */
export function closeMaterial(decisions: MatchingDecisions, material: string): MatchingDecisions {
  return { ...decisions, closedMaterials: [...decisions.closedMaterials, material] }
}

/** The decisions after one is accepted: Not the same closes only its candidate; the others close the material. */
export function applyDecision(decisions: MatchingDecisions, decision: MatchingDecision): MatchingDecisions {
  if (decision.action === 'notTheSame')
    return decision.candidate ? { ...decisions, closedCandidates: [...decisions.closedCandidates, decision.candidate.candidateId] } : decisions
  return closeMaterial(decisions, decision.item.materialNumber)
}

/** Send one decision to its door. A candidate decision without a candidate is a caller bug. */
export function sendDecision(competitor: string, decision: MatchingDecision): Promise<unknown> {
  const { action, item, candidate } = decision
  if (action === 'notCarried') return priceMatchingApi.notCarried(competitor, item.materialNumber)
  if (!candidate) throw new Error(`${action} needs a candidate`)
  if (action === 'exact') return priceMatchingApi.exact(candidate.candidateId)
  if (action === 'comparable') return priceMatchingApi.comparable(candidate.candidateId)
  return priceMatchingApi.notTheSame(candidate.candidateId)
}

/** Discovery for the picked competitor — the wire asks per competitor, over the queue's first materials. */
export function requestDiscovery(competitor: string) {
  return priceMatchingApi.discovery(competitor)
}

/**
 * ⚠ GUESSED (BO 4135): whether a candidate came from Mindsite's product groupings. Only the exact code `MINDSITE` lights
 * the label; a pre-4135 server sends no origin, so the label never shows until 4135 ships.
 */
export function suggestedByMindsite(candidate: MatchingCandidate): boolean {
  return (candidate.origin ?? candidate.candidateOrigin) === 'MINDSITE'
}

/** Coverage at one competitor as the tab shows it: matched (exact + comparable), not carried, still open. */
export interface CoverageView {
  competitorCode: string
  competitorName: string
  watched: number
  matched: number
  notCarried: number
  open: number
}
export function coverageView(row: PriceWatchCoverage): CoverageView {
  return {
    competitorCode: row.competitorCode,
    competitorName: row.competitorName,
    watched: row.watched,
    matched: row.exact + row.comparable,
    notCarried: row.notCarried,
    open: row.open,
  }
}

/** Why a URL cannot be sent to confirm by URL, or null. Mirrors the server's PWT-00002. */
export type UrlProblem = 'required' | 'notHttps' | 'tooLong'
export function urlProblem(raw: string): UrlProblem | null {
  const url = raw.trim()
  if (!url) return 'required'
  if (url.length > MATCH_URL_MAX) return 'tooLong'
  try {
    if (new URL(url).protocol !== 'https:') return 'notHttps'
  } catch {
    return 'notHttps'
  }
  return null
}

/** Confirm a product match by the competitor listing's URL (trimmed). */
export function confirmByUrl(competitor: string, item: MatchingQueueItem, url: string) {
  return priceMatchingApi.confirmByUrl({ material: item.materialNumber, competitorCode: competitor, url: url.trim() })
}
