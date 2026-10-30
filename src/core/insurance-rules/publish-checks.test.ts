/**
 * Ticket 698 — what publish shows: the door's warnings and refusals told apart, with no client rule behind them. A
 * warning never holds Ask for approval or Approve; a refusal holds both.
 */
import { describe, expect, it } from 'vitest'
import en from '@/locales/en/insurance-rules.json'
import ar from '@/locales/ar/insurance-rules.json'
import { actionsFor, type DraftApproval } from './approval'
import { checksVerdict, type GuardIssue } from './checks'
import { PUBLISH_WARNING_KINDS, publishChecks, publishWarningKind } from './publish-checks'
import { rulesetActions } from './ruleset-draft'

const issue = (o: Partial<GuardIssue>): GuardIssue => ({ ruleId: 'G-1', blockPath: null, field: null, severity: 'warning', en: 'x', ar: 'س', ...o })
const never = issue({ kind: 'channelNever', fact: '$claimResponse.benefit', channel: 'bupa', en: 'On bupa this condition is always unknown.' })
const flagged = issue({ kind: 'fieldFlagged', fact: '$claimResponse.copay' })
const arabic = issue({ kind: 'arabicMissing', fact: '$claim.category[*]', field: 'says.ar' })
const overrides = issue({ severity: 'error', kind: 'overridesPayer', ruleId: 'C-1', blockPath: 'then[0]', field: 'overridesPayer' })

const approval = (o: Partial<DraftApproval> = {}): DraftApproval => ({
  revision: 12,
  state: 'draft',
  submittedBy: null,
  submittedAt: null,
  note: null,
  sentBack: null,
  viewer: { author: true, approver: true },
  ...o,
})
const bt = { status: 'done' as const, revision: 12 }

describe('publishChecks', () => {
  it('tells a refusal from a warning by the door’s severity, keeping the door’s order', () => {
    const out = publishChecks([never, overrides, flagged, arabic])
    expect(out.warnings).toEqual([never, flagged, arabic])
    expect(out.refusals).toEqual([overrides])
  })

  it('a severity this client does not know is a refusal', () => {
    const odd = issue({ severity: 'fatal' as GuardIssue['severity'] })
    expect(publishChecks([odd]).refusals).toEqual([odd])
  })

  it('takes none of it from anything but the answer', () => {
    expect(publishChecks([])).toEqual({ warnings: [], refusals: [] })
    expect(publishChecks(null)).toEqual({ warnings: [], refusals: [] })
  })

  it('an unrecognised kind, or none, is the plain warning: its server text still shows', () => {
    expect(publishWarningKind(never)).toBe('channelNever')
    expect(publishWarningKind(issue({ kind: 'somethingNew', en: 'Said by HQ' }))).toBe('other')
    expect(publishWarningKind(issue({}))).toBe('other')
  })

  it('every kind has its label in en and ar', () => {
    for (const k of [...PUBLISH_WARNING_KINDS, 'other'] as const) {
      expect(en.publishChecks.kind[k]).toBeTruthy()
      expect(ar.publishChecks.kind[k]).toBeTruthy()
    }
  })
})

describe('warnings never disable publish; a refusal does', () => {
  const warned = checksVerdict([never, flagged, arabic])
  const refused = checksVerdict([never, overrides])

  it('the guard draft: Ask for approval', () => {
    expect(actionsFor({ approval: approval(), userId: 'a', backtest: bt, checks: warned })[0]).toEqual({ kind: 'submit', enabled: true, why: null })
    expect(actionsFor({ approval: approval(), userId: 'a', backtest: bt, checks: refused })[0]).toEqual({ kind: 'submit', enabled: false, why: 'checks' })
  })

  it('the guard draft: Approve', () => {
    const waiting = approval({ state: 'waiting', submittedBy: 'a' })
    expect(actionsFor({ approval: waiting, userId: 'b', backtest: bt, checks: warned })[0]).toEqual({ kind: 'approve', enabled: true, why: null })
    expect(actionsFor({ approval: waiting, userId: 'b', backtest: bt, checks: refused })[0]).toEqual({ kind: 'approve', enabled: false, why: 'checks' })
  })

  it('Approve waits to have shown them, and sending back never waits', () => {
    const waiting = approval({ state: 'waiting', submittedBy: 'a' })
    expect(actionsFor({ approval: waiting, userId: 'b', backtest: bt, checks: null })).toEqual([
      { kind: 'approve', enabled: false, why: 'checking' },
      { kind: 'sendBack', enabled: true, why: null },
    ])
  })

  it('a category or coverage draft: the same', () => {
    const draft = { state: 'editing' as const, requestedBy: null, updatedBy: 'a' }
    const pending = { state: 'pending' as const, requestedBy: 'a', updatedBy: 'a' }
    expect(rulesetActions({ draft, userId: 'a', checks: warned })[0]).toEqual({ kind: 'submit', enabled: true, why: null })
    expect(rulesetActions({ draft, userId: 'a', checks: refused })[0]).toEqual({ kind: 'submit', enabled: false, why: 'checks' })
    expect(rulesetActions({ draft: pending, userId: 'b', checks: warned })[0]).toEqual({ kind: 'approve', enabled: true, why: null })
    expect(rulesetActions({ draft: pending, userId: 'b', checks: refused })).toEqual([
      { kind: 'approve', enabled: false, why: 'checks' },
      { kind: 'sendBack', enabled: true, why: null },
    ])
    expect(rulesetActions({ draft: pending, userId: 'b', checks: null })[0]).toEqual({ kind: 'approve', enabled: false, why: 'checking' })
  })

  it('whoever asked for it still cannot approve it, whatever the checks say', () => {
    const waiting = approval({ state: 'waiting', submittedBy: 'a' })
    expect(actionsFor({ approval: waiting, userId: 'a', backtest: bt, checks: null })[0].why).toBe('ownSubmission')
  })
})
