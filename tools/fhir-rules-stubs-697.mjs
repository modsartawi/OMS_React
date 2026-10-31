// Stubs for oms 697 (BackOffice spec 3271, door 3283), on the real envelope. As built (oms 711).
//   GET  InsuranceRules/Fields/Tree/Samples                → [{ kind, keptId, source, payer, eventType, keptAt }]
//   POST InsuranceRules/Fields/Tree/Open { kind, keptId }  → the root node { id, name, index, type, value, clickable, children }
//   POST InsuranceRules/Fields/Tree/Click { kind, keptId, node } → { scope, type, cardinality, system, fhirPath, existing, notices }
// The path is the stub's, as it will be the door's: the client never builds one. Every value is synthetic.
import { envelope } from './insurance-rules-stubs.mjs'

export const KEPT = { kind: 'answer', keptId: 'KB-SYN-1' }
export const BUNDLE_REF = `${KEPT.kind}/${KEPT.keptId}`
/** Found on screen, and nowhere else: not in a URL, in storage, in the console or in a request. */
export const SENTINEL = 'SYNTHETIC-VALUE-697'

const leaf = (nodeRef, name, value, fhirType = 'string', over = {}) => ({ nodeRef, name, value, fhirType, pickable: true, ...over })

export const TREE = {
  ref: BUNDLE_REF,
  root: {
    nodeRef: 'root',
    name: 'ClaimResponse',
    fhirType: 'ClaimResponse',
    children: [
      leaf('status', 'status', SENTINEL, 'code'),
      {
        nodeRef: 'item0',
        name: 'item',
        index: 0,
        fhirType: 'BackboneElement',
        children: [
          {
            nodeRef: 'item0.adj1',
            name: 'adjudication',
            index: 1,
            fhirType: 'BackboneElement',
            children: [
              {
                nodeRef: 'item0.adj1.amount',
                name: 'amount',
                fhirType: 'Money',
                pickable: true,
                children: [leaf('item0.adj1.amount.value', 'value', 12.5, 'decimal', { pickable: false }), leaf('item0.adj1.amount.currency', 'currency', 'SAR', 'code', { pickable: false })],
              },
            ],
          },
        ],
      },
      {
        nodeRef: 'item1',
        name: 'item',
        index: 1,
        fhirType: 'BackboneElement',
        children: [{ nodeRef: 'item1.benefit', name: 'allowed', choice: true, fhirType: 'Money', pickable: true, children: [leaf('item1.benefit.value', 'value', 0, 'decimal', { pickable: false })] }],
      },
      leaf('patient.birthDate', 'birthDate', '1900-01-01', 'date'),
      leaf('existing', 'outcome', 'complete', 'code'),
    ],
  },
}

const proposal = (path, moment, level, type, over = {}) => ({ path, moment, level, type, cardinality: 'single', system: null, ...over })

export const LINE_PATH = "adjudication.where(category.coding.code = 'copay').amount"
export const CHOICE_PATH = 'benefit.allowed.ofType(Money)'
export const PATIENT_PATH = 'Patient.birthDate'

export const CLICKS = {
  status: { proposal: proposal('status', 'claimResponse', 'message', 'code', { system: 'http://hl7.org/fhir/fm-status' }), existing: null, patient: false },
  'item0.adj1.amount': { proposal: proposal(LINE_PATH, 'claimResponse', 'line', 'money'), existing: null, patient: false },
  'item1.benefit': { proposal: proposal(CHOICE_PATH, 'claimResponse', 'line', 'money'), existing: null, patient: false },
  'patient.birthDate': { proposal: proposal(PATIENT_PATH, 'eligibility', 'message', 'date'), existing: null, patient: true },
}

const wireNode = (n) => ({
  id: n.nodeRef,
  name: n.name,
  index: n.index ?? null,
  type: n.fhirType ?? '',
  value: n.value === undefined || n.value === null ? null : String(n.value),
  clickable: !!n.pickable,
  children: (n.children ?? []).map(wireNode),
})

const wireClick = ({ proposal: p, existing, patient }) => ({
  scope: p.level === 'line' ? `line.${p.moment}` : p.moment,
  type: p.type,
  cardinality: p.cardinality,
  system: p.system ?? null,
  fhirPath: p.path,
  existing: existing ? [{ key: existing.key, labelEn: existing.label?.en ?? '', labelAr: existing.label?.ar ?? '' }] : [],
  notices: patient ? [{ code: 'patient', en: 'Reads Patient data.', ar: '' }] : [],
})

/** The doors, or null to fall through. `state.existing` is the catalog row door 3283 points at; `state.clicks` collects the bodies. */
export function bundleTreeStub(method, path, body, state = {}) {
  if (method === 'GET' && path === 'InsuranceRules/Fields/Tree/Samples')
    return envelope([{ ...KEPT, source: 'nphies', payer: 'BUPA', eventType: 'priorauth-response', keptAt: '2026-10-20T09:00:00' }])
  if (method === 'POST' && path === 'InsuranceRules/Fields/Tree/Open') {
    const ref = `${body?.kind}/${body?.keptId}`
    state.treeRefs?.push(ref)
    if (ref !== BUNDLE_REF) return envelope(null, { status: 404, success: false, message: 'No kept bundle has this reference.', errorCode: 'INSFIELDS_NOT_FOUND' })
    return envelope(wireNode(TREE.root))
  }
  if (method === 'POST' && path === 'InsuranceRules/Fields/Tree/Click') {
    state.clicks?.push(body)
    if (body?.node === 'existing') {
      const e = state.existing
      return envelope(wireClick({ proposal: proposal(e.fhirPath, e.moment, e.level, e.type), existing: { key: e.key, label: e.label }, patient: false }))
    }
    return CLICKS[body?.node] ? envelope(wireClick(CLICKS[body.node])) : envelope(null)
  }
  return null
}
