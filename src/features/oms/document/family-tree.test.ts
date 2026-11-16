/**
 * The document family tree (ticket 906, BackOffice spec 3953 "Family panel", Seam 2): the Family
 * endpoint's flat node list becomes an ordered tree drawn from the family root, each member with its
 * depth, whether it is the open document, and where one click takes it.
 */
import { describe, expect, it } from 'vitest'
import type { DocumentFamily, DocumentFamilyNode } from '@/core/models/document-family'
import { familyTree, type FamilyTreeNode } from './family-tree'

/** One member as the endpoint answers it; the facts the tree does not read are filled plainly. */
function node(no: string, category: string, parent: [string, string] | null, extra: Partial<DocumentFamilyNode> = {}): DocumentFamilyNode {
  return {
    no,
    category,
    parentNo: parent?.[0] ?? null,
    parentCategory: parent?.[1] ?? null,
    documentType: null,
    documentTypeDescription: null,
    status: null,
    statusDescription: null,
    storeCode: 'J044',
    storeName: 'Jeddah 44',
    entryTime: '2026-11-09T09:12:00',
    pageKind: null,
    partnerReference: null,
    tillInvoiceNo: null,
    ...extra,
  }
}

/** The Bupa order 1005551234 delivered in two parts (the prototype's second family), asked from its second delivery. */
const SPLIT: DocumentFamily = {
  askedNo: '8007000002',
  askedCategory: 'D',
  rootNo: '1005551234',
  rootCategory: 'O',
  truncated: false,
  nodes: [
    node('1005551234', 'O', null),
    node('8007000001', 'D', ['1005551234', 'O']),
    node('3007700101', 'B', ['8007000001', 'D'], { tillInvoiceNo: 'J044-0551100' }),
    node('8007000002', 'D', ['1005551234', 'O']),
  ],
}

/** The tree in reading order: `depth no/category`, one line per member. */
function outline(root: FamilyTreeNode): string[] {
  const walk = (n: FamilyTreeNode): string[] => [`${n.depth} ${n.no}/${n.category}`, ...n.children.flatMap(walk)]
  return walk(root)
}

describe('family tree: drawn from the root, in order, with depth', () => {
  it('an order with two deliveries asked from its second delivery starts at the order, and each delivery sits one level under it', () => {
    const tree = familyTree(SPLIT)!
    expect(outline(tree.root)).toEqual([
      '0 1005551234/O',
      '1 8007000001/D',
      '2 3007700101/B',
      '1 8007000002/D',
    ])
  })
})

describe('family tree: siblings keep the order the endpoint gives them', () => {
  it('two deliveries under one order stay in the answer\'s order (entry time, then number, fixed by the server), even listed after a grandchild', () => {
    const tree = familyTree({
      askedNo: '1001299001',
      askedCategory: 'O',
      rootNo: '9000012345',
      rootCategory: 'Q',
      truncated: false,
      nodes: [
        node('9000012345', 'Q', null),
        node('1001299001', 'O', ['9000012345', 'Q']),
        node('3007799001', 'B', ['8007123470', 'D']),
        node('8007123470', 'D', ['1001299001', 'O']),
        node('8007123456', 'D', ['1001299001', 'O']),
      ],
    })!
    expect(outline(tree.root)).toEqual([
      '0 9000012345/Q',
      '1 1001299001/O',
      '2 8007123470/D',
      '3 3007799001/B',
      '2 8007123456/D',
    ])
  })

  it('a return delivery asked for itself reaches the order: O → D → (B, R → T), and a billing and a return order sharing a 30… number stay apart', () => {
    const tree = familyTree({
      askedNo: '6000000011',
      askedCategory: 'T',
      rootNo: '1001234567',
      rootCategory: 'O',
      truncated: false,
      nodes: [
        node('1001234567', 'O', null),
        node('8006522080', 'D', ['1001234567', 'O']),
        node('3000000018', 'B', ['8006522080', 'D']),
        node('3000000018', 'R', ['8006522080', 'D']),
        node('6000000011', 'T', ['3000000018', 'R']),
      ],
    })!
    expect(outline(tree.root)).toEqual([
      '0 1001234567/O',
      '1 8006522080/D',
      '2 3000000018/B',
      '2 3000000018/R',
      '3 6000000011/T',
    ])
  })
})

/** Every member in reading order. */
const members = (root: FamilyTreeNode): FamilyTreeNode[] => [root, ...root.children.flatMap(members)]

