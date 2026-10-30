// Stubs for oms 697 (BackOffice spec 3271, door 3283), on the real envelope. 🚩 Paths and shapes guessed; 711 reconciles.
//   GET  InsuranceRules/Fields/Tree?ref=           → { ref, root }  (node: nodeRef, name, index, choice, fhirType, value, pickable, children)
//   POST InsuranceRules/Fields/Tree/Click { ref, nodeRef } → { proposal, existing, patient }
// The path is the stub's, as it will be the door's: the client never builds one. Every value is synthetic.
import { envelope } from './insurance-rules-stubs.mjs'

export const BUNDLE_REF = 'KB-SYN-1'
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

/** The doors, or null to fall through. `state.existing` is the catalog row door 3283 points at; `state.clicks` collects the bodies. */
export function bundleTreeStub(method, path, body, state = {}) {
  if (method === 'GET' && path === 'InsuranceRules/Fields/Tree') {
    if (state.treeRefs) state.treeRefs.push(state.query?.get('ref') ?? null)
    if (state.query?.get('ref') !== BUNDLE_REF) return envelope(null, { status: 404, success: false, message: 'No kept bundle has this reference.', errorCode: 'INSFIELDS_BUNDLE_NOT_FOUND' })
    return envelope(TREE)
  }
  if (method === 'POST' && path === 'InsuranceRules/Fields/Tree/Click') {
    state.clicks?.push(body)
    if (body?.nodeRef === 'existing') {
      const e = state.existing
      return envelope({ proposal: proposal(e.fhirPath, e.moment, e.level, e.type), existing: { key: e.key, moment: e.moment, level: e.level, label: e.label }, patient: false })
    }
    return envelope(CLICKS[body?.nodeRef] ?? null)
  }
  return null
}
