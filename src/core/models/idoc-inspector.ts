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
 *  LINE, `IDocInspectorLine.batchNumber`. Both words are on this one screen. */
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
  /** What the rate was applied TO — the amount the engine started from. Shown
   *  beside the rate because a rate alone cannot be checked: only base × rate
   *  against `conditionValue` says whether the arithmetic on this row holds. */
  conditionBaseValue: number
  conditionRate: number
  /** The rate's unit — `"%"` for a percentage, a currency for an absolute
   *  amount, `""` when the row carries none.
   *
   *  ⚠️ **A rate is unreadable without it.** `11.5` is eleven and a half percent
   *  or eleven riyals fifty, and the two differ by orders of magnitude on the
   *  same column. Rendered as text beside the number, never formatted as money —
   *  it is a unit, not an amount. */
  conditionRateUnit: string
  conditionValue: number
  conditionClass: string
  conditionControl: string
  /** Was this condition **added after the original invoice** — a partner
   *  commission and its like — rather than priced with the sale?
   *
   *  🔑 A fact about PROVENANCE, not a problem: a post condition is ordinary and
   *  expected. It is tinted, never flagged, and deliberately not drawn in the
   *  screen's attention ink, which on this screen means a defect. */
  isPostCondition: boolean
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
   *  with the **IDoc batch** on the document beside it, which is why the server
   *  spells this one `BatchNumber` and that one `Batch`. */
  batchNumber: string
  isReturn: boolean
  /** Was this line **added after the original invoice** rather than sold at the
   *  till? Same reading as `IDocInspectorCondition.isPostCondition`, one level up.
   *
   *  ⚠️ **Independent of its conditions.** An ordinary line can carry a post
   *  condition (a commission on a normal sale), and a post line's conditions are
   *  not all post by construction — so the two are tinted separately and neither
   *  is derived from the other. */
  isPostItem: boolean
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
 *
 * ⚠️ **Three of the four fields 297 modelled are still NOT on this payload**
 * (ticket 300 removed all four): `paymentGroupId`, `splitAmount` and `splitRatio`.
 * 297 was written while BackOffice 1388 was still open, from 1381's prototype
 * data rather than from a contract; the shipped `IDocInspectorDocument` carried
 * none of them — so they were about to render `undefined` and a `0%` split on
 * every card. They come back the day the server ships them and not before.
 *
 * 🚩 `billingType` is the one that came back: the DTO and the projection now
 * carry it, so it is modelled and rendered again — under the same rule that
 * removed it, not against it.
 *
 * 🚩 `isHeld` landed with ticket 298, which is the slice that draws the held
 * marker — this file's rule that a field arrives when something first RENDERS it,
 * kept.
 */
