---
status: done
spec: C:\Work\DMSCO\BackOffice\.issues\2544-material-master-on-the-web-spec.md
blocked-by: 452, 453, 454 (live: BackOffice 2545–2549 deployed to staging + Gs1SerialInquiry seed run)
---

# 455 — The Materials screens call the real doors on staging

## What to build

Switch the four Materials screens from stubs to the live `MaterialWeb/*` doors on the staging
SIS.Api, then the owner walks them through.

- Remove or retire the stubs, keeping only those the vitest helpers use.
- **Fix any drift from the contract in the contract first**
  (`C:\Work\DMSCO\BackOffice\.issues\assets\2544-material-web-door-contract.md`), then in both
  repos — never only in the client.
- Run each drive against staging where a staging login is available.

## Spine reach

UI → live BackOffice doors → HQ DB / Stock Visibility

## Proof (→ `tdd` red-green cycles)

- [x] Each of `materials-search`, `materials-detail`, `materials-stock` and `materials-gs1`
  drives green ~~against staging~~ **against the local SIS.Api** (`:5111` on `POS_Server`): the live
  drive's four sections, 86/86 as 14419 (owner ruling 2026-10-09: local stands in for staging;
  staging is a deploy check, not this ticket's gate)
- [x] **Owner walk**, against real data (owner, 2026-10-09, on the local SIS.Api: "looks good"):
  - search by a real barcode, a real GS1 scan, an AR word and an A→C level path;
  - open a serialised material's Batches and Stock tabs;
  - stock-check 5 materials × one city;
  - GS1-check a known sold unit and see its history;
  - read the Arabic labels.
- [x] A user without `Gs1SerialInquiry` does not see GS1 check; a user without
  `MaterialStockInquiry` sees ~~no Stock tab~~ **a Stock tab that says "not permitted" and never
  calls the door** (spec 2544's grants section — the ticket's wording drifted from it) and no Stock
  check. Live, as search-only stub 99998: 65/65, menu hides both, Stock tab denied, no Stock call.

## Boundaries

Needs BackOffice 2545–2549 deployed to staging, the `Gs1SerialInquiry` seed run on the staging
OMS-HQ DB, and `StockV2:*` set in staging's appsettings. **Human in the loop (HITL)**: the walk is
the owner's, so an AFK runner should stop here and hand it back.

## Progress — 2026-10-09 (client half; staging walk still open)

BackOffice 2545–2549 are merged on `pricing2` (e8ad648df). Done without a live server:

- **Drift check, server against contract against client.** Every door's route, verb, query
  parameter and wire model in `MaterialWebEndpoints.cs` / `Modules/Materials/Web/*Models.cs` matches
  `src/core/models/materials.ts` field for field. The two contract amendments the BackOffice build
  made (e447bafed) needed no client change: the error envelope `errors[].errorCode` is what
  `apiErrorCode` already reads, and the drives already stub it; a Levels code with only blank
  descriptions arrives as `""`, and the client already drops blank codes only. GS1 `status`
  (`SELLABLE`/`SOLD`/`HELD`, from `SerialGuardVerdicts`) and issue `category` (the `Gs1IssueCategory`
  enum names) match.
- **One drift, in the client only:** `MaterialResolvedAs` carried a `'material'` value the contract
  and the server never send (rule 4: an exact material number is still `"text"`). Removed, with
  its test case.
- **The stubs stay, as the screens' regression.** The four stubbed drives pin exact fixture values
  no real database holds, so they are not pointed at staging; no vitest helper uses a stub.
  Their sibling `tools/materials-live-drive.mjs` stubs nothing. It signs in for real and checks
  that each door answers on the envelope with exactly the contract's keys, and that each screen
  draws what came back. It runs in four sections named after the four drives (`--only
  search,detail,stock,gs1`), and its inputs are the owner's real values in
  `tools/materials-live-inputs.json` (a TODO input SKIPs its checks, and a SKIP exits non-zero).
- `vite.config.ts`: `SIS_API` points the dev proxy at another SIS.Api, such as staging (default
  `:5111`), with `secure: false` and a cookie-domain rewrite so a staging session cookie lands on
  `localhost`.
