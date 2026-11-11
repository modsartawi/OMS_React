# Analytics adds items, stock, sales channels and customers, from 1 January 2026

Status: accepted (owner, with the CTO, 2026-11-05). This extends [ADR 0006](0006-analytics-is-native-screens-over-cube-and-dbt-marts.md):
the same one image, the same `POS_Analytics`, and Cube as the only engine. The screens and SIS.Api read the catalogue
from Cube's `/meta`, so new views appear in oms-react with no web or SIS.Api change.

## Versions

| Image | What it adds | State |
|---|---|---|
| `oms-analytics` 1.0.0 | Store-level marts: till sales, orders by channel, delivery speed | In production 2026-11-05 |
| 1.1.0 | Item sales by the merchandising hierarchy; slow movers judged on sales (BackOffice 3387) | Built and tested, not deployed; superseded by 1.2.0 |
| **1.2.0** | Item history from 2026-01-01; stock on hand from StockManager; sales channel and sale type; returns by the sale's channel; customers, new and regular; the first load on the status card; the freshness fix | **This record.** Built and tested 2026-11-05 (BackOffice 3388), not deployed |

## Questions HQ and the CTO want answered

1. Which categories, brands and items sell best this week, and which worst.
2. The slow-moving items: what sits in stock but does not sell. The same by category and by brand ("weak brands").
3. Sales from `RetailTrx` (receipts) and `RetailTrxDetail` (item lines).
4. **Returns:** how much we return, whether it rises or falls through the year, and which pharmacy returns the most.
5. **Channel:** offline (in store), online and by which source (Android, iOS, web, …), insurance, and Nupco / Wasfaty.
6. **Customers:** how many customers visited, how many new customers in 2026, and new against regular customers by
   channel.

## Source facts

These come from the owner, the code, and the owner's data dictionary `POS_OMS_Data_SCHEMA.xlsx`. The dictionary covers
44 tables of the POS database and was catalogued on 30 Sep 2026. `Store`, `Item` and `ItemInfo` are outside it.

### Till receipts: `POS.dbo.RetailTrx` (458.7M rows), and their lines: `RetailTrxDetail` (991.9M rows)

- **Retention:** data from 2021 to date, kept 5 years, with a nonclustered columnstore index on each table. No foreign
  key is enforced; the joins are logical. `Client` is `'000'` on every current row.
- **`TrxType`:** 100 is a sale and 110 is a return. 700 is a cash clearance (a financial record) and never counts.
  A return is its own row, pointing at the original sale through `ReturnFromTrxNumber`. The original is only updated,
  to set `IsReturned` / `IsPartiallyReturned`.
- **Counted receipts:** only those with `TrxStatus = 1` (closed). Every 2026 row is 1.
- **Signs:**
  - `Amount`, `Quantity`, `ExtendedPrice` and `TotalDiscount` are positive on a return.
  - The `…Value` twins are signed, negative on returns.
  - Measures take returns off and never add them.
- **Item lines:** `RetailTrxDetail` with `LineType = 0`. The other line types are 1 bonus-buy, 2 coupon, 3 voucher and
  4 donation. The header decides status, type, currency and channel for all its lines.
  - `RetailTrxDetail.SalesCategory1` is the item's sales category, copied at sale time.
- **Dates:**
  - `TrxDate` is the business **date only** (time 00:00:00). A few rows carry impossible years (2000, 2014, 2028,
    2029).
  - The time of day is `TrxTime`, stored on 1900-01-01.
  - `TimeWhenTrxClosed` is the full completion time.
  - A sale's **event time** is therefore `TrxDate` + `TrxTime`. Freshness and "data as of" must use it, never
    `TrxDate`, which looks a whole day old by evening.
  - Store sales can reach head office days after `TrxDate`.
  - `Year` is 0 on about 82M rows: derive the year from `TrxDate`.
- **SAR:** value × `ExchangeRate` when that rate is above 0, else × 1. Bahrain's BHD rows carry a rate of 10.
- **Country** is BHR when `DocumentCurrency` is BHD, else KSA.

### Channel and sale type on the receipt

- **`RefDocumentSource`:** the channel the order came from, e.g. IOS, ROID, WEB, HNGR, INSP.
  - **Empty means in store (offline).**
  - The codes are the OMS document sources (`SdDocumentSource`, 38 rows) and group by the `channel_map` seed the
    orders mart already uses, so "online" means the same thing in both.
  - The owner called this `RefTrxSource`.
