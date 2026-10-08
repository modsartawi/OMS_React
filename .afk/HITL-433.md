# HITL log — ticket 433 (Document payments)

## Q: Which field is "entry time"? The model has no entry-time field
**Decision taken:** "Entry time" shows `documentDate` (formatted `yyyy-MM-dd HH:mm`). WPF's own `DocumentEntryTime` column is commented out in the XAML and the class has no such field.
**Why:** Invent no field (spec D4: rows are the model as WPF reads it).
**Revisit if:** the live door's `documentDate` is date-only (every cell would read `00:00`) — then show it as a day, or ask BO-3 for the entry time.

## Q: "Payment type" — `conditionTypeDescription` or `paymentType`?
**Decision taken:** Both are shown: `conditionTypeDescription` under "Payment" (WPF headed it "Payment Type", beside the amount), `paymentType` under "Payment type".
**Why:** WPF showed both; the ticket lists "payment type" once.
**Revisit if:** the owner wants WPF's exact header ("Payment Type" on the condition description).

## Q: Columns beyond the ticket's list
**Decision taken:** Added Document no first (WPF's first column; it is what "Open document" opens). Left out WPF's CustomerName, OrderCloseStatus, OrderIsActiveInStore, DeliveryStoreCode, Delivery ready/close status, SalesInvoice, ReturnInvoice (story 25 says "everything the WPF screen showed"; the ticket's list is narrower).
**Why:** The ticket's list is the slice's contract; customer name stays off the grid.
**Revisit if:** the owner wants invoices or the other statuses (all are on the model already — one column each).

## Q: Does the 1,000 guard count duplicates?
**Decision taken:** No — distinct per box (case-insensitive), summed across the two boxes, exactly as `MultiValueFilter.Split(...).Length` sums in WPF `Find()` and the service. Uses the core splitter's separators.
**Why:** A list the server would take is never refused here, and one it refuses never makes the trip.
**Revisit if:** BO-3 counts raw entries instead.

## Q: Load on open or on Search? What happens on Back / Reset?
**Decision taken:** Loads on Search only (D16). The applied search is kept on the history entry's router state (never the URL — it holds phones), so Back from Document Details restores the result. Reset returns to today/200 AND clears the result. Double-click on a row also opens its document.
**Why:** A broad PII query should not fire on arrival; losing the result on Back made the row actions a dead end.
**Revisit if:** the owner wants today's payments on arrival.

## Q: Extra checks WPF lacked
**Decision taken:** Search is refused for a missing/malformed day, a reversed range, and a limit that is not a whole number 1..2147483647 (the door's `int?`). Store and phone are trimmed; the number boxes go as typed.
**Why:** Each would otherwise be a server model-binding error or an empty answer.
**Revisit if:** the owner wants WPF's laxity.

## Note: left as review findings, not changed
- StatusBar / export / draft-vs-applied search are near-copies of DonorRequestsPage's; `/oms/document|delivery/<no>` is now built in a fourth place (`row-offers.ts`). A `@/core/oms` route builder and a shared list-status piece would end it; that touches donor-requests/deliveries, so it was left.
- The status-bar count is the server's answer, not the rows left after column filters (the export's) — the same as the donor list.

## Note: port 5199 was occupied by a server this session did not start
The drive ran on a vite server started on port 5233 (`DRIVE_PORT=5233`), killed afterwards. The process on 5199 was left alone.
