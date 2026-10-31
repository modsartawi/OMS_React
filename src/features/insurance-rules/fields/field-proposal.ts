// The field proposals inbox (oms 696; BackOffice spec 3271 story 21, 3262 V6, door 3282). Pure: no React, no http.
//
// A proposed FHIR field joins the catalog only when someone other than its author approves it. The client only hides the
// action, and HQ still decides.
//
// ⚠️ PROVISIONAL: 3282 spells no shape; 711 reconciles. As in `@/core/insurance-rules/approval`, `viewer` is what the
// session may do; it comes with the list because this area has no grant probe.

import { authorshipOf } from '@/core/insurance-rules/approval'
import type { FieldProposalBody, ProbeReply } from './raw-path'

export type FieldProposalState = 'proposed' | 'approved' | 'rejected'
export const FIELD_PROPOSAL_STATES: readonly FieldProposalState[] = ['proposed', 'approved', 'rejected']

export interface FieldProposal extends FieldProposalBody {
  id: string
  state: FieldProposalState
  proposedBy: string | null
  /** Local moment. */
  proposedAt: string | null
  /** The Probe the door kept with the proposal, per payer; null when it holds none. */
  probe: ProbeReply | null
  /** The door's finding that the path reads the Patient resource (3282's PDPL warning). The client never parses a path. */
  patientWarning: boolean
  /** Who approved or rejected it. */
  decidedBy: string | null
  /** Local moment. */
  decidedAt: string | null
  /** Why it was rejected. */
  rejectReason: string | null
}

/** One proposal as the door sends it (3282). */
export interface ProposalDoorRow {
  id: string
  key: string
  scope: string
  labelEn?: string | null
  labelAr?: string | null
  type: FieldProposal['type']
  cardinality: FieldProposal['cardinality']
  system?: string | null
  fhirPath: string
  status: string
  author?: string | null
  proposedAt?: string | null
  decidedBy?: string | null
  decidedAt?: string | null
  decisionNote?: string | null
  probe?: { source?: string | null; payer?: string | null; match?: number; noMatch?: number; unknown?: number }[] | null
  warnings?: { code: string }[] | null
}

const stamped = (at: string | null | undefined): string | null => (at && !at.startsWith('0001-') ? at : null)

export function proposalOf(r: ProposalDoorRow): FieldProposal {
  const isLine = r.scope.startsWith('line.')
  return {
    id: r.id,
    key: r.key,
    label: { en: r.labelEn ?? '', ar: r.labelAr ?? '' },
    moment: (isLine ? r.scope.slice('line.'.length) : r.scope) as FieldProposal['moment'],
    level: isLine ? 'line' : 'message',
    type: r.type,
    cardinality: r.cardinality,
    system: r.system || null,
    fhirPath: r.fhirPath,
    state: r.status as FieldProposalState,
    proposedBy: r.author ?? null,
    proposedAt: stamped(r.proposedAt),
    probe: r.probe?.length ? { payers: r.probe.map((p) => ({ payer: p.payer || p.source || '', match: p.match ?? 0, noMatch: p.noMatch ?? 0, unknown: p.unknown ?? 0 })), refusals: [] } : null,
    patientWarning: (r.warnings ?? []).some((w) => w.code === 'patient'),
    decidedBy: r.decidedBy || null,
    decidedAt: stamped(r.decidedAt),
    rejectReason: r.decisionNote || null,
  }
}

export interface ProposalViewer {
  /** Holds the insurance rule grant. */
  approver: boolean
}

export interface FieldProposalsReply {
  proposals: FieldProposal[]
  viewer: ProposalViewer
}

/**
 * What this user is offered on a proposal: `may` decide, is told it is their `ownProposal`, is told they are a `reader`
 * without the grant, or `none`. An unknown user or author offers nothing and claims no authorship.
 */
export type ProposalStanding = 'may' | 'ownProposal' | 'reader' | 'none'

export function proposalStanding(p: Pick<FieldProposal, 'state' | 'proposedBy'>, userId: string | null, viewer: ProposalViewer): ProposalStanding {
  if (p.state !== 'proposed') return 'none'
  if (!viewer.approver) return 'reader'
  const who = authorshipOf(userId, p.proposedBy)
  return who === 'unknown' ? 'none' : who === 'own' ? 'ownProposal' : 'may'
}

/** A rejection is sent with its reason, or not at all. */
export function rejectBody(reason: string): { reason: string } | null {
  const trimmed = reason.trim()
  return trimmed ? { reason: trimmed } : null
}

/** What waits comes first, oldest first; what is decided follows, newest first. */
export function inboxOrder<T extends Pick<FieldProposal, 'state' | 'proposedAt'>>(rows: readonly T[]): T[] {
  const at = (r: T) => r.proposedAt ?? ''
  const open = rows.filter((r) => r.state === 'proposed').sort((a, b) => at(a).localeCompare(at(b)))
  const decided = rows.filter((r) => r.state !== 'proposed').sort((a, b) => at(b).localeCompare(at(a)))
  return [...open, ...decided]
}
