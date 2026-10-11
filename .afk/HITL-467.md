# HITL — 467 (Transactions tab, BackOffice spec 2586)

## Contract gap

- **The door does not expose `AgreementWindowDays`.** `Store/Transactions` refuses a day outside
  D-0..D-`AgreementWindowDays`, but no door returns the setting. As ruled, the picker offers today plus
  the 7 days before it, from one constant (`TRANSACTIONS_WINDOW_DAYS` in `transactions-helpers.ts`). Its
  comment cites both contract sections ("Today's transactions" and "Rail agreement", D-1..D-7).
  If the setting changes, the picker is wrong: set to 5, D-6 and D-7 answer `BAD_DATE`; raised, the
  extra days cannot be reached. The fix is for the door (or `ActionSync/Access`) to return the window.
- **"Today" is the browser's date, but the door judges D-0 against the server's.** A browser whose
  clock or timezone runs ahead of the server's just after midnight would ask for a day the door thinks is
  tomorrow, and get `BAD_DATE` (shown as the tab's error banner). The estate is single-timezone, so this is
  accepted as ruled. Returning `today` from the door would close it.

## Q: arrived badge — `go` or `ok`?
**Decision taken:** `go` (primary token), as the wave runner rules ("arrived -> go").
**Why:** the runner's ruling is the later and more specific one. The ticket's "`arrived` ok" reads as the word, not the token.
**Revisit if:** the owner wants arrived drawn green (`ok`): a one-word change in `COUNTER_SEVERITY`, plus the drive's `bg-primary-050` check.

## Q: who adds the `TransactionSnapshotView` audit label — 467 or 468?
**Decision taken:** 467 added it: the `AUDIT_ACTIONS` entry, "Viewed receipt JSON" in the bundle, and the name in the existing `auditActionKey` test list.
**Why:** 467 owns `AuditAction`, and `AUDIT_ACTIONS` is a `Record<AuditAction, true>`, so the model change does not compile without it. Without a label, the audit feed would render the raw key.
**Revisit if:** 468 wants different wording. The ruled wording was used.

## Q: does the tab check `onMirror`, as Mirror and Agreement do?
**Decision taken:** no. Only a WPF store (`isWpfStore`) is answered client-side. A worker store not on mirror asks the door, and gets zero rows or `available: false`.
**Why:** the ticket and the ruling name exactly two client-side empty states, WPF and `available: false`. The door's predicate is `StoreId = code` on the mirror, not the swept location.
**Revisit if:** the owner wants "not on the mirror rail" wording there too, as on the Mirror and Agreement tabs.

## Q: `transactionsQuery` signature
**Decision taken:** `transactionsQuery(code, day, filter, page)`. The ticket writes `transactionsQuery(day, filters, page)`.
**Why:** the siblings `mirrorQuery(code, …)` and `agreementQuery(code, …)` take the code first, and the door needs it.
**Revisit if:** never: it is a naming difference only.

## Q: a picked day that has aged out of the window
**Decision taken:** it goes back to today, on page 1. This only happens to a tab left open for days, or on D-7 across midnight.
**Why:** the day is no longer offered and the door would refuse it. The ruling's "never changes day under the user at midnight" holds for every day still in the window.
**Revisit if:** the owner prefers an error banner.

## Q: searching a voided receipt with the default status
**Decision taken:** the search sends only `receipt=`, so the door's default `COMPLETED` still applies, and a voided receipt is found only with status Voided or All.
**Why:** the contract makes `receipt` one more filter beside status. Silently widening the status would make the summary disagree with the status picker.
**Revisit if:** the delegate expects a receipt search to ignore status. The fix would be to send `status=all` while a receipt is searched.

## Known minor (code review, not fixed)
- The "Re-read every minute while today is shown" hint is judged at render. Across midnight with no re-render it can stay up after polling has stopped. Polling itself is judged at each tick and is correct.
- A failed poll replaces the list with the error banner, as Mirror and Agreement do ("a failed read draws none of the previous rows").