- **`RefDocumentType`:** the order document's type (CMRC, SSML, CLCN, WSRF).
- **`DocumentType`:** the sales document type. Its codes:

  | Code | Type | Code | Type |
  |---|---|---|---|
  | 0 | Cash | 19 | AlRajhi Mokafaa |
  | 1 | Employee | 20 | Cura |
  | 2 | Gift | 21 | Mobily Neqaty |
  | 3 | Credit | 22 | Bahrain Talabat |
  | 4 | Insurance | 23 | Lab test |
  | 5 | STC | 24 | HungerStation |
  | 7 | STC charge | 25 | Bonded zone |
  | 8 | E-commerce | 26 | Altibbi |
  | 15 | Call centre | 27 | Akthr |
  | 16 | Gift card | 28 | Wasfaty |

  The owner's rule maps onto it: **4 is insurance**, and **3 (credit) for a specific customer is mainly Nupco /
  Wasfaty**.
- **`SubDocumentType`:** names the programme itself: NUPCO, YUSUR (Wasfaty), NPHIES or SABIC; empty on ordinary sales.
- **`CustomerID`:** the account customer (corporate, insurer or credit). It is empty on walk-in cash sales.
- **`CustomerType`:** e.g. SABIC, ELITE, ARAMCO, Card, Cash.

### Customers: `LoyMember` (14.7M rows)

- **The link:** `RetailTrx.LoyaltyCustomerID` → `LoyMember.LoyId`. It is filled on about 80% of sales.
- **`CreatedAt`:** when the member joined.
- **`CreatedByBranchId`:** the store that signed them up.
- **`MemberType`:** M membership, A archived (about 2.6M), F family, N non-loyalty customer.
- **Placeholder member numbers don't count** as a customer: 3795407, 2812732, 3378 and 1000000004 (the
  `loyalty_placeholder_ids` seed).
- **The table is full of personal data:** name, mobile, national ID, e-mail, birth date. Analytics reads only `LoyId`
  (stored only as a one-way hash), `CreatedAt`, `CreatedByBranchId` and `MemberType`. Nothing else is ever selected.

### Stock: `StockManager.dbo.StockAccumulated`

- **Server:** 172.23.27.147, database `StockManager`, a **different server** from the replica.
- **Login:** `svc_analytics_dbt`, with its **own password**, different from the `POS_Analytics` one. It lives in
  `.passwords/` only, never in a tracked file.
- **The query:** `SELECT MaterialNumber, Plant, UnrestrictedPos, UpdatedAt FROM StockAccumulated WHERE
  StorageLocation = '0001'`.
  - The owner's note filtered on `UnrestrictedPos = '0001'`. SIS.Stock's own inquiry filters `StorageLocation`, and
    `UnrestrictedPos` is the quantity.
