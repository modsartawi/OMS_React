// oms 699 (BackOffice spec 3271, doors 3290 / 3292): monitors on the guard list. 🚩 STUBBED: the catalog's reissue row and a
// monitor's `kind` / `severity` on the list row are guesses, listed on ticket 699 for 711 to reconcile.
import { GUARD_ROWS, envelope, guardRow } from './insurance-rules-stubs.mjs'
import { FHIR_CATALOG } from './fhir-rules-stubs-692.mjs'

export const REISSUE_REASON_ROW = {
  key: 'reissue.reason',
  label: { en: 'Reissue reason', ar: 'سبب إعادة الإصدار' },
  moment: 'claimResponse',
  level: 'message',
  type: 'code',
  unit: null,
  fhirPath: "extension('http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-reissue').extension('reason').value.ofType(CodeableConcept)",
  cardinality: 'single',
  system: 'http://nphies.sa/terminology/CodeSystem/reissue-reason',
  channels: [{ channel: 'nphies', answer: 'answers' }],
  parameter: null,
  choice: null,
  legacy: null,
  retired: false,
}

/** A monitor's row as `GET InsuranceRules/Guards` is guessed to give it. */
const monitorRow = (r) => ({ ...guardRow({ ...r, then: [] }), kind: 'monitor', severity: r.then?.[0]?.severity ?? 'info' })

/** The catalog with the reissue row, and the list with the draft's monitors after the guards. Null to fall through. */
export function monitorStub(method, path, store) {
  if (method !== 'GET') return null
  if (path === 'InsuranceRules/Fields/Catalog') return envelope([...FHIR_CATALOG, REISSUE_REASON_ROW])
  if (path === 'InsuranceRules/Guards') return envelope([...GUARD_ROWS, ...store.draft.rules.filter((r) => r.kind === 'monitor').map(monitorRow)])
  return null
}
