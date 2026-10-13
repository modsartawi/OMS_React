---
status: done
spec: C:\Work\DMSCO\BackOffice\.issues\assets\2641-oms-react-delivery-statistics-brief.md
blocked-by: — (live: BackOffice 2641)
---

# 484 — An HQ user sees today's delivery statistics across all stores

## What to build

**Slice 0 of Delivery statistics** (BackOffice brief 2641, ADR 0081). These are the till's POS
Statistics numbers, read across every store from the same source. Use the glossary words
**delivery** and **Trip**; never say "attempt". **Do not re-derive** the brief's counting rules
(each delivery counted once, on its first event; deliveries only). The server owns them, and the
page only reads.

- **Registration** (per `feature-structure`):
  - A new feature `features/oms/delivery-statistics/` with `DeliveryStatisticsPage.tsx` and `api.ts`.
  - The namespace `delivery-statistics`, in EN **and** AR, registered in `core/i18n.ts`.
  - The route `/oms/delivery-statistics`.
  - A menu item in the OMS group, gated by the same `omsAccessApi.access()` probe the other OMS
    items use. The door's grant is the OMS list grant `BackOfficeScreen[DocumentList,03]`.
- **Model:** `core/models/delivery-statistics.ts`, matching the door field for field:
  ```ts
  interface DeliveryStatistics {
    asOf: string | null
    flow: { cameIn?: number; madeReady?: number; outForDelivery?: number; trips?: number
            delivered?: number; pickedUp?: number; handedOver?: number }
    misses: { returnedBack?: number; rejected?: number; rescheduled?: number
              closeRequested?: number; closedOrCancelled?: number }
    avgHandOverMinutes: number | null
    series: { bucket: string; cameIn: number; handedOver: number }[]
    stores: { storeCode: string; flow: …; misses: …; avgHandOverMinutes: number | null }[]
  }
  ```
- **Query:**
  - `GET SdDocumentWeb/StoreStatistics`, on the web prefix that the other `SdDocumentWebEndpoints`
    doors use (as `SdDocumentWeb/DonorRequests` does). Confirm the exact route from BackOffice 2641's door contract doc if it has landed;
    otherwise take the brief's route, and 488 confirms it.
  - Params: `StoreCode` (omitted here, meaning all stores), `From`, `To`, `Granularity` (`hour`
    for one day, `day` for a range), `LeaveOutChurned=true`.
- **Periods:** tabs for **Today**, **Yesterday** and **Range**, held in URL state (`use-url-query`).
  - Range offers quick picks of 7, 14 and 31 days ending yesterday, plus a custom from–to that may
    end today.
  - A range over **31 days inclusive** is refused in the UI before any call, as the till does.
  - If the server refuses anyway with `SDD-02131`, the refusal surfaces through
    `apiErrorMessage`.
- **Figures:**
  - The **flow band**: Came in · Made ready · Out for delivery (with **Trips** as its sub-caption)
    · Delivered · Picked up · Handed over.
  - The **misses band**: Returned back · Rejected · Rescheduled · Close requested · Closed /
    cancelled.
  - **Avg hand-over** in minutes.
  - **AsOf**, which shows that the numbers are at most 5 minutes behind.
- **Contract gap:** a figure the server does not send (e.g. `trips` from an older SIS.Api), or a
  null average, shows **"—"**, never 0. Every number is isolated with `Ltr`.

## Spine reach

model/api (`core/models`, feature `api.ts`) · logic (period resolver, figure reader) · route + menu + page · i18n EN/AR · test

## Proof (→ `tdd` red-green cycles)

- [x] `resolvePeriod`: Today, Yesterday, 7/14/31 quick picks and custom resolve to `From`/`To`/`Granularity`; 32 days inclusive is refused; a reversed range is refused (vitest)
- [x] `readFigure`: an absent figure and a null average read as "—"; a 0 reads as 0 (vitest)
- [x] `tools/delivery-statistics-drive.mjs` against a stub that emits **exactly** the brief's fields, LTR and RTL. It checks:
  - the three tabs;
  - the 31-day guard makes no call;
  - Trips under Out for delivery;
  - "—" when the stub drops `trips`;
  - an `SDD-02131` envelope shown as a refusal.
- [x] `npm run typecheck`, `npm run lint`, `npm test` green

## Boundaries

- One new door, `StoreStatistics`, stubbed until 488. Its business code is `SDD-02131` (range too
  long); `SDD-02132` (query invalid) shows the server's message.
- The 401 is `core/api`'s.
- A new namespace, `delivery-statistics`.
- No feature flag: the OMS access probe gates the menu.

## Done when

The two vitest helpers and the drive are green, and `/oms/delivery-statistics` renders all-store figures from the stub.

## Blocked by

None — can start immediately (live door: BackOffice 2641).

## Open questions

- Grant: the door uses the OMS list grant by default; the owner may still swap it for a dedicated statistics grant (BackOffice 2641). The menu gate follows whatever the door ends up checking.

## Comments

- 2026-10-13 (AFK, /implement): **done**, against a STUB of the door (BackOffice 2641 unbuilt).
  - Built: `core/models/delivery-statistics.ts` (every figure optional; `StoreStatisticsQuery` names the door's params);
    `features/oms/delivery-statistics/` — `period.ts` (`resolvePeriod`, `doorParams`, URL `period`/`pick`/`from`/`to`),
    `figures.ts` (`readFigure`, `readAverage`, `hasFigure`), `api.ts`, `DeliveryStatisticsPage.tsx` (control bar → flow band
    with Trips under Out for delivery → misses band + Avg hand-over → commented slots for 486/487); namespace
    `delivery-statistics` EN + AR (figure captions from the till's `OmsStatisticsDashboard.cs`); route; menu leaf last in the
    OMS group; `canOpenDeliveryStatistics` in `@/core/oms/access` reads `canOpenList` for both leaf and gate.
  - Proof: vitest 271 files / 4822 tests green (period 20, figures 9, access + menu leaf added); typecheck, lint (4 gates),
    build green; `tools/delivery-statistics-drive.mjs` **78/78** LTR + RTL (stubbed door; Today refetch proven with
    Playwright's clock; Yesterday does not poll).
  - Review: /code-review fixed midnight rollover of Today, Arabic plurals for the day picks, the cap interpolated + isolated,
    a typed door query, pressed-button period selector; ruled out polling a custom range that ends today (only Today polls).
    /standards-review: no hard violations; spec axis clean.
  - Decisions (owner sign-off): `.afk/HITL-484.md` — Arabic for Trip ("الرحلات"), a custom range ending after today is
    refused, avg at 2 decimals, leaf placement.
  - **Outstanding (not AFK):** the live door (488); an owner eyeball of the Arabic copy — the app keeps `lng: 'en'` under
    `oms.locale=ar`, so the drive proves RTL layout and isolation but never renders the AR strings.
