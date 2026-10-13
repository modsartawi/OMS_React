# HITL-484 — decisions taken unattended

## Q: Which grant gates the menu leaf and the page?
**Decision taken:** a new predicate `canOpenDeliveryStatistics` in `@/core/oms/access` reading `canOpenList` (the OMS list grant `BackOfficeScreen[DocumentList,03]`) off the ONE `OMS_ACCESS_KEY` probe entry; the leaf and the ScreenGate share it.
**Why:** the ticket and BackOffice 2641 say the door checks the OMS list grant; one predicate means the nav and the page cannot disagree.
**Revisit if:** the owner swaps in a dedicated statistics grant (2641's open question) — then only this predicate (plus a new probe flag) changes.

## Q: Where in the OMS group does the leaf sit?
**Decision taken:** last, after spec 430's five D18 leaves.
**Why:** no order was specified; appending disturbs no shipped ordering test or habit.
**Revisit if:** the owner wants it beside Delivery Documents.

## Q: Arabic caption for "Trips" and the page/menu title
**Decision taken:** "الرحلات <n>" for the sub-caption, "إحصاءات التوصيل" for the title; every other figure caption is copied from the till's `OmsStatisticsDashboard.cs` CaptionAr (وارد، تم تجهيزه، خرج للتوصيل، تم التوصيل، تم الاستلام، تم تسليمه، أعيد، مرفوض، أعيدت جدولته، طلب إغلاق، مغلق / ملغى، متوسط مدة التسليم).
**Why:** the till has no Arabic for Trips (2639 adds the figure); "رحلة" is the literal for Trip and avoids "attempt" (محاولة).
**Revisit if:** BackOffice CONTEXT.md or the till adopts a different Arabic term for Trip.

## Q: Is a custom range that ends after today allowed?
**Decision taken:** refused in the UI (`future`), no call; the date inputs also carry `max=today`.
**Why:** the brief says a custom range "may end today", read as the upper bound; a future day has no deliveries and would only confuse.
**Revisit if:** the owner wants future days to read as zeros.

## Q: How many decimals does Avg hand-over show?
**Decision taken:** at most two, Western digits, thousands grouped; unit "min" beside it; null → "—" with no unit.
**Why:** the till rounds `AvgHandOverMinutes` to 2 decimals (`OmsStatisticsDashboard.cs:298`), so parity (488) compares like with like.
**Revisit if:** the owner prefers whole minutes or "1h 27m".

## Q: URL shape of the period
**Decision taken:** `period=today|yesterday|range` (today = bare URL), `pick=7|14|31|custom`, and `from`/`to` only for custom. Range opens on the 7-day pick.
**Why:** short, readable, shareable; 485 adds store + leave-outs beside it.
**Revisit if:** 485 needs the leave-outs in the same param family.

## Q: What shows while a refused period or a failed read is on screen?
**Decision taken:** neither band is drawn — only the refusal / the server's message. No stale figures beside a refusal.
**Why:** figures from the previous period under a refusal would read as this period's.
**Revisit if:** the owner prefers dashes in the bands.

## Contract gap
None found: the stub emits exactly the brief's fields. The client keeps every figure optional and maps an absent `flow`/`misses`/`series`/`stores` to empty (dashes), not to zeros.
