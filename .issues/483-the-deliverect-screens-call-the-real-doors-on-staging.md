---
status: open
spec: C:\Work\DMSCO\BackOffice\.issues\2615-deliverect-delivery-platforms-spec.md
blocked-by: 477, 478, 479, 480, 481, 482 (live: BackOffice 2616, 2623–2627)
---

# 483 — The Deliverect screens call the real doors on staging

## What to build

The live walk for spec 2615 runs once the BackOffice doors are deployed to staging, the four grants
are seeded and bound to the walker, and one Deliverect staging test location is linked.

- Write `tools/deliverect-live-drive.mjs`, with its inputs (test store, account, a test material,
  a platform) in a JSON inputs file. Writes go behind `--write`. It asserts every door's shape
  against `core/models/deliverect.ts`, failing on any field the wire lacks or adds.
- The owner then walks it:
  1. Onboard the test store and link it from Deliverect's staging portal.
  2. Whitelist a material, exclude it for one platform, and push the catalog.
  3. Resume the sync and see the stock in Deliverect.
  4. Set the store busy and reopen it, and push the hours.
  5. Place a staging order, see it in the monitor, and invoice it at the test till.
  6. Watch Finalized appear.
  7. Cancel a second order before invoicing.

## Spine reach

UI → app (BackOffice doors, live)

## Proof (→ `tdd` red-green cycles)

- [ ] The live drive is green on staging
- [ ] The owner walk is signed off

## Boundaries

Live only, against **staging** Deliverect and a **test** store. Never a store the business trades
from.

## Done when

The live drive is green and the owner walk is signed off.

## Blocked by

- [477](477-an-hq-user-onboards-a-store-on-a-deliverect-account-and-sees-its-link.md)
- [478](478-an-hq-user-follows-deliverect-orders-in-the-monitor-and-retries-a-failure.md)
- [479](479-a-category-manager-maintains-the-deliverect-whitelist-and-platform-exclusions.md)
- [480](480-an-hq-user-sees-each-deliverect-store-s-stock-sync-pauses-it-and-reads-its-logs.md)
- [481](481-an-ops-user-sets-a-deliverect-store-busy-closed-or-reopened-and-re-pushes-its-hours.md)
- [482](482-finance-maintains-delivery-platforms-and-their-effective-dated-terms.md)

(live: BackOffice 2616, 2623–2627)
