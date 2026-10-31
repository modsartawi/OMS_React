// The kept bundle's tree (oms 697; BackOffice spec 3271 stories 5-8, 3262 V3, door 3283). Pure: no React, no http.
//
// The client never builds a path. A node carries the door's own reference, a click sends that reference back, and the
// door answers with the path: an array position as a `where()`, a choice type as `ofType()`, inside `Claim.item` a line
// field. Nothing here reads a bundle value except to show it.
//
// ⚠️ PROVISIONAL: 3283 names the endpoint and spells no shape; 711 reconciles.

import type { FhirFactType, FhirLevel, FhirMessage } from '@/core/insurance-rules/fhir-catalog'
import type { Says } from '@/core/insurance-rules/model'
import type { RawPathValues } from './raw-path'

export interface TreeNode {
  /** The door's handle for this node. Opaque: never parsed, never built here. */
  nodeRef: string
  name: string
  /** The position when the element repeats. */
  index?: number | null
  /** A choice type (`value[x]`); `fhirType` is the one the bundle chose. */
  choice?: boolean
  fhirType: string
  value?: string | number | boolean | null
  /** A value, or a whole Money, Quantity or code: the door says what can be clicked. */
  pickable?: boolean
  children?: TreeNode[] | null
}

export interface BundleTree {
  ref: string
  root: TreeNode
}

export interface TreeRow {
  nodeRef: string
  depth: number
  /** One machine value: isolate it once. */
  label: string
  fhirType: string
  value: string | null
  pickable: boolean
  expandable: boolean
  expanded: boolean
}

const nodeLabel = (n: TreeNode): string => (n.choice ? `${n.name}[x]` : n.index == null ? n.name : `${n.name}[${n.index}]`)

/** The rows on screen, depth first. `collapsed` holds the node references the author closed. */
export function treeRows(root: TreeNode, collapsed: ReadonlySet<string>): TreeRow[] {
  const out: TreeRow[] = []
  const walk = (n: TreeNode, depth: number) => {
    const children = n.children ?? []
    const expanded = !collapsed.has(n.nodeRef)
    out.push({
      nodeRef: n.nodeRef,
      depth,
      label: nodeLabel(n),
      fhirType: n.fhirType,
      value: n.value == null ? null : String(n.value),
      pickable: !!n.pickable,
      expandable: children.length > 0,
      expanded,
    })
    if (expanded) for (const c of children) walk(c, depth + 1)
  }
  walk(root, 0)
  return out
}

export interface TreeProposal {
  path: string
  moment: FhirMessage
  level: FhirLevel
  type: FhirFactType
  cardinality: 'single' | 'list'
  system?: string | null
  /** The door may suggest one; the author can always change it. */
  key?: string | null
}

export interface ExistingField {
  key: string
  moment: FhirMessage
  level: FhirLevel
  label: Says
}

export interface TreeClickReply {
  proposal: TreeProposal
  /** The field already on this path, when there is one. */
  existing: ExistingField | null
  /** A Patient-resource path: warned about, never refused (PDPL, V3). */
  patient: boolean
}

export type ClickOutcome = { kind: 'existing'; field: ExistingField } | { kind: 'propose'; initial: Partial<RawPathValues> }

export function clickOutcome(reply: TreeClickReply): ClickOutcome {
  if (reply.existing) return { kind: 'existing', field: reply.existing }
  const { path, moment, level, type, cardinality, system, key } = reply.proposal
  return {
    kind: 'propose',
    initial: { path, moment, level, type, cardinality, system: system ?? '', ...(key ? { key } : {}), ...(reply.patient ? { patientWarning: true } : {}) },
  }
}

// ── The doors as built (3283). A kept copy is named by its kind and id; the screen holds them as one ref.

export interface TreeSample {
  kind: string
  keptId: string
  source?: string | null
  payer?: string | null
  eventType?: string | null
  keptAt?: string | null
}

export const sampleRef = (s: Pick<TreeSample, 'kind' | 'keptId'>): string => `${s.kind}/${s.keptId}`

/** The kind and id a ref holds; null when it is not a ref at all, which the screen says rather than sends. */
export function refParts(ref: string): { kind: string; keptId: string } | null {
  const at = ref.indexOf('/')
  return at > 0 && at < ref.length - 1 ? { kind: ref.slice(0, at), keptId: ref.slice(at + 1) } : null
}

export interface TreeDoorNode {
  id: string
  name: string
  index?: number | null
  type?: string | null
  value?: string | null
  clickable?: boolean
  children?: TreeDoorNode[] | null
}

export const treeNodeOf = (n: TreeDoorNode): TreeNode => ({
  nodeRef: n.id,
  name: n.name,
  index: n.index ?? null,
  fhirType: n.type ?? '',
  value: n.value ?? null,
  pickable: !!n.clickable,
  children: (n.children ?? []).map(treeNodeOf),
})

export interface TreeClickDoorReply {
  scope: string
  type: FhirFactType
  cardinality: 'single' | 'list'
  system?: string | null
  fhirPath: string
  existing?: { key: string; labelEn?: string | null; labelAr?: string | null }[] | null
  notices?: { code: string }[] | null
}

export function treeClickOf(r: TreeClickDoorReply): TreeClickReply {
  const level: FhirLevel = r.scope.startsWith('line.') ? 'line' : 'message'
  const moment = (level === 'line' ? r.scope.slice('line.'.length) : r.scope) as FhirMessage
  const existing = r.existing?.[0]
  return {
    proposal: { path: r.fhirPath, moment, level, type: r.type, cardinality: r.cardinality, system: r.system || null },
    existing: existing ? { key: existing.key, moment, level, label: { en: existing.labelEn ?? '', ar: existing.labelAr ?? '' } } : null,
    patient: (r.notices ?? []).some((n) => n.code === 'patient'),
  }
}

/** The one thing of a bundle the URL may hold. */
export const bundleParam = (raw: string | null): string | null => raw?.trim() || null
