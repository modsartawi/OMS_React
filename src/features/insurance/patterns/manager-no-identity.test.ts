/**
 * Oms 924 — "The reveal log shows no identity" (ticket 924; BackOffice 4055: the log "never returns the revealed
 * identity"). A source contract, as 922's `./no-identity.test.ts` holds the case models: the manager's models — the
 * reveal log's row, the thresholds, the block's body — declare no identity field, and their reader reads none, so even a
 * server that sent one would have it dropped before the cache (proven at the call in `./manager-api.test.ts`).
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = (relative: string) => readFileSync(new URL(relative, import.meta.url), 'utf8')

/** Every word that would name a person's identity in this domain (ADR 0140's patient key, NPHIES member and policy). */
const IDENTITY = /patient|member|policy|national|iqama|insured|beneficiar|identit/i

/** The field names an interface declares: `name:` or `name?:` at the start of a line. */
const declaredFields = (text: string) => [...text.matchAll(/^\s*(\w+)\??\s*:/gm)].map((m) => m[1])

/** The fields one interface declares, by its name. */
const fieldsOf = (text: string, name: string) => declaredFields(text.match(new RegExp(`interface ${name} \\{([\\s\\S]*?)\\n\\}`))?.[1] ?? '')

describe('the manager’s models hold no identity', () => {
  const models = source('../../../core/models/insurance-pattern-manager.ts')

  it('the reveal log’s row is exactly which case, who, when and why', () => {
    expect(fieldsOf(models, 'PatternReveal')).toEqual(['caseNumber', 'by', 'at', 'reason'])
  })

  it('the scan sees every model’s fields', () => {
    expect(declaredFields(models)).toEqual(expect.arrayContaining(['caseNumber', 'reason', 'oldValue', 'reasonKind', 'expiresOn']))
  })

  it('no model declares a field naming a patient, a member, a policy or a national id', () => {
    expect(declaredFields(models).filter((f) => IDENTITY.test(f))).toEqual([])
  })
})

describe('the reader of the manager’s doors reads no identity', () => {
  const wire = source('./manager-wire.ts')

  it('reads the agreed fields (the scan sees them)', () => {
    expect([...wire.matchAll(/\br\.(\w+)/g)].map((m) => m[1])).toEqual(expect.arrayContaining(['caseNumber', 'reason', 'oldValue']))
  })

  it('reads no field naming a patient, a member, a policy or a national id', () => {
    expect([...wire.matchAll(/\b(?:r|raw|v)\.(\w+)/g)].map((m) => m[1]).filter((f) => IDENTITY.test(f))).toEqual([])
  })
})