describe('family tree: the open document and where one click takes each member', () => {
  it('the asked member is the open one, and only it', () => {
    const tree = familyTree(SPLIT)!
    expect(members(tree.root).filter((n) => n.isOpen).map((n) => n.key)).toEqual(['D:8007000002'])
  })

  it('a member opens where the server’s pageKind says: "delivery" on the delivery page, "document" on the document page', () => {
    const tree = familyTree({
      askedNo: '9000012345',
      askedCategory: 'Q',
      rootNo: '9000012345',
      rootCategory: 'Q',
      truncated: false,
      nodes: [
        node('9000012345', 'Q', null, { pageKind: 'document' }),
        node('1001299001', 'O', ['9000012345', 'Q'], { pageKind: 'document' }),
        node('1001299002', 'X', ['9000012345', 'Q'], { pageKind: 'document' }),
        node('8007123470', 'D', ['1001299001', 'O'], { pageKind: 'delivery' }),
        node('3000000018', 'R', ['8007123470', 'D'], { pageKind: 'document' }),
        node('6000000011', 'T', ['3000000018', 'R'], { pageKind: 'delivery' }),
        node('3000000019', 'E', ['8007123470', 'D'], { pageKind: 'document' }),
      ],
    })!
    expect(Object.fromEntries(members(tree.root).map((n) => [n.key, n.link]))).toEqual({
      'Q:9000012345': null, // the open document is never a link
      'O:1001299001': '/oms/document/1001299001',
      'X:1001299002': '/oms/document/1001299002',
      'D:8007123470': '/oms/delivery/8007123470',
      'R:3000000018': '/oms/document/3000000018',
      'T:6000000011': '/oms/delivery/6000000011',
      'E:3000000019': '/oms/document/3000000019',
    })
  })

  it('the link follows pageKind, not the category: a null pageKind is no link even on an order, and the server may send a category to either page', () => {
    const tree = familyTree({
      ...SPLIT,
      nodes: [
        node('1005551234', 'O', null, { pageKind: null }),
        node('8007000001', 'D', ['1005551234', 'O'], { pageKind: 'document' }),
        node('3007700101', 'B', ['8007000001', 'D'], { pageKind: null }),
        node('8007000002', 'D', ['1005551234', 'O'], { pageKind: 'delivery' }),
      ],
      askedNo: '3007700101',
      askedCategory: 'B',
    })!
    expect(Object.fromEntries(members(tree.root).map((n) => [n.key, n.link]))).toEqual({
      'O:1005551234': null,
      'D:8007000001': '/oms/document/8007000001',
      'B:3007700101': null,
      'D:8007000002': '/oms/delivery/8007000002',
    })
  })

  it('a billing has no page, so no link; neither do the C and V memos', () => {
    const tree = familyTree({
      ...SPLIT,
      nodes: [...SPLIT.nodes, node('7000000001', 'C', ['8007000001', 'D']), node('7000000002', 'V', ['8007000001', 'D'])],
    })!
    const links = Object.fromEntries(members(tree.root).map((n) => [n.key, n.link]))
    expect([links['B:3007700101'], links['C:7000000001'], links['V:7000000002']]).toEqual([null, null, null])
  })

  it('the open delivery is found by number and category, and a number with spaces around it still matches', () => {
    const tree = familyTree({ ...SPLIT, askedNo: ' 8007000001 ', askedCategory: 'D' })!
    expect(members(tree.root).filter((n) => n.isOpen).map((n) => n.key)).toEqual(['D:8007000001'])
  })
})

describe('family tree: the title\'s count, and a document that stands alone shows no section', () => {
  it('the count is every member, billings included: Family (4)', () => {
    expect(familyTree(SPLIT)!.count).toBe(4)
  })

  it('a lone document (one node) is hidden', () => {
    expect(familyTree({ ...SPLIT, askedNo: '1005551234', askedCategory: 'O', nodes: [node('1005551234', 'O', null)] })).toBeNull()
  })

  it('no answer, an empty list, or an answer whose root is not among its nodes is hidden, never a crash', () => {
    expect(familyTree(null)).toBeNull()
    expect(familyTree(undefined)).toBeNull()
    expect(familyTree({ ...SPLIT, nodes: [] })).toBeNull()
    expect(familyTree({ ...SPLIT, nodes: null as unknown as DocumentFamilyNode[] })).toBeNull()
    expect(familyTree({ ...SPLIT, rootNo: '1999999999' })).toBeNull()
  })

  it('a member repeated in the answer, or a link that loops back, is drawn once and the walk ends', () => {
    const tree = familyTree({
      ...SPLIT,
      nodes: [...SPLIT.nodes, node('8007000001', 'D', ['1005551234', 'O']), node('1005551234', 'O', ['3007700101', 'B'])],
    })!
    expect(outline(tree.root)).toEqual(['0 1005551234/O', '1 8007000001/D', '2 3007700101/B', '1 8007000002/D'])
    expect(tree.count).toBe(4)
  })
})

