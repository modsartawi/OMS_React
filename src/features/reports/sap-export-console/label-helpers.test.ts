import { describe, expect, it } from 'vitest'
import { FLAGS, LABELS, type Label } from '@/core/models/sap-export'
import { LABEL_TOKEN_CLASS, WORST_FIRST, accountingToken, flagToken, labelToken, unknownLabelCounts, worstLabel } from './label-helpers'
import en from '@/locales/en/sap-export-console.json'

describe('labelToken', () => {
  it('maps every Label to a token and a label key that exists', () => {
    for (const label of LABELS) {
      const token = labelToken(label)
      expect(token.labelKey).toBe(`labels.${label}`)
      expect((en.labels as Record<string, string>)[label]).toBeTruthy()
      expect(Object.keys(LABEL_TOKEN_CLASS)).toContain(token.token)
    }
  })

  it('follows the ruling: stuck danger, behind strong warning, held info, waiting neutral, exported success, by design muted', () => {
    expect(labelToken('stuck').token).toBe('danger')
    expect(labelToken('behind').token).toBe('warningStrong')
    expect(labelToken('heldForInventory').token).toBe('info')
    expect(labelToken('waiting').token).toBe('neutral')
    expect(labelToken('exported').token).toBe('success')
    expect(labelToken('byDesign').token).toBe('muted')
  })

  it('never draws held for inventory red: a deliberate stock-count freeze is not a fault', () => {
    expect(labelToken('heldForInventory').token).not.toBe('danger')
    expect(LABEL_TOKEN_CLASS[labelToken('heldForInventory').token]).not.toMatch(/danger/)
  })

  it('gives every label its own token, and every token its own class', () => {
    expect(new Set(LABELS.map((l) => labelToken(l).token)).size).toBe(LABELS.length)
    expect(new Set(Object.values(LABEL_TOKEN_CLASS)).size).toBe(Object.keys(LABEL_TOKEN_CLASS).length)
  })

  it('falls back to neutral with no key for an unknown value, never a crash', () => {
    expect(labelToken('quarantined')).toEqual({ token: 'neutral', labelKey: null })
    expect(labelToken('toString')).toEqual({ token: 'neutral', labelKey: null })
    expect(labelToken('')).toEqual({ token: 'neutral', labelKey: null })
  })

  it('builds every token class from theme tokens, never a raw colour', () => {
    for (const cls of Object.values(LABEL_TOKEN_CLASS)) expect(cls).not.toMatch(/#|\b(red|amber|yellow|green|blue|gray|slate)-\d/)
  })
})

describe('worstLabel', () => {
  it('ranks every contract label, and nothing else', () => {
    expect([...WORST_FIRST].sort()).toEqual([...LABELS].sort())
  })

  it('orders stuck > behind > heldForInventory > waiting > exported > byDesign', () => {
    expect(WORST_FIRST).toEqual(['stuck', 'behind', 'heldForInventory', 'waiting', 'exported', 'byDesign'])
    for (let i = 0; i < WORST_FIRST.length - 1; i++) {
      expect(worstLabel([WORST_FIRST[i + 1], WORST_FIRST[i]])).toBe(WORST_FIRST[i])
    }
  })

  it('picks the worst present, whatever the order', () => {
    expect(worstLabel(['exported', 'waiting', 'byDesign'])).toBe('waiting')
    expect(worstLabel(['heldForInventory', 'exported', 'behind'])).toBe('behind')
    expect(worstLabel(['byDesign', 'stuck', 'heldForInventory'])).toBe('stuck')
  })

  it('ranks held for inventory below behind, so a freeze never outranks a delay', () => {
    expect(worstLabel(['heldForInventory', 'behind'] satisfies Label[])).toBe('behind')
    expect(worstLabel(['heldForInventory', 'waiting'] satisfies Label[])).toBe('heldForInventory')
  })

  it('ignores an unknown value, and answers null for nothing known', () => {
    expect(worstLabel(['quarantined', 'exported'])).toBe('exported')
    expect(worstLabel(['quarantined'])).toBeNull()
    expect(worstLabel([])).toBeNull()
  })
})

describe('unknownLabelCounts', () => {
  it('lists only the non-zero labels this bundle does not know', () => {
    expect(unknownLabelCounts({ stuck: 3, exported: 0, parked: 12, later: 0 })).toEqual([{ label: 'parked', count: 12 }])
    expect(unknownLabelCounts({ stuck: 3, behind: 1 })).toEqual([])
  })
})

describe('flagToken', () => {
  it('draws the two double-send flags as danger, and gives every flag a key that exists', () => {
    expect(flagToken('X1').token).toBe('danger')
    expect(flagToken('X1p').token).toBe('danger')
    for (const f of FLAGS) {
      const t = flagToken(f)
      expect(t.labelKey).toBe(`flags.${f}`)
      expect((en.flags as Record<string, string>)[f]).toBeTruthy()
    }
  })

  it('falls back to neutral with no key for an unknown flag', () => {
    expect(flagToken('X9')).toEqual({ token: 'neutral', labelKey: null })
  })
})

describe('accountingToken', () => {
  it('reads breaks as danger and agrees as success, each with a key that exists', () => {
    expect(accountingToken('breaks')).toEqual({ token: 'danger', labelKey: 'accounting.breaks' })
    expect(accountingToken('agrees')).toEqual({ token: 'success', labelKey: 'accounting.agrees' })
    expect(en.accounting.breaks).toBeTruthy()
    expect(en.accounting.agrees).toBeTruthy()
  })

  it('falls back to neutral for an unknown verdict', () => {
    expect(accountingToken('maybe')).toEqual({ token: 'neutral', labelKey: null })
  })
})
