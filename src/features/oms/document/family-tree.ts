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
  /** Where one click takes it, from the server's `pageKind`: `/oms/delivery/:no`, `/oms/document/:no`, or `null` (no page, or the open document). */
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
  /** Members whose parent is not in the answer, each a top-level row (depth 0) after the root's tree. */
  orphans: FamilyTreeNode[]
  /** The members drawn: the title's "Family (n)". Always more than one (a lone document is hidden). */
  count: number
  /** The walk hit the endpoint's cap: not every member is shown (the warning under the tree). */
  truncated: boolean
}

/** The route a member opens on, from the server's `pageKind` (ruling 3940), or `null` when it has none. */
export function familyLink(no: string, pageKind: DocumentFamilyNode['pageKind'] | undefined): string | null {
  return pageKind === 'delivery' || pageKind === 'document' ? `/oms/${pageKind}/${encodeURIComponent(no.trim())}` : null
}

/**
 * What the panel knows of a category, in one table: whether it has a name of its own under
 * `document:family.categories`, its badge tint (categorical, not a severity: an order blue, a delivery
 * green, a return red, a page-less member neutral — the prototype's palette, 3943, on the theme's
 * tokens), whether it folds as a billing, and the tooltip of a member with no page (the billing's only;
 * the C/V memos carry none — unruled). Where a member opens is never read from here: that is `pageKind`.
 */
interface FamilyCategory {
  badge: string
  billing?: true
  noPageKey?: string
}
const NEUTRAL = 'bg-muted text-muted-foreground'
const CATEGORIES: Record<string, FamilyCategory> = {
  Q: { badge: 'bg-attention-050 text-attention-800' },
  O: { badge: 'bg-primary-050 text-primary-800' },
  X: { badge: 'bg-primary-050 text-primary-800' },
  D: { badge: 'bg-success-050 text-success-800' },
  T: { badge: 'bg-danger-050 text-danger-800' },
  R: { badge: 'bg-danger-050 text-danger-800' },
  E: { badge: 'bg-danger-050 text-danger-800' },
  B: { badge: NEUTRAL, billing: true, noPageKey: 'family.noPage.billing' },
  C: { badge: NEUTRAL },
  V: { badge: NEUTRAL },
}
const UNKNOWN: FamilyCategory = { badge: NEUTRAL }

/** A category's row in the table; an unlisted one reads as the unknown "Document". */
export function familyCategory(category: string): FamilyCategory & { nameKey: string } {
  const c = (category ?? '').trim()
  const known = Object.hasOwn(CATEGORIES, c)
  return { ...(known ? CATEGORIES[c] : UNKNOWN), nameKey: `family.categories.${known ? c : 'unknown'}` }
}

/** The `document` key of a category's name (the badge's tooltip and the meta line). */
export const familyCategoryKey = (category: string): string => familyCategory(category).nameKey

/** Under one parent, billings fold when there are more than this many. */
const FOLD_OVER = 2

/** Splits a parent's children into those drawn and the billings folded past the first (ticket 907). */
function fold(children: FamilyTreeNode[]): { shown: FamilyTreeNode[]; folded: FamilyTreeNode[] } {
  const billings = children.filter((c) => familyCategory(c.category).billing)
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
 * - A member whose parent is not in the answer (an orphan) is drawn as a top-level row after the root's tree.
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
      link: isOpen ? null : familyLink(member.no, member.pageKind),
      member,
      children,
      ...fold(children),
    }
  }
  const root = place(rootMember, 0)
  // An orphan — a member whose family-link parent is not in the answer — is drawn as a top-level row
  // after the root's tree, with whatever hangs under it, so the count and "You are here" agree with
  // the answer. Answer order; one already drawn (under another orphan) is not drawn again.
  const orphans: FamilyTreeNode[] = []
  for (const [key, member] of members) {
    if (drawn.has(key) || member.parentNo == null) continue
    if (members.has(keyOf(member.parentNo, member.parentCategory))) continue
    orphans.push(place(member, 0))
  }
  if (drawn.size <= 1) return null
  return { root, orphans, count: drawn.size, truncated: family.truncated === true }
}
