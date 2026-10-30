// Types for `fhir-rules-stubs-701.mjs`, so a vitest proof reads the SAME rows the drive serves.
import type { FhirCatalogRow } from '../src/core/insurance-rules/fhir-catalog'
import type { FulfillArg } from './insurance-rules-stubs.mjs'

export declare const COMMUNICATION_ROWS: FhirCatalogRow[]
export declare const PAYMENT_ROWS: FhirCatalogRow[]
export declare const SCOPES_CATALOG: FhirCatalogRow[]
export declare function monitorScopesStub(method: string, path: string, store: { draft: { rules: { kind?: string }[] } }): FulfillArg | null
