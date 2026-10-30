// Types for `fhir-rules-stubs-692.mjs`, so a vitest proof reads the SAME rows the drive serves.
import type { FhirCatalogRow } from '../src/core/insurance-rules/fhir-catalog'
import type { FulfillArg } from './insurance-rules-stubs.mjs'

export declare const FHIR_CATALOG: FhirCatalogRow[]
export declare function fhirCatalogStub(method: string, path: string, opts?: { rows?: FhirCatalogRow[]; deny?: string[]; reads?: Record<string, number> }): FulfillArg | null