- Gates: typecheck clean, the 186 Materials vitest tests and all four lint gates pass, the stubbed
  `materials-search` drive is still 74/74 on port 5244, and the live drive exits 2 with a message
  when no dev server answers or the sign-in sets no cookie.

**Signed off by the owner 2026-10-09 (two departures from this ticket's wording):**

1. *"Remove or retire the stubs, keeping only those the vitest helpers use"*: the four stubbed
   drives are **kept**, even though no vitest helper uses them. They are the only regression for
   the screens' behaviour, such as the refusals, the 50 cap, the duplicates and RTL, and no real
   database can produce those. Retiring them would leave the screens unguarded.
2. *"Each of `materials-search`, `materials-detail`, `materials-stock` and `materials-gs1` drives
   green against staging"* is met by **one live drive with four sections of those names**, not by
   the four stubbed drives pointed at staging.

**Outstanding (HITL):**

- the staging URL and a login;
- the `Gs1SerialInquiry` seed and the `StockV2:*` settings on staging;
- the inputs file filled in;
- the live drive green;
- the owner walk, including the Arabic read (the live drive runs in English only);
- the two no-grant checks, which need a second account without those grants.

**2026-10-09 re-check (AFK `/implement 455`):** nothing more is buildable without the owner. No
local SIS.Api answers on `:5111`; the host in this machine's `SIS_API_BASEURL`
(`172.23.27.111:8099`) answers `GET MaterialWeb/Access` with the SPA's `index.html` (200,
`text/html`), not an envelope, so the MaterialWeb doors are not served there (or it is not the
staging API). No `SIS_USER`/`SIS_COOKIE` is set. The inputs file still holds 10 TODO values
(only `searchText` is real).

**2026-10-09 live drive against the LOCAL SIS.Api (`:5111`, `.\SQLEXPRESS` `POS_Server`, dev stub
login as 14419 — ADMIN-like, all three grants):**

- `tools/materials-live-inputs.json` filled from that database: Arabic `بانادول`, barcode
  `5010006100692`, SFDA `1-288-98`, levels A008 → B041 → C119, serialised material 100025 (61
  batches), stock basket 101683–101687 × Abha, GS1 scans of 100025 lot 556165: serial …0430
  (sold then returned → SELLABLE) for the search, serial …9494 (net sold at P001, invoice
  00114618701261 → SOLD, 3 history rows) for the GS1 check.
- **`materials-live-drive.mjs` 84/84, 0 skipped, exit 0**, all four sections. Stock rode the real
  Stock Visibility (`StockV2:BaseUrl` of the dev appsettings).
- First run was 82/84: the drive read the Levels B/C answer that went out before the choice above
  reached the URL (an unfiltered ask, re-asked filtered a beat later). A drive race, not a client
  drift — the levels query key already carries the levels above. Fixed in the drive: it waits for
  the answer asked under the choice above.
- No-grant user (stub id 99999, no `UaUserRole`): `Access` answers all three `false`; Search,
  StoreSets and Gs1/History answer 403. The per-grant UI split (search yes, stock/GS1 no) still
  needs an account holding only `ItemInquiryCustome`.
- Gotcha for a hand probe: a cookie request without the `X-Web-Client` header is a 401 (the CSRF
  check), not a grant problem — the app's `api.ts` sends it.

**2026-10-09 close-out.** Owner walked the four screens ("looks good"), ruled the local run stands
in for staging, and signed off both departures. Partial-grant check seeded on the LOCAL `POS_Server`
only: grant `Test455MaterialSearchView` (ItemInquiryCustome/03) → role
`TEST455_MATERIAL_SEARCH_ONLY` → `UaUser`/`UaUserRole` 99998. The run found the drive (not the
client) asserting the ticket's "no Stock tab" against a spec that says the tab shows "not
permitted"; the drive now checks the spec's behaviour, plus that the menu hides Stock check / GS1
check for a session without their grants.

## Done when

The drives are green on staging and the owner has signed off the walk.

## Blocked by

[452](452-an-hq-user-opens-a-material-s-detail-tabs.md),
[453](453-a-supply-user-checks-stock-for-a-basket-of-materials-across-stores.md),
[454](454-a-quality-user-scans-gs1-units-and-reads-their-history.md)
