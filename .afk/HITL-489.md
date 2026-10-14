# HITL — 489 (the statistics page draws a Delivery lane and a Pick-up lane)

## Q: What heading does the store-wide group carry, now that the old flow band ("Deliveries") is split?
**Decision taken:** `band.storeWide` = "All deliveries" / "جميع التوصيلات"; the old `band.flow` key ("Deliveries" / "سير التوصيل") is removed (it had no other reader).
**Why:** "Deliveries" directly above a "Delivery" lane reads as the same thing; "All deliveries" says the group is both tracks plus Unspecified, store totals.
**Revisit if:** the owner wants the till's rail wording (the till's rail has no caption) or a different Arabic word for the group.

## Q: Does the Unspecified tile carry a line under its caption?
**Decision taken:** Yes — "Neither Delivery nor Pick-up" / "لا توصيل ولا استلام", with an attention (amber) top accent.
**Why:** "Unspecified" alone does not say what is unspecified; the till's tile has no note, but the web tile sits apart from the pair, and the brief calls it bad data worth seeing.
**Revisit if:** the owner wants strict till parity (caption only), or a different accent.

## Q: Where do the lane averages draw, and how is "not a stage" shown?
**Decision taken:** after the stages, set apart by a logical inline-start border (`border-s ps-3`) and with NO chevron before it; the stages carry a `ChevronRight` between each with `rtl:rotate-180` (the repo's idiom), so they mirror under RTL. Lane averages reuse the store-wide unit key (`avgHandOver.unit`, "min" / "دقيقة").
**Why:** the till draws a lane average "without the stage arrow" (`LaneAverage`, `IsNotAStage`); one unit key keeps the three averages alike.
**Revisit if:** the owner wants the averages in a column aligned under each other with the store-wide one.

## Q: Order of the store-wide group
**Decision taken:** Came in · Handed over (its "Delivered + picked up" note) · the Delivered | Picked up pair · Avg hand-over · Unspecified (only when above 0).
**Why:** the ticket's order; Avg hand-over is its own tile AFTER the pair, never under the Handed over note, so nothing beside it implies it averages Delivered + Picked up (490's concern, met here already).
**Revisit if:** the owner wants Unspecified beside the pair, as on the till's rail (`rail.split` = Delivered, Picked up, Unspecified).

## Q: Do the two lanes' stages align column for column?
**Decision taken:** No — each lane's stages share its width (Delivery 4, Pick-up 3), with the averages aligned at the lanes' end.
**Why:** aligning Pick-up's Picked up under Out for delivery would read as a stage it never has.
**Revisit if:** the owner wants Came in / Made ready columns aligned across the lanes.

## Note for 492: the live drive will not pass as it stands
`tools/delivery-statistics-live-drive.mjs` (492's, not touched here) waits on `[data-statistics-band="flow"]` and reads store-wide Made ready / Out for delivery / Trips tiles. Those are gone by design (decision A): the store-wide group is now `data-statistics-band="storeWide"`, the lanes `delivery` / `pickUp`, Trips is `data-figure="delivery.trips"`. 492 must re-point it.

## Q: The Delivery lane's trips sub-caption — "N trips" (ticket 489) or "Trips N" (runner brief)?
**Decision taken:** "Trips N" — the existing `flow.trips` key ("Trips <v>{{n}}</v>" / "الرحلات <v>{{n}}</v>") moved to the Delivery lane's Out for delivery, keeping its `<Trans>` slot.
**Why:** the runner's wave facts say `"Trips N" as its sub-caption` and the ticket's Boundaries say "the trips caption keeps its <Trans> slot"; moving the caption, not rewording it, is the conservative read.
**Revisit if:** the owner wants the ticket's literal "409 trips" wording (one locale edit per language).

## Q: Is the per-track `flow` required in the model, as the contract writes it?
**Decision taken:** `flow?` is optional in `DeliveryStatisticsTrack`; `delivery` / `pickUp` stay required inside `tracks`.
**Why:** the readers already read it defensively (as `store-rows.ts` reads a store's `flow`), and an optional type makes every consumer (490, 491) handle a partial answer as "—" instead of a TypeError.
**Revisit if:** the team prefers the type to mirror the contract's required `flow` verbatim.
