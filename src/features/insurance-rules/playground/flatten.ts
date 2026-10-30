// The Data pane's Flatten panel (ticket 685; BackOffice door 3247). Pure: no React, no http.
//
// A payer's raw eligibility answer (an nphies CoverageEligibilityResponse bundle, or Bupa's answer) is sent to
// `POST InsuranceRules/Playground/Flatten` and comes back as a fact list (`key`, `type`, `value`, `unit`). "Use these
// facts" REPLACES the experiment's `eligibility` block with that list, in the engine shape `{ key: { type, <type>:
// value, unit } }` (BackOffice `EligibilityFact`, the shape 683's form reads): the facts are the payer's answer, so
// nothing of the prior block is merged in. It is a one-shot write to the data box; an edit made afterwards is the
// data's own, and only another Use replaces it again.
//
// 🚩 DRIFT for 691: the brief's spec body names only `{ response }`; its contract names `source`, `memberId` and
// `policy` too. Built to the contract.

import { isPlainObject as isObj } from '@/core/util/plain-object'

type Obj = Record<string, unknown>

/** The payers whose answers the door flattens. */
export const FLATTEN_SOURCES = ['nphies', 'bupa'] as const
export type FlattenSource = (typeof FLATTEN_SOURCES)[number]

/** `POST InsuranceRules/Playground/Flatten` — the brief's contract (3247). */
export interface FlattenBody {
  source: FlattenSource
  /** The payer's answer, as parsed JSON. */
  response: Obj
  memberId: string | null
  policy: string | null
}

/** One flattened fact: `value` is a number, text, flag or date text, as its `type` names. */
export interface FlattenFact {
  key: string
  type: string
  value: unknown
  unit?: string | null
}

export interface FlattenReply {
  facts?: FlattenFact[] | null
}

const blankToNull = (s: string) => (s.trim() === '' ? null : s.trim())

/** The panel's inputs → the door's body, or `invalid` when the response is not one JSON object (then nothing is sent). */
export function flattenBody(input: { source: FlattenSource; response: string; memberId: string; policy: string }): { body: FlattenBody } | { problem: 'invalid' } {
  let response: unknown
  try {
    response = JSON.parse(input.response)
  } catch {
    return { problem: 'invalid' }
  }
  if (!isObj(response)) return { problem: 'invalid' }
  return { body: { source: input.source, response, memberId: blankToNull(input.memberId), policy: blankToNull(input.policy) } }
}

/** The door's reply → its facts; a fact with no key or no type is dropped, no reply is no facts. */
export function flattenFactsIn(reply: unknown): FlattenFact[] {
  const facts = isObj(reply) && Array.isArray(reply.facts) ? reply.facts : []
  return facts.filter((f): f is FlattenFact => isObj(f) && typeof f.key === 'string' && f.key.trim() !== '' && typeof f.type === 'string' && f.type !== '')
}

/** The facts → the eligibility block, keyed as a rule names a fact; the unit only when the payer gave one. */
export function eligibilityOf(facts: FlattenFact[]): Obj {
  const out: Obj = {}
  for (const f of facts) {
    const fact: Obj = { type: f.type, [f.type]: f.value ?? null }
    if (typeof f.unit === 'string' && f.unit !== '') fact.unit = f.unit
    out[f.key] = fact
  }
  return out
}

/**
 * "Use these facts": the data box's text with its `eligibility` REPLACED by the facts (added at the end when there was
 * none); every other key as it was, in its order. `invalid` when the data box is not one JSON object.
 */
export function applyFacts(dataText: string, facts: FlattenFact[]): { text: string } | { problem: 'invalid' } {
  let data: unknown
  try {
    data = JSON.parse(dataText)
  } catch {
    return { problem: 'invalid' }
  }
  if (!isObj(data)) return { problem: 'invalid' }
  return { text: JSON.stringify({ ...data, eligibility: eligibilityOf(facts) }, null, 2) }
}
