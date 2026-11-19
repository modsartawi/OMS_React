/**
 * Oms 922 Boundaries — "No patient field exists in the models at all." A source contract (BackOffice 4053 holds its DTO
 * to the same one): the case models declare no identity field, and the reader of the case doors reads none, so even a
 * server that sent one would have it dropped before the cache (`./wire`, proven in `./api.test.ts`).
 *
 * Scoped to the CASE models and their reader on purpose: the investigator's reveal (923) answers a patient key and a
 * member id, held in its dialog's own state — that answer is not a model and does not live in either file.
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = (relative: string) => readFileSync(new URL(relative, import.meta.url), 'utf8')

/** Every word that would name a person's identity in this domain (ADR 0140's patient key, NPHIES member and policy). */
const IDENTITY = /patient|member|policy|national|iqama|insured|beneficiar|identit/i

/** The field names an interface declares: `name:` or `name?:` at the start of a line. */
const declaredFields = (text: string) => [...text.matchAll(/^\s*(\w+)\??\s*:/gm)].map((m) => m[1])

describe('the case models hold no identity', () => {
  const models = source('../../../core/models/insurance-patterns.ts')

  it('declares the case fields (the scan sees them)', () => {
    expect(declaredFields(models)).toEqual(expect.arrayContaining(['caseNumber', 'pharmacist', 'stores', 'previousClearance']))
  })

  it('declares no field naming a patient, a member, a policy or a national id', () => {
    expect(declaredFields(models).filter((f) => IDENTITY.test(f))).toEqual([])
  })
})

describe('the reader of the case doors reads no identity', () => {
  const wire = source('./wire.ts')

  it('reads the agreed fields (the scan sees them)', () => {
    expect([...wire.matchAll(/\br\.(\w+)/g)].map((m) => m[1])).toEqual(expect.arrayContaining(['caseNumber', 'pharmacist']))
  })

  it('reads no field naming a patient, a member, a policy or a national id', () => {
    expect([...wire.matchAll(/\b(?:r|raw|v)\.(\w+)/g)].map((m) => m[1]).filter((f) => IDENTITY.test(f))).toEqual([])
  })
})
