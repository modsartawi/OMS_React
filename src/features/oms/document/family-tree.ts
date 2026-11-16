/**
 * **The document family tree** (ticket 906, BackOffice spec 3953 "Family panel"; ruling 3943): the
 * Family endpoint's flat member list (`GET SdDocumentWeb/Document/{no}/Family`, BackOffice 3954)
 * turned into the tree the facts column draws, always from the **family root**, so every member of a
 * family sees the same picture.
 *
 * Pure: no React, no network, no i18n.
 */
import type { DocumentFamily, DocumentFamilyNode } from '@/core/models/document-family'

/** One member, placed in the tree. */
export interface FamilyTreeNode {
  /** `category:no` — a member is keyed by both (billings and return orders share the 30… range). */
  key: string
  no: string
  category: string
  /** 0 on the root. */
  depth: number
  /** The document the page has open: tinted, tagged "You are here", never a link. */
  isOpen: boolean
  /** Where one click takes it: `/oms/delivery/:no` (D, T), `/oms/document/:no` (Q, O, X, R, E), or `null` (no page, or the open document). */
  link: string | null
  /** The member as the endpoint answered it (its facts for the row). */
  member: DocumentFamilyNode
  /** Every child, in the answer's order. */
  children: FamilyTreeNode[]
  /**
   * The children drawn while the billings are folded (ticket 907): every child but the billings past
   * the first, when this member has **more than two** billings; otherwise all of them. Answer order.
   */
  shown: FamilyTreeNode[]
  /** The billings hidden behind "+ N more billings" (N = its length); empty when nothing folds. */
  folded: FamilyTreeNode[]
}

/** The tree the panel draws. */
export interface FamilyTreeView {
  root: FamilyTreeNode
  /** The members drawn: the title's "Family (n)". Always more than one (a lone document is hidden). */
  count: number
  /** The walk hit the endpoint's cap: not every member is shown (the warning under the tree). */
  truncated: boolean
}

/** The page a member opens on, by its category (ruling 3940): a billing and the C/V memos have none. */
const PAGE: Record<string, 'delivery' | 'document'> = {
  D: 'delivery',
  T: 'delivery',
  Q: 'document',
  O: 'document',
  X: 'document',
  R: 'document',
  E: 'document',
}

/** The route a member of this category opens on, or `null` when it has no page. */
export function familyLink(no: string, category: string): string | null {
  const page = PAGE[category.trim()]
  return page ? `/oms/${page}/${encodeURIComponent(no.trim())}` : null
}

/** The endpoint's member cap (BackOffice 3954): a family past it answers `truncated` — the warning's number. */
export const FAMILY_MEMBER_CAP = 100

/** Under one parent, billings fold when there are more than this many. */
const FOLD_OVER = 2

/** Splits a parent's children into those drawn and the billings folded past the first (ticket 907). */
function fold(children: FamilyTreeNode[]): { shown: FamilyTreeNode[]; folded: FamilyTreeNode[] } {
  const billings = children.filter((c) => c.category === 'B')
  if (billings.length <= FOLD_OVER) return { shown: children, folded: [] }
  const folded = new Set(billings.slice(1))
  return { shown: children.filter((c) => !folded.has(c)), folded: billings.slice(1) }
}

const keyOf = (no: string | null | undefined, category: string | null | undefined) =>
  `${(category ?? '').trim()}:${(no ?? '').trim()}`

/**
 * The tree of a family answer, or `null` — no section — when the document stands alone (one member)
 * or the answer cannot be drawn (none, no nodes, a root not among them).
 *
 * - Drawn from the root the endpoint names, so every member of a family sees the same picture.
 * - Children keep the answer's order: the server orders them by entry time, then number.
 * - A member is keyed by number AND category, so a billing and a return order sharing a 30… number
 *   stay two members. A key repeated in the answer is drawn once (the first), and a link that loops
 *   back to a member already drawn ends there.
 * - `count` is the members drawn — the title's n.
 */
export function familyTree(family: DocumentFamily | null | undefined): FamilyTreeView | null {
  if (!family || !Array.isArray(family.nodes)) return null
  const members = new Map<string, DocumentFamilyNode>()
  for (const n of family.nodes) {
    if (!n || typeof n.no !== 'string' || typeof n.category !== 'string') continue
    const key = keyOf(n.no, n.category)
    if (!members.has(key)) members.set(key, n)
  }
  const byParent = new Map<string, DocumentFamilyNode[]>()
  for (const n of members.values()) {
    if (n.parentNo == null) continue
    const parent = keyOf(n.parentNo, n.parentCategory)
    byParent.set(parent, [...(byParent.get(parent) ?? []), n])
  }
  const rootMember = members.get(keyOf(family.rootNo, family.rootCategory))
  if (!rootMember) return null
  const openKey = keyOf(family.askedNo, family.askedCategory)
  const drawn = new Set<string>()
  const place = (member: DocumentFamilyNode, depth: number): FamilyTreeNode => {
    const key = keyOf(member.no, member.category)
    drawn.add(key)
    const isOpen = key === openKey
    const children = (byParent.get(key) ?? [])
      .filter((child) => !drawn.has(keyOf(child.no, child.category)))
      .map((child) => place(child, depth + 1))
    return {
      key,
      no: member.no.trim(),
      category: member.category.trim(),
      depth,
      isOpen,
      link: isOpen ? null : familyLink(member.no, member.category),
      member,
      children,
      ...fold(children),
    }
  }
  const root = place(rootMember, 0)
  if (drawn.size <= 1) return null
  return { root, count: drawn.size, truncated: family.truncated === true }
}

/** The categories with a name of their own under `document:family.categories`. */
const NAMED_CATEGORIES = new Set(['Q', 'O', 'X', 'D', 'T', 'R', 'E', 'B', 'C', 'V'])

/** The `document` key of a category's name (the badge's tooltip and the meta line); an unlisted one reads as "Document". */
export function familyCategoryKey(category: string): string {
  const c = (category ?? '').trim()
  return `family.categories.${NAMED_CATEGORIES.has(c) ? c : 'unknown'}`
}

/** The query key of a document's family read (ticket 906), by the record's number and category. */
export const familyKey = (documentNo: string, category: string) =>
  ['document', 'family', (documentNo ?? '').trim(), (category ?? '').trim()] as const
