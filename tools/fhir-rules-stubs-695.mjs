// Stubs for oms 695 (BackOffice spec 3271, doors 3282 + 3296), on the real envelope. 🚩 Paths and shapes guessed; 711 reconciles.
//   POST InsuranceRules/Fields/Compile    { path, moment, level, type, cardinality, system } → { refusals, warnings }
//   POST InsuranceRules/Fields/Probe      the same body                                      → { payers, refusals }
//   POST InsuranceRules/Fields/Proposals  the row                                            → the proposal
// The verdict is the stub's, by the same marks the drive types: the client never parses a path. Synthetic counts only.
import { envelope } from './insurance-rules-stubs.mjs'

export const PATHS = {
  syntax: 'total.where(',
  clockFunction: 'today()',
  terminologyFunction: "code.memberOf('http://x')",
  conformsTo: "conformsTo('http://x')",
  trace: "total.trace('x')",
  typeMisfit: 'item.exists()',
  unlistedExtension: "extension('http://example.org/not-listed').value",
  caseOnly: "adjudication.where(category.coding.code = 'coPay').amount",
  good: "adjudication.where(category.coding.code = 'copay').amount",
  zero: "adjudication.where(category.coding.code = 'copay').nothing",
}

const refusal = (code, message, detail = null) => ({ code, message, detail })

export function compileVerdict(body) {
  const p = body?.path ?? ''
  const refusals = []
  if (p === PATHS.syntax) refusals.push(refusal('syntax', 'Unexpected end of expression at position 12.'))
  if (/\b(today|now|timeOfDay)\(/.test(p)) refusals.push(refusal('clockFunction', 'The clock is an input to a rule.', 'today'))
  if (/\b(memberOf|subsumes|subsumedBy)\(/.test(p)) refusals.push(refusal('terminologyFunction', 'There is no terminology server.', 'memberOf'))
  if (/\bconformsTo\(/.test(p)) refusals.push(refusal('conformsTo', 'conformsTo is not offered.', 'conformsTo'))
  if (/\btrace\(/.test(p)) refusals.push(refusal('trace', 'trace would log patient data.', 'trace'))
  if (p.endsWith('.exists()') && body?.type !== 'flag') refusals.push(refusal('typeMisfit', 'The path returns a boolean, and the field declares another type.'))
  if (p.includes('not-listed')) refusals.push(refusal('unlistedExtension', 'Not in the Structure Definition-profile sheet.', 'http://example.org/not-listed'))
  const warnings = p.includes("'coPay'") ? [{ code: 'caseOnlyCode', message: 'FHIRPath compares codes with their case.', literal: 'coPay', known: 'copay' }] : []
  return { refusals, warnings }
}

export function probeReply(body) {
  if ((body?.path ?? '').endsWith('.nothing'))
    return {
      refusals: [],
      payers: [
        { payer: 'BUPA', match: 0, noMatch: 6, unknown: 0 },
        { payer: 'GIG', match: 0, noMatch: 2, unknown: 1 },
      ],
    }
  return {
    refusals: [],
    payers: [
      { payer: 'BUPA', match: 14, noMatch: 2, unknown: 0 },
      { payer: 'GIG', match: 3, noMatch: 0, unknown: 1 },
      { payer: 'Globemed', match: 0, noMatch: 5, unknown: 0 },
    ],
  }
}

/** The three doors, or null to fall through. `state.proposals` collects what was sent; `state.refusePropose` answers a business refusal. */
export function rawPathStub(method, path, body, state = {}) {
  if (method !== 'POST') return null
  if (path === 'InsuranceRules/Fields/Compile') {
    if (state.compiles) state.compiles.push(body)
    return envelope(compileVerdict(body))
  }
  if (path === 'InsuranceRules/Fields/Probe') return envelope(probeReply(body))
  if (path === 'InsuranceRules/Fields/Proposals') {
    if (state.refusePropose) return envelope(null, { status: 409, success: false, message: 'A proposal for this key is already open.', errorCode: 'INSFIELDS_PROPOSAL_OPEN' })
    state.proposals?.push(body)
    return envelope({ id: 'FP-1', status: 'proposed', ...body })
  }
  return null
}
