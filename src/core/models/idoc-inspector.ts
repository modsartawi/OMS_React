/**
 * IDoc Inspector wire models (spec 1386).
 *
 * The vocabulary of `IDocInspector/*`, and — exactly as for the retail-invoice
 * rail beside it — **not this repo's to invent**: the shapes are the BackOffice
 * spec's, and a field renamed or a type softened for local convenience produces
 * a screen that fails silently the day it meets the real endpoint.
 *
 * `api-envelope` puts wire types in `core/models/` rather than in the feature.
 *
 * 🚩 **A field lands here when something first RENDERS it**, not when the column
 * exists — 296's rule, kept. So the document's held-document fields
 * (`hasError`/`errorType`/`errorMessage`) are absent until 298 draws the banner
 * that reads them, and the currency columns are absent until something prints a
 * currency. Extra fields on the wire are ignored; a field in this file that
 * nothing renders is a claim about the screen that is not true.
 */

/**
 * `GET IDocInspector/Access` — the nav-visibility probe (spec 1386 §"The read
 * surface", BackOffice ticket 1387).
 *
 * **One boolean, and that is the whole shape.** One grant covers the whole
 * screen; there is no per-route split to model.
 *
 * 🚩 **Cookie-only and deliberately NOT grant-gated**, so a denial arrives as
 * `200 { screenAllowed: false }` — a boolean to read, never an error to catch.
 * Gating the probe on the grant would leave a denied session unable to *learn*
 * it is denied: the call would fail, this client's fail-closed handling would
 * read a shut door as an outage, and the user would be told to try again in a
 * moment, forever.
 *
 * ⚠️ **The probe only hides the menu.** `Transaction`, `Download` and `Metadata`
 * re-evaluate the grant server-side through their own filter, fail-closed. That
 * filter is the boundary; this answer is nav hygiene. Neither substitutes for
 * the other.
 */
export interface IDocInspectorAccessResult {
  screenAllowed: boolean
}

/* ---------------------------------------------------------------------------
 * The transaction graph (ticket 297) — `GET IDocInspector/Transaction`.
 * ------------------------------------------------------------------------- */

/**
 * Where one document stands on its way to SAP — a **three-way** value, never a
 * boolean pair, because the middle state is the one a consultant most needs and
 * the one a boolean loses: *sealed into a batch, but that batch has not been
 * exported yet*.
 *
 * 🚩 `not-batched` is not an edge case. Production holds 1,859 documents (3.1%)
 * in no batch at all, every one of them unreachable through either of the rail's
 * existing batch-keyed loaders — which is why the inspector has its own.
 */
export type IDocExportState = 'exported' | 'batched-not-exported' | 'not-batched'

/** The **IDoc batch** a document was sealed into — `null` while it is in none.
 *  ⚠️ Not a batch (CHARG): that is a physical lot of a material and lives on a
 *  LINE, `IDocInspectorLine.batch`. Both words are on this one screen. */
export interface IDocInspectorBatch {
  id: string
  /** When the batch left for SAP; `null` while it is sealed but unexported. */
  exportedAt: string | null
}

/** One `AttributeName` / `AttributeValue` pair off a line — batch, partner,
 *  employee. An ordered list of 1–3 entries, drawn as pills inside the open
 *  line rather than as a table four times its own content. */
export interface IDocInspectorItemDetail {
  seq: number
  attributeName: string
  attributeValue: string
}

/** One pricing condition attached to a line. */
export interface IDocInspectorCondition {
  seq: number
  conditionType: string
  /**
   * Resolved **server-side, per row**, from the estate's condition-type table.
   *
   * 🔑 Condition types are **open master data** — a pricing analyst adds one
   * without a deployment — so they are the one code on this screen that does NOT
   * come from the `Metadata` legend (ticket 300 takes the other nine). `null`
   * when no description exists: the code renders alone and is **never invented**.
   */
  conditionTypeDescription: string | null
  conditionRate: number
  conditionValue: number
  conditionClass: string
  conditionControl: string
  /** ⚠️ `"3302"` blanks the amount in the exported XML while the stored row keeps
   *  it — marked on screen rather than hidden, so the table cannot silently
   *  disagree with the file. */
  discTypeCode: string
  /** ⚠️ **Verbatim, including `""`.** See `IDocInspectorLine.sourceTag`. */
  sourceTag: string
  /** The condition's own origin (`M` minted by hand, `A` automatic, `H`
   *  distributed header copy, `B` base price). Rides as a small marked letter
   *  BESIDE the tag and never as a column of its own — outside `sourceTag=pos`
   *  it is a near-constant `M`, so a column would be a wall of one letter. */
  conditionSource: string
}

