# 717 — Proof numbers from the production replica

Pulled 2026-11-03 from the read-only prod replica (`172.23.27.47` / `POS`, door of BackOffice
ticket 1260), aggregates only — no customer-identifying data left the database.
Main window: **30 days, 2026-10-04 → 2026-11-02 inclusive**. Year to date: 2026-01-01 → 2026-11-02 (306 days).

## Headline figures (safe to show)

| # | Figure | Value | Per day | Query notes |
|---|---|---|---|---|
| N1 | Stores trading (made ≥1 sale in 30 days) | **965** | — | distinct `RetailTrx.StoreCode`; YTD 1,016 |
| N2 | Tills trading | **2,054** | — | distinct store+machine |
| N3 | Till sales, 30 days | **5.61 M** | **~187 k** | `TrxType=100`, `TrxStatus=1` |
| N4 | Till sales, year to date | **54.9 M** | ~179 k | same filter |
| N5 | Net till value, 30 days | **SAR 469.8 M** | ~SAR 15.7 M | sales − returns, BHD × 10 |
| N6 | Sales value YTD (before returns) | **SAR 4.86 bn** | — | |
| N7 | Return rate | **1.0 %** | — | 57,589 returns (`TrxType=110`) |
| N8 | Sales identified to a loyalty member | **72.5 %** | — | 4.07 M of 5.61 M; placeholders 3795407 / 3378 / 1000000004 excluded |
| N9 | Distinct loyalty members who bought in 30 days | **2.19 M** | — | same exclusions |
| N10 | Loyalty members on file | **14.86 M** | — | `LoyMember` rows |
| N11 | Online/omni orders created (OMS, category O) | **412,136** | **~13.7 k** | 973 stores; by channel below |
| N12 | Wasfaty e-prescriptions fetched | **2.69 M** | ~90 k | `ErxHeader`, 950 stores |
| N13 | Wasfaty calls answered successfully | **2.69 M of 3.55 M (75.7 %)** | — | `WasfatyErx.Success`; 954 stores |
| N14 | Insurance (NPHIES-linked) till sales | **134,009** | ~4.5 k | `NphiesEligibilityId` set |
| N15 | Other OMS documents (insurance / Wasfaty / prescription flows, category X) | **543,857** | ~18 k | |
| N16 | Bahrain sales | 3,748 | — | `DocumentCurrency='BHD'` |

## Orders by channel (30 days, category O)

| Channel | Orders | Share |
|---|---|---|
| Own app + web (iOS 146,977 · Android 38,009 · Web 25,641 · Landing page 2,518) | **213,145** | **51.7 %** |
| HungerStation | **83,060** | 20.2 % |
| Insurance platform | **72,222** | 17.5 % |
| Call centre (11 sources: outbound, inbound, follow-up, chat, Dawaok, Wasfaty, refund, insurance…) | **39,565** | 9.6 % |
| Clinics · P2E · ERX · Dawaok | 4,144 | 1.0 % |
| **Total** | **412,136** | 100 % |

Deliverect created **0** orders in the window (the integration exists; it carried no traffic).

## Caveats — read before putting a number on a slide

- **"Net till value" is not audited revenue.** It is the till-recorded `Amount` after discount. On insurance
  and credit documents the payer's share is handled differently, and the finance-only `TrxType 700` documents
  (25,639 in the window) are excluded. Say "sales through our tills", not "revenue".
- **Online share is not like-for-like with Nahdi's 25.8 % "digital share".** We count *orders*, not revenue, and
  6.9 % of till sales (386,406) are linked to an OMS order number. Pick one definition with finance before
  comparing to a competitor.
- **No NewPos traffic on the replica.** A 7-day sample shows zero `IsNewPos` transactions. Do not claim the new
  till is live.
