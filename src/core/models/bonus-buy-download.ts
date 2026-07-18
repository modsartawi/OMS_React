// Wire shapes for the BonusBuyDownloadWeb/* endpoints (BackOffice map 489 / spec 504;
// server slice tickets 514/515). Field casing is the camelCase ASP.NET Core emits.
// The screen is gated by its OWN grant (BackOfficeScreen[BbyDownload,03]) — the
// server enforces it on every Download/Delete; Access only shapes the nav.

/**
 * The shared attribute-override block (contract 492), snapshotted ONCE per batch and
 * sent verbatim with every BBY in the loop. Fields 1–9 are ALWAYS applied — a blank
 * string / 0 / false OVERWRITES the header value (faithful to the legacy WPF). The two
 * times are the ONLY optionals: `null` = keep the HANA value. `priceListType` is NOT a
 * field here — the seam derives it.
 */
export interface BbyOverrides {
  includes: string
  excludes: string
  originFilter: string
  stackingExcludes: string
  loyGroups: string
  loyTiers: string
  isStackable: boolean
  maxValue: number
  score: number
  /** `"HH:mm"` or null (= keep the HANA value). */
  validFromTime: string | null
  /** `"HH:mm"` or null (= keep the HANA value). */
  validToTime: string | null
}

/** Per-number download outcome (design 493). */
export type BbyDownloadStatus = 'succeeded' | 'notFoundInHana' | 'failed'

export interface BbyDownloadResult {
  bbyNumber: string
  status: BbyDownloadStatus
  /** True when a successful download replaced an existing BBY. */
  overwritten: boolean
  /** Populated on `failed`; null/absent otherwise. */
  message?: string | null
}

/** Per-number delete outcome (design 493). */
export type BbyDeleteStatus = 'deleted' | 'notFound' | 'failed'

export interface BbyDeleteResult {
  bbyNumber: string
  status: BbyDeleteStatus
  /** Populated on `failed`; null/absent otherwise. */
  message?: string | null
}

/** GET BonusBuyDownloadWeb/Access — the screen-open grant probe (nav show/hide only). */
export interface BbyDownloadAccessResult {
  screenAllowed: boolean
}
