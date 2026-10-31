// Stubs for oms 695 (BackOffice spec 3271, doors 3282 + 3296), on the real envelope, as built (oms 711).
//   POST InsuranceRules/Fields/Compile    { fhirPath } → { valid, syntaxError, refusedFunctions, readsPatient }
//   POST InsuranceRules/Fields/Probe      { scope, type, cardinality, system, fhirPath } → { refused, rows, errors, warnings }
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

export function compileVerdict(body) {
  const p = body?.fhirPath ?? ''
  const refusedFunctions = ['today', 'now', 'timeOfDay', 'memberOf', 'subsumes', 'subsumedBy', 'conformsTo', 'trace'].filter((f) => p.includes(`${f}(`))
  const syntaxError = p === PATHS.syntax ? 'Unexpected end of expression at position 12.' : null
  return { valid: !syntaxError && refusedFunctions.length === 0, syntaxError, refusedFunctions, readsPatient: /Patient/.test(p) }
}

const counts = (rows) => rows.map(([payer, match, noMatch, unknown]) => ({ source: 'nphies', payer, match, noMatch, unknown, unparsed: 0, misfit: 0 }))

/** The type, the extension URLs and the case-only code are the Probe's to judge: it alone knows the scope and the type. */
export function probeReply(body) {
  const p = body?.fhirPath ?? ''
  const errors = []
  if (p.endsWith('.exists()') && body?.type !== 'flag') errors.push({ code: 'typeMisfit', en: 'The path returns a boolean, and the field declares another type.', ar: '' })
  if (p.includes('not-listed')) errors.push({ code: 'unlistedExtension', en: 'Not in the Structure Definition-profile sheet.', ar: '' })
  const warnings = p.includes("'coPay'") ? [{ code: 'caseOnlyCode', en: "'coPay' exists only as 'copay': FHIRPath compares codes with their case.", ar: '' }] : []
  const rows = errors.length ? [] : p.endsWith('.nothing') ? counts([['BUPA', 0, 6, 0], ['GIG', 0, 2, 1]]) : counts([['BUPA', 14, 2, 0], ['GIG', 3, 0, 1], ['Globemed', 0, 5, 0]])
  return { refused: errors.length > 0, rows, errors, warnings }
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