/** One line item of a document, with everything that hangs off it. */
export interface IDocInspectorLine {
  itemNumber: number
  itemTypeCode: string
  materialNumber: string
  quantity: number
  salesUom: string
  salesAmount: number
  promotionId: string
  /** ⚠️ A **batch (CHARG)** — the physical lot of this material. Nothing to do
   *  with the **IDoc batch** on the document beside it. */
  batch: string
  isReturn: boolean
  /**
   * Who minted this line.
   *
   * ⚠️ **Sent verbatim, including `""`, and `""` is NOT `pos`.** The ledger's
   * source-provenance convention defaults an untagged row to POS; the API must
   * not apply that default here, and this screen renders `""` as a dimmed
   * *unknown*. Substituting either side would make a provenance bug
   * indistinguishable from a genuine POS line — the single thing this column
   * exists to prevent.
   */
  sourceTag: string
  conditions: IDocInspectorCondition[]
  itemDetails: IDocInspectorItemDetail[]
}

/**
 * One payment method on a document.
 *
 * 🔑 **No provenance field at all — absent, not null.** These rows never carried
 * a source tag, and a nullable field would invite a dimmed *unknown* chip where
 * the honest answer is "this row never had one". The screen says so in the
 * pane's heading instead of drawing an empty column.
 */
export interface IDocInspectorPayment {
  seq: number
  conditionType: string
  typeCode: string
  cardType: string
  authorizationNo: string
  amount: number
}

/** One FI line. 🔑 **No provenance field at all** — same ruling as the payments
 *  beside it, and stated the same way in the pane's heading. */
export interface IDocInspectorFiItem {
  fiTypeNumber: string
  glAccount: string
  profitCenter: string
  fiTypeCode: string
  assignment: string
  amount: number
}

/**
 * One generated IDoc document — the **only bridge** between the transaction key
 * space (`storeCode`, `trxNumber`) and the document key space (`pharmacyId`,
 * `receiptNumber`). The payload is nested precisely so this client never learns
 * there are two key spaces to join.
 */
export interface IDocInspectorDocument {
  /** `AGG` · `SAPR` · `FI` — raw, and rendered raw (ticket 300 adds the label
   *  beside it, never instead of it). */
  idocType: string
  receiptNumber: string
  pharmacyId: string
  billingType: string
  paymentGroupId: string
  splitAmount: number
  /** ⚠️ A **fraction**, not a percentage: the engine's billing split writes
   *  `1.000000000000` for a whole document. The screen scales it. */
  splitRatio: number
  exportState: IDocExportState
  batch: IDocInspectorBatch | null
  lines: IDocInspectorLine[]
  payments: IDocInspectorPayment[]
  /** ⚠️ Populated only for `FI` documents, and the FI pane renders even when
   *  this is empty — an empty FI section on an FI document is a FINDING (the
   *  loader trap BackOffice 1389 exists for), not a section to hide. */
  fiItems: IDocInspectorFiItem[]
}

/** A finding about an otherwise-renderable transaction, carrying a machine code
 *  and never a sentence. ⚠️ **Ticket 298 renders this** — 297 carries it on the
 *  type so the payload's shape is one file. */
export interface IDocInspectorAttention {
  code: string
  /** The transaction's own export-version column, when that is what disagrees. */
  exportVersion: string | null
}

/**
 * `GET IDocInspector/Transaction?storeCode=…&trxNumber=…` — the verdict, an
 * optional attention block, and the whole nested graph, in **one call**.
 *
 * 🔑 **Nothing here is paged, at any level.** Production measurement (map 1385)
 * settles it: average 24 rows per transaction, 99th percentile 69, maximum 515,
 * at most five documents and 210 conditions. Selecting a document or opening a
 * line therefore never touches the network.
 *
 * 🚩 **Every "nothing to show" is a 200 carrying a `verdict`** — never a 404,
 * never a 400, never an empty 200. Ticket 298 owns the ten codes and their
 * wording; 297 renders the graph when there is one.
 */
export interface IDocInspectorTransaction {
  /** A stable machine code, never a sentence — the client owns the wording. */
  verdict: string
  attention: IDocInspectorAttention | null
  documents: IDocInspectorDocument[]
}
