import { describe, expect, it } from 'vitest'
import { compileVerdictOf, probeReplyOf, scopeOf } from './raw-path'
import { proposalOf } from './field-proposal'
import { refParts, sampleRef, treeClickOf, treeNodeOf } from './bundle-tree'

describe('the doors as built', () => {
  it('keeps a probe warning in the words the door sent', () => {
    expect(probeReplyOf({ warnings: [{ code: 'caseOnlyCode', en: 'Case only', ar: 'حالة' }] }).warnings).toEqual([
      { code: 'caseOnlyCode', message: 'Case only', says: { en: 'Case only', ar: 'حالة' } },
    ])
  })

  it('holds a kept copy as one ref and refuses what is not one', () => {
    expect(refParts(sampleRef({ kind: 'answer', keptId: 'A/1' }))).toEqual({ kind: 'answer', keptId: 'A/1' })
    expect(refParts('nothing')).toBeNull()
    expect(refParts('/x')).toBeNull()
  })

  it('reads a tree and a click', () => {
    expect(treeNodeOf({ id: 'n', name: 'a', type: 'code', value: 'v', clickable: true, children: [{ id: 'm', name: 'b' }] })).toMatchObject({ nodeRef: 'n', fhirType: 'code', pickable: true, children: [{ nodeRef: 'm', pickable: false }] })
    const click = treeClickOf({ scope: 'line.claimResponse', type: 'code', cardinality: 'single', fhirPath: 'p', existing: [{ key: 'k', labelEn: 'K' }], notices: [{ code: 'patient' }] })
    expect(click.proposal).toMatchObject({ moment: 'claimResponse', level: 'line', path: 'p' })
    expect(click.existing?.key).toBe('k')
    expect(click.patient).toBe(true)
  })

  it('reads the raw-path doors', () => {
    expect(scopeOf({ moment: 'claim', level: 'line' })).toBe('line.claim')
    expect(scopeOf({ moment: 'claim', level: 'message' })).toBe('claim')
    expect(compileVerdictOf({ valid: true, readsPatient: true })).toEqual({ refusals: [], warnings: [{ code: 'patient', message: 'patient' }] })
    expect(compileVerdictOf({ valid: false, syntaxError: 'bad', refusedFunctions: ['now'] }).refusals.map((r) => r.detail)).toEqual(['bad', 'now'])
    expect(probeReplyOf({ rows: [{ source: 'golden', payer: '', match: 2 }], errors: [{ code: 'badPath', en: 'no' }] })).toEqual({
      payers: [{ payer: 'golden', match: 2, noMatch: 0, unknown: 0 }],
      refusals: [{ code: 'badPath', message: 'no', detail: 'no' }],
      warnings: [],
    })
  })

  it('reads a proposal', () => {
    const p = proposalOf({ id: '1', key: 'k', scope: 'line.claim', labelEn: 'E', labelAr: 'A', type: 'code', cardinality: 'single', fhirPath: 'p', status: 'rejected', decisionNote: 'why', warnings: [{ code: 'patient' }] })
    expect(p).toMatchObject({ moment: 'claim', level: 'line', state: 'rejected', rejectReason: 'why', patientWarning: true, label: { en: 'E', ar: 'A' } })
  })
})