export interface IDocInspectorDocument {
  /**
   * `AGG` · `SAPR` · `FI` — raw, and rendered raw, with the legend's label beside
   * it and never instead of it (ticket 300).
   *
   * ⚠️ **`iDocType`, not `idocType`, and the difference is the whole field.** The
   * C# property is `IDocType`; SIS.Api sets no naming policy, so minimal APIs use
   * `JsonSerializerDefaults.Web`, whose camelCase pass stops at the first
   * uppercase run followed by a lowercase letter — `IDocType` → `iDocType`. It is
   * the ONLY two-leading-caps property in this whole graph, so it is the only one
   * that drifts, and it is the key 299 groups its download buttons by. (The same
   * policy is what gives this repo `zReportIds` for C# `ZReportIds`.)
   */
  iDocType: string
  receiptNumber: string
  pharmacyId: string
  /**
   * The billing type this document was generated under — raw, with the legend's
   * label beside it, exactly like `iDocType`.
   *
   * 🚩 **The tenth vocabulary to get a render site, and the reason the derived
   * codes are readable.** `ConditionTypeCodeMapping` is overridable PER BILLING
   * TYPE, so an empty `discTypeCode` on a condition below means "no mapping under
   * *this* billing type" — a sentence that cannot be completed while the billing
   * type is off screen. That is why it belongs on the document strip and not in a
   * details drawer.
   */
  billingType: string
  exportState: IDocExportState
  /**
   * Was this document generated and then **held back from batching** (ticket 298,
   * BackOffice 1391)?
   *
   * 🔑 **The answer to "*which* one".** 1390 shipped `ProcessedWithHeldDocuments`
   * as a verdict only and asserted the consequence out loud in its own tests: a
   * two-document transaction was told one of them is held and not which, because a
   * held document wears the same `not-batched` badge as an ordinary unbatched one.
   * *Which* is a question about the graph, so it is answered on the document.
   *
   * ⚠️ The generator's `ErrorType` and `ErrorMessage` are deliberately **not** on
   * the wire — those are its diagnostics in its own words, and this screen's
   * contract is machine codes it words itself. So the banner names the finding,
   * this flag names the document, and nothing here says *why*.
   */
  isHeld: boolean
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

/* ---------------------------------------------------------------------------
 * The code legend (ticket 300) — `GET IDocInspector/Metadata`.
 * ------------------------------------------------------------------------- */

/**
 * One value in one closed vocabulary.
 *
 * `code` is the value **as persisted** — what the column actually holds, and what
 * a consultant pastes into a SAP ticket. `name` is the declaring C# constant's
 * own identifier, *reflected* server-side rather than authored.
 *
 * 🔑 **`name` is the label, and this repo ships no alternative to it.** BackOffice
 * 1392 put no prose on this DTO on purpose and reflects the identifier instead, so
 * that a constant added today is readable today without either repository being
 * edited. A per-code wording map in this bundle would be the bundled legend 300
 * forbids, one file further down: wrong the first time a constant changes.
 */
export interface IDocInspectorCodeValue {
  code: string
  name: string
}

/**
 * The **nine closed vocabularies**, each generated from its own C# constants
 * class and every one of them changing only by deployment.
 *
 * ⚠️ **Nine, and the count is the contract.** A tenth would mean either an open
 * vocabulary smuggled in — condition types, which are open master data and are
 * resolved per condition row on the transaction payload — or a derived one:
 * `discTypeCode`, `itemTypeCode` and `transTypeCode` come from a
 * per-billing-type-configurable map, so a legend of them could disagree with the
 * persisted row, and a stored-versus-map disagreement is a finding, not a label.
 *
 * 🚩 Three of the nine have **no render site on this screen today**:
 * `paymentGroup` because the transaction payload still carries no such field,
 * `errorType` and `workflowType` because 298's banner and verdict strip read
 * them without labelling them. They are modelled anyway — the shape is the
 * server's, not this repo's to trim.
 *
 * `billingType` was a fourth until the document payload grew the field it
 * labels; it is now read by the document attribute strip.
 */
export interface IDocInspectorLegend {
  /** Which pipeline layer minted a row. Carries `""` — a pre-provenance row. */
  sourceTag: IDocInspectorCodeValue[]
  /** How the pricing engine came by a condition. Carries `""` — no origin set. */
  conditionSource: IDocInspectorCodeValue[]
  conditionClass: IDocInspectorCodeValue[]
  conditionControl: IDocInspectorCodeValue[]
  /** ⚠️ `iDocType`, for the same camelCase reason as
   *  `IDocInspectorDocument.iDocType` — the C# property is `IDocType`. */
  iDocType: IDocInspectorCodeValue[]
  billingType: IDocInspectorCodeValue[]
  workflowType: IDocInspectorCodeValue[]
  paymentGroup: IDocInspectorCodeValue[]
  /** Why a document was held back from batching. Carries `""` — **no error**. */
  errorType: IDocInspectorCodeValue[]
}

/**
 * `GET IDocInspector/Metadata` — the legend, and the workflow types this
 * deployment has a handler registered for (spec 1386, BackOffice 1392).
 *
 * 🔑 **Fetched from the API precisely so it is NOT in this bundle.** oms-react is
 * a second repository on its own release cadence; a legend compiled in here drifts
 * from the pipeline the first time a constant changes. One route keeps the labels
 * and the pipeline on one deployment — which is why this client never hardcodes a
 * member of any of the nine, not even as a fallback.
 *
 * ⚠️ **`registeredWorkflowTypes` is legend ONLY.** The server already decided the
 * verdict (BackOffice 1390), so the screen never derives a state from this set —
 * two consultants reading one transaction can then never disagree because their
 * browsers computed it differently.
 */
export interface IDocInspectorMetadata {
  legend: IDocInspectorLegend
  registeredWorkflowTypes: string[]
}
