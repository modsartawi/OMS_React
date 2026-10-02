# 374 — What read backs the palette's live delivery search (research)

For [What read backs the palette's live delivery search](../374-what-read-backs-the-palettes-live-delivery-search.md),
wayfinder map 358, on 2026-10-02.

**Sources.** Paths are relative to `C:\Work\DMSCO\BackOffice` unless they start with `oms-react/`.
Nothing was edited in either repo.

**Dev SIS.Api was not reachable** on `:5111`, as in [360](360-delivery-reads.RESEARCH.md), so this
note has **no observed latency and no captured plan**. Every cost below is read from the SQL, the
index scripts and the row counts recorded in BackOffice 1314. The plan shapes are what SQL Server
does with these statement forms. They are **not measured**, so §6 lists what a DBA must confirm.

---

## 1. The existing list read cannot serve it

`SdDocumentWeb/DeliveryDocumentList` delegates verbatim to the old door. It sits behind `ApiKey` and
`OmsListGrantEndpointFilter` (`Services/SIS.Api/Endpoints/Sd/SdDocumentWebEndpoints.cs:78, 114-118, 257-262`).

### Every filter is exact equality, so there is no prefix and no suffix

The WHERE clause is 11 catch-all predicates over the `Delivery` CTE
(`Sartawi.Retail.Data/Modules/Sd/Services/SdSqlStatements.cs:413-424`):

```sql
AND (@CustomerPhone IS NULL OR Delivery.CustomerPhone = @CustomerPhone )
AND (@OrderNo       IS NULL OR Delivery.OrderNo       = @OrderNo )
AND (@DocumentNo    IS NULL OR Delivery.DocumentNo    = @DocumentNo )
AND (@DeliveryNo    IS NULL OR Delivery.DeliveryNo    = @DeliveryNo )
```

- **No `LIKE` anywhere.** None of the three numbers can match by prefix, and the mobile cannot
  match by suffix. Serving 364's match rules would mean changing this shared query, which the
  Deliveries screen and WPF parity both depend on.
- **A customer-phone filter does exist.** It is `CustomerPhone`, exact. It compares
  `SdDocumentCustomer.CustomerPhone`, joined on `DeliveryHeader.DeliveryNo = SdDocumentCustomer.DocumentNo`,
  so it is **the delivery's own customer row**, not the order's (`SdSqlStatements.cs:388`).
  oms-react already sends it (`oms-react/src/features/oms/deliveries/filter.ts:79`).
- All parameters bind ANSI (`DbString IsAnsi = true`, `SdDocumentService_Inquiry.cs:509-523`), so
  there is no NVARCHAR-against-VARCHAR conversion scan. That trap is real elsewhere, per BackOffice
  030's header.

### What one keystroke would cost with `Limit=8`

The statement is `SELECT TOP (@Limit) … ORDER BY DeliveryNo DESC` over the CTE. The CTE has 7 INNER
and 7 LEFT joins, and its predicates take the `(@P IS NULL OR col = @P)` form **with no
`OPTION (RECOMPILE)`**. One cached plan serves every combination of filters, so the optimizer
cannot build a seek on any one column. The plan it can use walks `PK_DeliveryHeader` backwards,
which matches the ORDER BY, and stops when `TOP` fills.

- **DeliveryNo, DocumentNo or OrderNo set.** The date range is **dropped**
  (`SdDocumentService_Inquiry.cs:484-490`).
  - An exact number matches about 1 row, so `TOP 8` **never fills**.
  - The walk runs the whole of `DeliveryHeader`. It has roughly 6M rows, an estimate from 1314's
    20.9M `SdDocumentCustomer` rows minus 14.9M `SdDocumentHeader` rows. Not measured.
  - **That is a full table read per keystroke.** Today's Deliveries number search already pays it,
    but once per search, not once per keystroke.
- **Mobile only, no dates.** The date bound is not applied either, because dates apply only when
  both ends are set.
  - The walk seeks `SdDocumentCustomer` by PK for every delivery row, newest first, until 8 match.
  - A frequent customer stops early. A one-time customer, or a mistyped mobile, walks **all ~6M rows
    with ~6M PK seeks**.
- **Mobile plus dates.** `EntryTime` has no index, so the date range only filters the walk; it never
  narrows it.

**The cost lands on the shared DB.** SIS.Api's DB is `POS` on the prod OMS server (1314 §1),
the same one stores, DRS and the distribution engine write to. BackOffice 030 exists because
three such scans topped `dm_exec_query_stats`. A debounced live search fires on **every pause in
typing, for every operator**.

**Verdict: no.** The list read gives exact match only, and even exact match costs a scan on every
keystroke.

---

## 2. Which indexes exist for the four keys

| Key | Column | Index in repo scripts | Prefix seek? |
|---|---|---|---|
| Delivery no | `DeliveryHeader.DeliveryNo` (VARCHAR, e.g. `8005796291`) | `PK_DeliveryHeader` | ✅ `LIKE @q + '%'` is a range seek, and walking it backwards gives newest-first for free |
| Document no | `DeliveryHeader.RefDocumentNo` | `IX_DeliveryHeader_RefDocument_Consignment (RefDocumentNo, ReferenceDeliveryNo) INCLUDE (OrderNo, EntryTime)`, from 028, **hand-run, prod application unconfirmed** | ✅ if applied. Order by `RefDocumentNo DESC` to stay inside the index; `DeliveryNo DESC` over a short prefix needs a sort |
| Order no | `DeliveryHeader.OrderNo` | **none.** `SdDocumentHeader (OrderNo, DocumentType)` exists only as **filtered** uniques: CLCN in 022, ERX in 033 | ❌ needs a new index |
| Mobile | `SdDocumentCustomer.CustomerPhone` (20.9M rows, 2.12 GB) | **none.** `026_index_delivery_header_store_customer.sql` is `DeliveryHeader (StoreCode, CustomerId)`, not the phone, and was **shipped unapplied on purpose** | ❌ needs a new index; suffix needs more (§3) |

The production index set is **unknown**: the replica carries no NC indexes (1727 §7), and nobody has
dumped the publisher's `sys.indexes` for these two tables.

---

## 3. Mobile suffix is the expensive rule

- **`LIKE '%' + @q` is never sargable.** Each keystroke would scan 20.9M rows and 2.12 GB, whatever
  index exists.
- **Making a suffix seekable** takes a persisted computed column `REVERSE(CustomerPhone)` plus an
  index, queried as `LIKE REVERSE(@q) + '%'`. That is a **schema change** on a table every order
  and delivery source writes to: NHibernate, Dapper, and the POS and partner handlers. The column
  is unmapped, so the writers don't change. It is still a second index the size of the first.
- **Formats vary.** The estate holds `05XXXXXXXX`, `9665XXXXXXXX` and `+966…`.
  `MobileNumberValidator` normalises all of them only on the SMS path, never at rest
  (`Modules/Sms/Validation/MobileNumberValidator.cs:46-80`). An exact match therefore has to try
  each form of the typed number.
  - With an index, that is **3–4 seeks**: `CustomerPhone IN (@local, @intl, @plusIntl)`.
  - It catches the case suffix search was meant to save, a number typed in the other format,
    **without** a suffix scan.
- **Suffix is also a fishing rule.** The last 4 digits match about 1 in 10,000 of 20.9M rows, around
  2,000 strangers. Each hit opens a record with a name, address and phone. 364 excluded name
  matching as "the fuzziest PII match"; a 4-digit suffix is nearly as fuzzy.

**Recommendation: match the mobile exactly, across its formats, and drop the suffix.** That needs
one plain index and no schema change. It amends 364's "exact or by suffix", so it is the owner's
call: see [the follow-up grilling](../376-what-the-palettes-live-search-matches-and-shows.md).

---

## 4. The smallest BackOffice read that is cheap

**A new route, `GET SdDocumentWeb/DeliveryQuickFind?q=&limit=8`.** The name is BackOffice's to
choose.

### Gate

- Both filters chained: `ApiKey` + `OmsListGrantEndpointFilter` + `OmsDetailGrantEndpointFilter`.
- That is a third helper beside `GatedByList` and `GatedByDetail` (`SdDocumentWebEndpoints.cs:257-271`).
  Filters are additive, so it is two `AddEndpointFilter` lines.
- 364's rule, *list AND detail*, becomes server-enforced, not just client-hidden.
- **Scope is the estate.** Neither grant is store-scoped (`OmsListGrantEndpointFilter.cs`), and the
  list itself takes `StoreCode` as an optional filter. Search reaches what the list already reaches.

### Shape dispatch on the server

The server classifies the trimmed term and runs only the branches that fit. Each branch is **its own
static statement**, not catch-all, so each gets its own plan:

| Term shape | Branch | Statement core | Index |
|---|---|---|---|
| digits, ≥ 4 | delivery no prefix | `DeliveryHeader WHERE DeliveryNo LIKE @q + '%' ORDER BY DeliveryNo DESC` | PK (exists) |
| digits, ≥ 4 | document no prefix | `WHERE RefDocumentNo LIKE @q + '%' ORDER BY RefDocumentNo DESC` | 028 (confirm applied) |
| any, ≥ 4 | order no prefix | `WHERE OrderNo LIKE @q + '%' ORDER BY OrderNo DESC` | **new** `IX_DeliveryHeader_OrderNo (OrderNo)` |
| mobile-shaped (`05…`/`9665…`/`+966…`, full length) | mobile exact | `SdDocumentCustomer WHERE CustomerPhone IN (@local, @intl, @plusIntl)` ⋈ `DeliveryHeader` on PK | **new** `IX_SdDocumentCustomer_CustomerPhone (CustomerPhone)` |

- The branches are combined by `UNION ALL`, each `TOP (@limit)`. Then a final `TOP (@limit)` with
  dedupe on `DeliveryNo`: a term can hit a delivery and its document.
- Status lookups join **only for the ≤ 8 surviving rows**, the same trick as the list's
  `OUTER APPLY` for `FailedJobsCount` (`SdSqlStatements.cs:427-438`).
- **Cost per keystroke: 3–4 index seeks, each reading at most 8 rows**, plus 8 × (status + lookups)
  PK seeks. That is tens of logical reads, against a full table walk. The 4-character minimum stops
  `8`, `80` and `800` from reading 8 rows out of millions just to be discarded on the next
  keystroke.
- **Cancellation:** TanStack Query's `signal` flows through to `CancellationToken` (360 §2). Each
  keystroke cancels the request before it, so in-flight queries never pile up.

### Hit payload

Just what a palette row needs:

```
deliveryNo · documentNo · orderNo · storeCode · entryTime · matchedOn ('delivery'|'document'|'order'|'mobile')
readyStatus · clearStatus · deliveryStatus · closeStatus · lastAction · deliveryType
```

- **No `customerName`, no `customerPhone`, never `customerOtp`.** The operator typed the mobile, so
  echoing it adds nothing. Whether the row shows a **name** is a display call the prototype made and
  364 did not rule on, so it goes to the follow-up grilling. If it is wanted, `customerName` costs
  one column on a row the mobile branch has already joined.

### Indexes and their build cost

Both new indexes are plain, narrow and non-unique, built ONLINE on Enterprise with `MAXDOP = 1` and
hand-run by a DBA, as in 028 and 030:

- **`IX_DeliveryHeader_OrderNo (OrderNo)`**: about 6M rows.
- **`IX_SdDocumentCustomer_CustomerPhone (CustomerPhone)`**: 20.9M rows, the key plus the clustered
  `DocumentNo`. On the order of **0.5–0.8 GB** (estimated, not measured).
- **The write cost:** one extra index row per document or delivery insert, and per phone edit.

---

## 5. Should a hit carry status from the row? Yes

- **There is no detail read per hit.** 360 §2 priced `Delivery/{no}` at 10–12 trips plus N+1 and two
  pricing passes. Eight of those per keystroke is out of the question.
- **The status comes from the four axes plus `lastAction`.** The list grid shows those same axes as
  columns (`oms-react/src/features/oms/deliveries/columns.ts:170-173`). The hit's single status
  label should come from **369's pure derivation in `@/core`**, which the inspector already uses
  from row fields ([367](../367-what-the-inspector-shows-for-a-selected-delivery.md)). Then the
  palette, the inspector and the timeline can't disagree.
- **Picking a hit navigates** to `/oms/delivery/:deliveryNo`. Details pays its own read once, under
  its own gate, exactly as Jump to number does.

---

## 6. What must be confirmed before building

These are DBA checks, not decisions:

1. **Run on the publisher:** `sys.indexes` for `DeliveryHeader` and `SdDocumentCustomer`. Is 028
   applied? Does some unscripted phone or OrderNo index already exist? The repo is not the truth
   for prod.
2. **`SELECT COUNT(*)` from `DeliveryHeader`**, to replace the ~6M estimate.
3. **The phone formats at rest:** a `GROUP BY LEFT(CustomerPhone, 4)` histogram over recent delivery
   customer rows, to fix the `IN (…)` variant list.
4. **`RequestLogRecord.DurationMs`** for `DeliveryDocumentList` with a single number set (360 §2).
   It would show the scan this note predicts on today's screen. If it is slow, the Deliveries
   number search wants the same seek branches, which is a separate BackOffice ask.

---

## 7. What must be built, by whom, and its cost

| Who | What | Size |
|---|---|---|
| **BackOffice** | `DeliveryQuickFind` route + a three-filter gate helper; a service method with term classification and mobile-variant expansion; 4 static branch statements + `UNION ALL` + status join over survivors; source-contract tests in the `SdDocumentWebEndpointsSourceContractTests` style (both filters present, no catch-all, ANSI binding); a pure test of the classifier | **~1.5 dev-days** |
| **BackOffice / DBA** | Two index scripts (`DeliveryHeader.OrderNo`, `SdDocumentCustomer.CustomerPhone`), the 030 pattern: Enterprise-only ONLINE, guarded, hand-run on `POS`; confirm 028 applied; the before/after DMV capture | **~0.5 day + a DBA window** |
| **oms-react** | `quickFind` in an `@/core/oms` API (Delivery details and the list both open from it, and `layout/` composes the group); a 250 ms debounce with `signal` cancellation; the hit row with its status from 369's derivation; fail closed on both grants (364) | rides the keyboard-layer step |

**Until it ships**, the palette loses nothing it can't do without. **Jump to number**, ruled in 364,
opens an exact delivery or document number with **no read**. Live search can follow as the next
ticket, as Retry does in [370](../370-retry-job-drop-it-or-ask-backoffice.md).
