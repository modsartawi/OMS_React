/** Oms 697 (BackOffice spec 3271 stories 5-8; 3262 V3; door 3283): the kept bundle as rows, and what a click answers. */
import { describe, expect, it } from 'vitest'
import en from '@/locales/en/insurance-fields.json'
import ar from '@/locales/ar/insurance-fields.json'
import { bundleParam, clickOutcome, treeRows, type TreeClickReply, type TreeNode } from './bundle-tree'

const leaf = (nodeRef: string, name: string, value: string | number | boolean, over: Partial<TreeNode> = {}): TreeNode => ({ nodeRef, name, fhirType: 'string', value, pickable: true, ...over })

const ROOT: TreeNode = {
  nodeRef: 'n0',
  name: 'Claim',
  fhirType: 'Claim',
  children: [
    {
      nodeRef: 'n1',
      name: 'item',
      index: 0,
      fhirType: 'BackboneElement',
      children: [
        {
          nodeRef: 'n2',
          name: 'adjudication',
          index: 1,
          fhirType: 'BackboneElement',
          children: [{ nodeRef: 'n3', name: 'value', choice: true, fhirType: 'Money', pickable: true, children: [leaf('n4', 'value', 12.5, { fhirType: 'decimal' })] }],
        },
      ],
    },
    { nodeRef: 'n5', name: 'item', index: 1, fhirType: 'BackboneElement', children: [leaf('n6', 'sequence', 0, { fhirType: 'positiveInt' })] },
    leaf('n7', 'status', 'active', { pickable: false }),
  ],
}

describe('the tree as rows', () => {
  it('walks nested arrays depth-first and every row keeps its own node reference', () => {
    expect(treeRows(ROOT, new Set()).map((r) => [r.nodeRef, r.depth, r.label])).toEqual([
      ['n0', 0, 'Claim'],
      ['n1', 1, 'item[0]'],
      ['n2', 2, 'adjudication[1]'],
      ['n3', 3, 'value[x]'],
      ['n4', 4, 'value'],
      ['n5', 1, 'item[1]'],
      ['n6', 2, 'sequence'],
      ['n7', 1, 'status'],
    ])
  })
  it('two positions of one array stay two references', () => {
    const items = treeRows(ROOT, new Set()).filter((r) => r.label.startsWith('item['))
    expect(items.map((r) => r.nodeRef)).toEqual(['n1', 'n5'])
  })
  it('a choice type names its chosen type and is clickable whole', () => {
    expect(treeRows(ROOT, new Set()).find((r) => r.nodeRef === 'n3')).toMatchObject({ fhirType: 'Money', pickable: true, value: null, expandable: true })
  })
  it('a collapsed node hides what is under it, and only that', () => {
    const rows = treeRows(ROOT, new Set(['n1']))
    expect(rows.map((r) => r.nodeRef)).toEqual(['n0', 'n1', 'n5', 'n6', 'n7'])
    expect(rows[1]).toMatchObject({ expandable: true, expanded: false })
  })
  it('a falsy value is still a value, a missing one is none, and only the door makes a node clickable', () => {
    const rows = treeRows(ROOT, new Set())
    expect(rows.find((r) => r.nodeRef === 'n6')?.value).toBe('0')
    expect(rows.find((r) => r.nodeRef === 'n0')?.value).toBeNull()
    expect(rows.find((r) => r.nodeRef === 'n0')?.pickable).toBe(false)
    expect(rows.find((r) => r.nodeRef === 'n7')).toMatchObject({ value: 'active', pickable: false, expandable: false })
    expect(treeRows(leaf('b', 'active', false), new Set())[0].value).toBe('false')
  })
})

describe('what a click answers', () => {
  const proposal = { path: "adjudication.where(category.coding.code = 'copay').amount", moment: 'claimResponse', level: 'line', type: 'money', cardinality: 'single', system: null } as const
  const reply = (over: Partial<TreeClickReply> = {}): TreeClickReply => ({ proposal, existing: null, patient: false, ...over })

  it('fills the raw-path form with the door path, untouched', () => {
    expect(clickOutcome(reply())).toEqual({
      kind: 'propose',
      initial: { path: proposal.path, moment: 'claimResponse', level: 'line', type: 'money', cardinality: 'single', system: '' },
    })
  })
  it('keeps a code system and a key the door suggests', () => {
    expect(clickOutcome(reply({ proposal: { ...proposal, type: 'code', system: 'http://x', key: 'lineOutcome' } }))).toMatchObject({ initial: { system: 'http://x', key: 'lineOutcome' } })
  })
  it('a Patient field is not refused: the form opens and the warning goes with it', () => {
    expect(clickOutcome(reply({ patient: true }))).toMatchObject({ kind: 'propose', initial: { path: proposal.path, patientWarning: true } })
  })
  it('an existing field is pointed at, instead of offering a duplicate', () => {
    const existing = { key: 'lineCopay', moment: 'claimResponse', level: 'line', label: { en: 'Line copay', ar: 'نسبة التحمل' } } as const
    expect(clickOutcome(reply({ existing }))).toEqual({ kind: 'existing', field: existing })
  })
})

describe('the bundle ref', () => {
  it('is the trimmed ref, or nothing', () => {
    expect(bundleParam(' KB-1 ')).toBe('KB-1')
    expect(bundleParam('   ')).toBeNull()
    expect(bundleParam(null)).toBeNull()
  })
})

describe('the tree words', () => {
  function leaves(node: unknown, prefix = ''): string[] {
    if (typeof node !== 'object' || node === null) return [prefix]
    return Object.entries(node).flatMap(([k, v]) => leaves(v, prefix ? `${prefix}.${k}` : k))
  }
  it('en and ar hold the same keys', () => {
    expect(leaves(ar.tree).sort()).toEqual(leaves(en.tree).sort())
  })
})