- **Delivery speed could NOT be measured here.** On the replica, `SdDocumentHeaderAction` has no `DeliveredTime`
  / `OutForDeliveryTime` and no `DeliveryStatus` for recent documents. Callouts, donor requests, dispatch
  scorecards, the SAP IDoc rail and coupons-by-engine are not replicated either. Those figures need the prod OMS /
  HQ databases (owner action — see the ticket).
- Some till rows are dated in the future (bad till clocks); all windows are capped at 2026-11-02.

## Queries

Run through the sanctioned `sqlcmd` invocation from BackOffice memory `reference_pos_replica_readonly_door`.

```sql
DECLARE @f date='2026-10-04', @t date='2026-11-03';
-- N1–N3, N5, N7–N9, N14, N16
SELECT COUNT(*) trx, SUM(CASE WHEN TrxType=100 THEN 1 ELSE 0 END) sales, SUM(CASE WHEN TrxType=110 THEN 1 ELSE 0 END) returns_,
 SUM(CASE WHEN TrxType=100 THEN Amount*CASE WHEN ExchangeRate>0 THEN ExchangeRate ELSE 1 END
          WHEN TrxType=110 THEN -Amount*CASE WHEN ExchangeRate>0 THEN ExchangeRate ELSE 1 END ELSE 0 END) net_sar,
 COUNT(DISTINCT StoreCode) stores, COUNT(DISTINCT StoreCode+'|'+MachineCode) tills,
 SUM(CASE WHEN TrxType=100 AND ISNULL(NphiesEligibilityId,'')<>'' THEN 1 ELSE 0 END) nphies_sales,
 SUM(CASE WHEN TrxType=100 AND ISNULL(LoyaltyCustomerID,'') NOT IN ('','3795407','3378','1000000004') THEN 1 ELSE 0 END) loyalty_sales,
 SUM(CASE WHEN TrxType=100 AND ISNULL(OrderNo,'')<>'' THEN 1 ELSE 0 END) order_linked_sales,
 SUM(CASE WHEN TrxType=100 AND DocumentCurrency='BHD' THEN 1 ELSE 0 END) bahrain_sales
FROM RetailTrx WHERE TrxDate>=@f AND TrxDate<@t AND TrxStatus=1 AND TrxType IN (100,110);
-- N11 + channel table
SELECT h.DocumentSource, s.Description, COUNT(*) n FROM SdDocumentHeader h
 LEFT JOIN SdDocumentSource s ON s.DocumentSource=h.DocumentSource
 WHERE h.EntryTime>=@f AND h.EntryTime<@t AND h.DocumentCategory='O' GROUP BY h.DocumentSource, s.Description;
-- N15
SELECT DocumentCategory, COUNT(*), COUNT(DISTINCT StoreCode) FROM SdDocumentHeader WHERE EntryTime>=@f AND EntryTime<@t GROUP BY DocumentCategory;
-- N12, N13
SELECT COUNT(*), COUNT(DISTINCT StoreCode) FROM ErxHeader WHERE ErxDateTime>=@f AND ErxDateTime<@t;
SELECT COUNT(*), SUM(CASE WHEN Success=1 THEN 1 ELSE 0 END), COUNT(DISTINCT StoreCode) FROM WasfatyErx WHERE ActionDateTime>=@f AND ActionDateTime<@t;
-- N4, N6 (YTD)
SELECT COUNT(*), SUM(Amount*CASE WHEN ExchangeRate>0 THEN ExchangeRate ELSE 1 END), COUNT(DISTINCT StoreCode)
 FROM RetailTrx WHERE TrxDate>='2026-01-01' AND TrxDate<@t AND TrxStatus=1 AND TrxType=100;
-- N9, N10
SELECT COUNT(DISTINCT LoyaltyCustomerID) FROM RetailTrx WHERE TrxDate>=@f AND TrxDate<@t AND TrxStatus=1 AND TrxType=100
 AND ISNULL(LoyaltyCustomerID,'') NOT IN ('','3795407','3378','1000000004');
SELECT COUNT(*) FROM LoyMember;
```
