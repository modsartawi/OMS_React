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

  it('a delivery or return delivery opens on the delivery page; a request, order, ERX, return order or E on the document page', () => {
    const tree = familyTree({
      askedNo: '9000012345',
      askedCategory: 'Q',
      rootNo: '9000012345',
      rootCategory: 'Q',
      truncated: false,
      nodes: [
        node('9000012345', 'Q', null),
        node('1001299001', 'O', ['9000012345', 'Q']),
        node('1001299002', 'X', ['9000012345', 'Q']),
        node('8007123470', 'D', ['1001299001', 'O']),
        node('3000000018', 'R', ['8007123470', 'D']),
        node('6000000011', 'T', ['3000000018', 'R']),
        node('3000000019', 'E', ['8007123470', 'D']),
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
