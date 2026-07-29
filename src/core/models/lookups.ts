/**
 * Lookup / reference models. Each carries a code field and a human-readable
 * `description`. The filter panel sends the DESCRIPTION, not the code — WPF
 * parity, open question R-3 (403 §8.1); see `buildDeliveryQuery`.
 */

/** A row of `GET SdDocument/DocumentTypes`. */
export interface SdDocumentTypeModel {
  documentType: string // code
  description: string
  documentCategory: string
}

/** A row of `GET SdDocument/DocumentSources`. */
export interface DocumentSourceModel {
  documentSource: string // code
  description: string
  documentSourceCategory: string
}

/** A row of `GET SdDocument/DeliveryDocumentTypes`. */
export interface DeliveryDocumentTypeModel {
  documentType: string // code
  description: string
}

/**
 * A row of `GET SdDocument/StoreDetails` — the open stores (`StoreArea` where
 * `ClosedStatus = 0`). Feeds both the store switcher and the Screen 2 Change
 * Store picker in pick-in-store mode.
 *
 * The city field is `city`, NOT `cityName` — this interface claimed `cityName`
 * until 407 and the switcher's `${code} · ${city}` label silently collapsed to
 * the bare code on every row (`undefined` is falsy, so the label just lost its
 * city). Verified against the live endpoint; the payload has no `cityName`.
 */
export interface StoreDetailModel {
  storeCode: string
  city: string
  region: string
  storeAddress: string
  /** `true` when the store also performs deliveries. */
  deliveryStore: boolean
  latitude: string
  longitude: string
  wasfatyRefill: boolean
}

/**
 * A row of `GET SdDocument/AddressLabels` — the address book's label catalogue
 * (`Home`, `Work`, …), read by the call-center address editor.
 *
 * 🚩 **Labels are server data, not an enum** (CC2 inventory §2.2). A new address
 * defaults to `HOME`, and display falls back `labelNameEn ?? labelCode` — the
 * same fallback `console/address-book.ts` already makes for the picker's rows,
 * kept deliberately so agents go on seeing the untranslated code they know.
 */
export interface SdAddressLabelModel {
  labelCode: string
  labelNameAr: string
  labelNameEn: string
}

/**
 * A row of `GET SdDocument/Districts` — the Screen 2 Change Store picker in
 * delivery mode.
 *
 * The fulfilling store is *derived* from the chosen district (`tempStoreCode`
 * when non-empty, else `storeCode`). Each row carries district and city names in
 * both Arabic and English so one search box can match either.
 */
export interface SdDistrictModel {
  districtCode: string
  cityCode: string
  cityNameAr: string
  cityNameEn: string
  magentoCityEn: string
  magentoCityAr: string
  districtNameAr: string
  districtNameEn: string
  /** The normal delivery store for the district. */
  storeCode: string
  /** The store for insurance-routed orders — deliberately NOT used (D-22). */
  insuranceStoreCode: string
  /** Operational failover override — wins over `storeCode` when non-empty. */
  tempStoreCode: string
  createdOn: string
  createdBy: string
  updatedOn: string
  updatedBy: string
  latitude: number
  longitude: number
}