- **What each column is:**
  - `Plant` is the store;
  - `MaterialNumber` is the item;
  - `UnrestrictedPos` is stock on hand (SAP's unrestricted stock corrected by POS sales).
- **ATP** = `UnrestrictedPos` − the open OMS order quantity of the last 11 days, as SIS.Stock serves it. Analytics uses
  stock on hand. ATP is a promise made to a customer, not a measure of a slow item.
- **Not via the API:** SIS.Stock's API takes explicit lists of items and plants, so a whole-estate snapshot would be
  thousands of calls against a live service. The database read is one bounded query a night.

### Items

- **The item master is `Item`.** The hierarchy and attributes come from **`ItemInfo`**, keyed by item number:
  - A category (e.g. `A006 MEDICINE`);
  - B class;
  - C class;
  - D therapeutic class;
  - E ingredient class;
  - brand, vendor, manufacturer, ABC class and `UnitCost`.
- **`CategoryManager` is never published.** It's a person's name.

## Decisions

1. **History starts on 1 January 2026** for every item, stock-linked and customer mart (the owner's ruling with the
   CTO, replacing 1.1.0's 190 days).
   - It is a fixed date, not a rolling window: the history grows by a day each day.
   - The store-level marts keep their 400 days.
   - Sizing, by 2026-12-31:
     - item lines about 1M rows a day, so about 365M rows, roughly 4–8 GB columnstore;
     - the customer mart is smaller.
   - The first build reads 2026 one month at a time (below), so the replica never sees one 300-day statement.
2. **Stock comes in as a nightly snapshot, copied by the image itself.**
   - dbt cannot read across two servers, so a small step in the nightly job copies `StockAccumulated`:
     - storage location 0001;
     - non-zero `UnrestrictedPos`;
     - into `POS_Analytics.dbo.stock_snapshot`, in one transaction (the old snapshot stands if the copy fails).
   - It needs from infra and the DBA:
     - the network path from the container to 172.23.27.147:1433;
     - the login;
     - one new env var on the platform, `STOCK_DB_PASSWORD`.
   - Without them, 1.2.0 still runs, and the stock measures say "not available".
   - **Only the latest snapshot is kept** (one table, swapped each night). A stock history (stock by day) is not
     built: at ~6M store × item rows a night it would be the largest table here, and no question asks for it yet.
3. **Slow movers are judged on stock and sales together.**
   - An item counts in a store if it **has stock** or **sold there since 1 January 2026**.
   - Measures:
     - stock units;
     - stock value at `UnitCost`;
     - **dead stock**, meaning stock with no sale in 90 days, in units and value;
     - **days of cover** = stock ÷ the average daily units of the last 90 days;
     - stores idle 30 and 90 days, and their shares;
     - units per store.
   - Every measure can be broken down by category, the B–E classes, brand, vendor, manufacturer and store. That
     answers "weak category" and "weak brand" as well as "weak item".
4. **Top and worst** brands, categories and items are a sort in the view: by item sales value or units, descending for
   the top and ascending for the worst. Slow brands sort by dead-stock value or idle share. No separate mart.
5. **Every sales mart carries three channel dimensions,** taken from the header:
   - **`channel`:**
     - `offline` when the source is empty;
     - otherwise the `channel_map` group: own app and web, HungerStation, insurance platform, call centre, other.
   - **`source`:** the `RefDocumentSource` code itself, labelled from `SdDocumentSource` (Android, iOS, web, …).
   - **`document_type`:** the `DocumentType` code, labelled from a seed of the table above.
   - **`sale_type`**, a short grouping in a seed, decided in this order:
     - `nupco_wasfaty` where `SubDocumentType` is NUPCO or YUSUR, or `DocumentType` is 28;
     - `insurance` where `DocumentType` is 4, or the programme is NPHIES;
     - `credit` for any other `DocumentType` 3 (corporate accounts such as SABIC);
     - `online` for e-commerce, call centre and the aggregators (8, 15, 22, 24, 26);
     - `retail` otherwise (cash and the payment programmes).

     The probe lists the customers behind type 3 so the owner can check the rule.

     *(Amended 2026-11-06, owner: the sale type is decided by the account customer instead. Nupco /
     Wasfaty is `CustomerID` 0001100135, 0001100340 or 0001100341. Insurance is
     `Customer.IsInsurance = 1`, joined on `Client` + `CustomerID`. Any other customer is
     `other_account`, and no customer is `retail`. The join is a left join, and `online` is no longer
     a sale type, because the channel says that. It ships as a 1.2.x fix before production; see
     oms-react spec 819 §B.)*
   - **`programme`:** `SubDocumentType` as it is (NUPCO, YUSUR, NPHIES, SABIC, or none).
6. **Returns by channel and by item hierarchy,** in the item mart and the till mart:
   - **Measures:** units returned, return value, and the **return rate** = return value ÷ sales value (also a unit
     rate). Each rate is a ratio of sums, never an average of store or day rates.
   - **Return lines** are `RetailTrxDetail` item lines of a `TrxType` 110 receipt: `Quantity` and `Amount`, positive.
   - **The channel of a return is the channel of the original sale.** A return receipt carries
     `ReturnFromTrxNumber`, and the mart takes that sale's `RefDocumentSource`, `RefDocumentType`, `DocumentType`
     and `SubDocumentType`. An online order returned at the counter therefore counts as an online return, not an
     in-store one. The return receipt's own channel is kept as `return_channel` (where it was refunded).
     - When the original sale is not found (outside the history, or no number), the return takes its own header's
       channel and `return_origin` = `unmatched`. The probe measures how many.
   - **Order type** (`RefDocumentType`): `CMRC` e-commerce, `CLCN` call centre, `HNGR` HungerStation, `WSRF`
     Wasfaty refill, `NPHS` Nphies, `SSML` social-security milk, empty in store. Labelled from a seed.
     `RefDocumentSource` (IOS, ROID, WEB, HNGR, INSP, call-centre codes) is labelled from `SdDocumentSource`.
   - **The rate is read by return date:** returns made this month ÷ sales made this month. It answers "are returns
     rising through the year" and, by channel, "10 % of call-centre value comes back against 5 % of e-commerce".
     - **By sale date** (returns of the sales made this month, dated by the original sale) is **not built in 1.2.0.**
       Rows keyed by the original sale's day would rewrite old days as returns arrive, which the day-by-day
       delete+insert cannot do. It is a 1.3 mart if the owner wants it.
   - **Every cut works:** store ("which pharmacy returns the most"), city, region, month, channel, order type,
     source, sale type, and the item hierarchy: category (A), B, C, D therapeutic class, E ingredient class, brand,
     vendor and manufacturer. E.g. "GLP-1 medicines have a 2 % return rate against 6 % for another class".
7. **Customers come from a new mart,** one row per day × store × channel × source × sale type × customer, with:
   - receipts;
   - sales value;
   - the member's join date.

   The customer is stored only as a **one-way, salted hash** of the loyalty number (`customer_key`, SHA2-256, the
   first 8 bytes). A plain hash of a 7-digit number can be reversed by trying every number, so the salt is 32 random
   bytes made **once in `POS_Analytics`** (`dbo.analytics_salt`, `CRYPT_GEN_RANDOM`): never in git, the image or an
   env var. Cube never declares the number, the hash or any name as a member (no PII, ADR 0006). It only counts
   them.
   - **Customers** (distinct members who bought) is a distinct count, published with the `rate` shape, so no screen
     sums it across days or stores. **"New customers in 2026"** = Customers with *Year joined* = 2026.
     **New customers** = distinct members who bought within 30 days of joining.
   - **New or regular,** at each visit:
     - `new` when the member joined in the 30 days before it;
     - `regular` when they joined earlier;
     - `not_on_file` for a loyalty number with no `LoyMember` row;
     - `unidentified` for a receipt with no member, or a placeholder.
   - Also: member type (M, F, N, A), year joined, and whether they joined at the store of the visit
     (`CreatedByBranchId`).
   - **Visits** are completed sale receipts. **Average basket** = sales value ÷ visits.
8. **The probe gates the deploy, not the build.** Each assumption above that the probe checks has a fallback, so the
   image builds and tests without the replica:
   - the channel column names;
   - the member table;
   - `ItemInfo`;
   - the return sign;
   - how far back the detail goes;
   - store codes against `Plant`;
   - item numbers against `MaterialNumber` (leading zeros).

9. **A sale's time is `TrxDate` + `TrxTime`,** never `TrxDate` alone.
   - This applies to the freshness gate's `loaded_at_field` on `RetailTrx` and `RetailTrxDetail`, and to every
     mart's newest source event ("data as of").
   - 1.0.0 used `TrxDate`. Because `TrxDate` is midnight, the 60-minute intraday gate sees the till source as
     stale from about 01:00 every day. Intraday then fails closed (`stale_source`) and only the 03:00 nightly,
     with its 6-hour gate, succeeds. **Fixed in 1.2.0.** Confirm on production's status card, or with
     `SELECT TOP 20 job, status, logged_at, message FROM POS_Analytics.dbo.mart_load_log ORDER BY load_id DESC`.
   - Late sales: store sales can reach head office days after `TrxDate`. The nightly rebuilds 3 days. A Sunday
     rebuild of the last 14 days catches stragglers.

10. **The figures, and where each comes from** (the owner's ruling 2026-11-05: boards show values **including VAT**).
    Item lines are `RetailTrxDetail` with `LineType = 0`; the header decides sale (100) or return (110).

    | Figure | Field | Note |
    |---|---|---|
    | Units sold / returned | `Quantity` | in the unit the till sold (box, strip) |
    | Base units sold / returned | `TotalQuantity` | `Quantity × UOMFactor`, the unit stock is held in; used for days of cover |
    | Gross value | `ExtendedPrice` | before discount (private: the discount share's denominator) |
    | Discounts | `TotalDiscount` | every discount kind on the line |
    | Item sales value / returns value | `Amount` | after discount, **including VAT** |
    | VAT | `VatAmount` | "excluding VAT" = `Amount − VatAmount` |
    | Wasfaty / Nupco surcharge | `Surcharge` | on top; never in item value |
    | Stock on hand | `StockAccumulated.UnrestrictedPos` | base units, storage location 0001 |
    | Stock value | stock × `ItemInfo.UnitCost` | an item with no cost counts 0 (and is counted as unvalued) |

    Every value is × the header's `ExchangeRate` when above 0. Coupon, voucher and bonus-buy lines are not items. The
    insurance columns (`Eligible`, `Benefit`, `PatientShare`, …) are **Secret** in the dictionary and never read.
11. **The first load shows on the status card.** A new dbt project makes the container rebuild every mart (the 2026
    marts only over their newest 35 days), then backfill the 2026 marts one month per dbt run, oldest first.
    `dbo.analytics_first_load` records each step; `/health` reports it as `firstLoad` (`done`, `running` with
    `rebuild` or `backfill` and month *n* of *m*, `failed`, `not_started`); SIS.Api passes it on; oms-react's status
    card shows a *First load* row. It never changes the overall status: the boards answer from the previous marts
    meanwhile, and a backfill's load-log rows never move "data as of".

## What would change this

- **The probe shows `Plant` ≠ `StoreCode` or `MaterialNumber` ≠ `ItemNumber`** (e.g. leading zeros). The snapshot
  copy then normalises the key.
- **Type 3 is not only Nupco / Wasfaty,** or type 4 is not only insurance. The `sale_type` seed changes, not the
  model.
- **The DBA won't open StockManager to the container.** The fallback is a linked server on DWPOSREPL03, or a copy
  replicated beside `POS`. The marts don't change, only where the snapshot comes from.
- **History before 2026 is wanted later.** It's the same chunked backfill, sized again: about 60 GB of headroom on
  `POS_Analytics` and a weekly Cube pre-aggregation.