describe('family tree: a member whose parent is not in the answer (an orphan) never vanishes', () => {
  it('it is drawn as an extra top-level row after the root’s tree, at depth 0, with its own children, and counted', () => {
    const tree = familyTree({
      ...SPLIT,
      nodes: [
        ...SPLIT.nodes,
        node('8007000009', 'D', ['1009999999', 'O']),
        node('3007700909', 'B', ['8007000009', 'D']),
      ],
    })!
    expect(outline(tree.root)).toEqual(['0 1005551234/O', '1 8007000001/D', '2 3007700101/B', '1 8007000002/D'])
    expect(tree.orphans.flatMap(outline)).toEqual(['0 8007000009/D', '1 3007700909/B'])
    expect(tree.count).toBe(6)
  })

  it('an orphan that is the open document is the one "You are here"', () => {
    const tree = familyTree({
      ...SPLIT,
      askedNo: '8007000009',
      askedCategory: 'D',
      nodes: [...SPLIT.nodes, node('8007000009', 'D', ['1009999999', 'O'], { pageKind: 'delivery' })],
    })!
    const all = [...members(tree.root), ...tree.orphans.flatMap(members)]
    expect(all.filter((n) => n.isOpen).map((n) => n.key)).toEqual(['D:8007000009'])
    expect(tree.orphans[0].link).toBeNull()
  })

  it('a family with no orphans has none', () => {
    expect(familyTree(SPLIT)!.orphans).toEqual([])
  })

  it('a root alone with only orphans beside it still shows (two members drawn)', () => {
    const tree = familyTree({ ...SPLIT, askedNo: '1005551234', askedCategory: 'O', nodes: [node('1005551234', 'O', null), node('8007000009', 'D', ['1009999999', 'O'])] })!
    expect(tree.count).toBe(2)
  })
})

/** A delivery's billings, by number, under order 1000887766 → delivery 8005000012 (the prototype's big family). */
function billed(count: number, extra: DocumentFamilyNode[] = []): DocumentFamily {
  const nodes = [node('1000887766', 'O', null), node('8005000012', 'D', ['1000887766', 'O'])]
  for (let b = 1; b <= count; b++) nodes.push(node(`300502000${b}`, 'B', ['8005000012', 'D']))
  return { askedNo: '8005000012', askedCategory: 'D', rootNo: '1000887766', rootCategory: 'O', truncated: false, nodes: [...nodes, ...extra] }
}
const delivery = (tree: { root: FamilyTreeNode }) => tree.root.children[0]
const keys = (ns: FamilyTreeNode[]) => ns.map((n) => n.key)

describe('family tree: billings fold under a parent with more than two', () => {
  it('six billings under one delivery: only the first shows, five are folded behind "+ 5 more billings", and the count is all eight', () => {
    const tree = familyTree(billed(6))!
    expect(keys(delivery(tree).shown)).toEqual(['B:3005020001'])
    expect(keys(delivery(tree).folded)).toEqual(['B:3005020002', 'B:3005020003', 'B:3005020004', 'B:3005020005', 'B:3005020006'])
    expect(tree.count).toBe(8)
  })

  it('two billings both show, nothing folds', () => {
    const tree = familyTree(billed(2))!
    expect(keys(delivery(tree).shown)).toEqual(['B:3005020001', 'B:3005020002'])
    expect(delivery(tree).folded).toEqual([])
  })

  it('three billings fold to one; a return order beside them is never folded and keeps its place in the answer\'s order', () => {
    const tree = familyTree({
      ...billed(1),
      nodes: [
        ...billed(1).nodes,
        node('3000000018', 'R', ['8005000012', 'D']),
        node('3005020002', 'B', ['8005000012', 'D']),
        node('3005020003', 'B', ['8005000012', 'D']),
      ],
    })!
    expect(keys(delivery(tree).shown)).toEqual(['B:3005020001', 'R:3000000018'])
    expect(keys(delivery(tree).folded)).toEqual(['B:3005020002', 'B:3005020003'])
    expect(keys(delivery(tree).children)).toEqual(['B:3005020001', 'R:3000000018', 'B:3005020002', 'B:3005020003'])
  })

  it('a parent with no billings shows every child', () => {
    const tree = familyTree(SPLIT)!
    expect(keys(tree.root.shown)).toEqual(['D:8007000001', 'D:8007000002'])
    expect(tree.root.folded).toEqual([])
  })
})

describe('family tree: a family cut short at the cap', () => {
  it('an answer marked truncated is drawn, and says so', () => {
    expect(familyTree({ ...SPLIT, truncated: true })!.truncated).toBe(true)
  })

  it('a whole answer is not truncated, nor one that leaves the flag out', () => {
    expect(familyTree(SPLIT)!.truncated).toBe(false)
    expect(familyTree({ ...SPLIT, truncated: undefined as unknown as boolean })!.truncated).toBe(false)
  })
})
