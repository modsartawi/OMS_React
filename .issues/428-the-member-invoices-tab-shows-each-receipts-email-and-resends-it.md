---
status: done
spec: C:/Work/DMSCO/BackOffice/.issues/2443-call-centre-requeues-a-members-invoice-email-spec.md
blocked-by: —
---

# 428 — The member Invoices tab shows each receipt's invoice email and resends it

**Source:** BackOffice spec 2443 (grilled 2026-10-07).
**Live:** BackOffice 2446 provides the read and BackOffice 2445 the command. Build against stubs of
the two wire contracts below, and do the live walk once both are merged. The cutover walk is
BackOffice 2447.

## Wire contracts

**Read, look tier.** `GET LoyWeb/Reports/Invoices/{loyId}` answers in the usual envelope, one row per
receipt, newest first, last 90 days:

```
{
  storeCode, trxNumber, trxDate, documentType,
  status: "Sent" | "Skipped" | "Failed" | "Queued" | "NotQueued",
  skipReason: string | null,      // NO_EMAIL, INVALID_EMAIL, SUPPORT_EMAIL, PLACEHOLDER_MEMBER, NO_ORDER, …
  lastAttemptAt: string | null,
  recipient: string | null,
  recipientSource: "Profile" | "Order" | null,
  resendable: boolean,
  notResendableReason: string | null   // "NOT_QUEUED" | "QUEUED" | a skip reason code
}
```

**Command, edit tier.** `POST LoyWeb/Member/{loyId}/Invoices/{storeCode}/{trxNumber}/Requeue` takes no
body and answers `{ result: "Queued" | "AlreadyQueued", recipient, recipientSource }`. A refusal
comes back in the existing command refusal envelope, with the server's message.

## What to build

- **The tab.** A new **Invoices** tab on the member screen, beside Sales. It uses the same shell as
  the other tabs: lazy mount, `staleTime: Infinity`, an inline `ErrorBanner` with Retry scoped to
  the tab, and an empty-state sentence of its own ("no receipts in the last 90 days").
- **The grid** has one row per receipt:
  - store, receipt, date;
  - a **status** with its human reason, e.g. "Skipped: no email on the profile" or "Not emailed:
    insurance and credit invoices are never emailed";
  - last attempt;
  - **will go to** (the address, and "the online order's email" when `recipientSource = Order`);
  - a **Resend** row action.
- **Resend** is shown only for `resendable` rows, and only when the access probe says the session
  holds the **edit** grant. A look-only session sees the statuses and no action.
- **The command** uses the `MemberCommandDialog` ceremony. The dialog names the receipt and the
  address it will go to, and needs **no case reference** (owner ruling).
  - In-flight disable is the only double-submit guard.
  - On `Queued`, confirm "queued — it will be emailed within a few minutes".
  - On `AlreadyQueued`, say it is already waiting.
  - A refusal goes through `commandRefusalText`.
  - Success invalidates the Invoices and Actions tabs from inside the mutation.
- The **Sales tab is not changed.**

## Proof (→ vitest)

- [x] `invoice-columns.test.ts`: one column set, a status text for every status and skip reason, and
  the address source wording.
- [x] `invoice-resend.test.ts`: the resend verdict, which is `resendable && canEdit`; QUEUED and
  NOT_QUEUED rows offer no action.
- [x] `invoices-request.test.ts`: the read and the command hit the contract's routes, and the
  mutation invalidates both tab keys.
- [x] A stubbed drive of the tab: list, Resend, Queued, then refreshed.

## Boundaries

No flag. The only server changes this depends on are BackOffice 2445 and 2446.

## Done when

The vitest suite is green, the stubbed drive passes, and the live walk is done once 2445 and 2446
are merged. That walk can be folded into BackOffice 2447.

## Blocked by

None — build against the stubs. **Live:** BackOffice 2445 and 2446.

## Comments

**2026-10-07 — built (stubbed; live walk outstanding).**
- The Invoices tab sits between Sales and Actions. It reads `LoyWeb/Reports/Invoices/{loyId}` and
  offers **Resend** only to the edit grant, and only on a row the server marks `resendable`.
- Resend opens the member-command confirmation (no case reference). It names the receipt and the
  address, and says when the address is the online order's.
- The success toast names the address the **server** answered with. `AlreadyQueued` is an info
  toast, not "queued".
- Proof: the three vitest files are green (suite 3,912/3,912). `tools/loy-invoices-drive.mjs` is
  29/29, with every envelope **stubbed** because there is no live SIS.Api. The other Loy drives
  also pass: member 184/184, admin 170/170, jump 27/27. Lint and build are green.
- `loy-member-admin-drive` was hanging. Its refusal envelopes still used the guessed `LOY-001xx`
  codes that 1e2bbbf replaced, so the stale-member wait never resolved, and a throw left the
  browser open. It now sends the shipped codes, expects the Invoices tab and exits on a throw.

**Review triage.** Fixed:
- Invoices went stale after a profile fix. `invoicesKey` now sits under `MEMBER_SCOPE_KEY`, so
  every member command re-reads it.
- The toast used the row's address, which can be stale. It now uses the server's answer.
- A business refusal re-reads Invoices, so a stale row stops offering Resend. An outage re-reads
  nothing.
- `mayEdit` was carried in the grid `context`, which AG Grid reads once. It now gates the column.
- `getRowId` includes `documentType`.
- The status list derives from the model, and a not-resendable row says why.

Noted, not changed (owner sign-off):
- The client hides Resend on Queued / NotQueued rows even when they are flagged `resendable`.
- An unknown skip code reads bare in the status text, because `fsi` is banned in grid values.
- A 403 disarms only the dialog, as the other member commands do.

**Live walk:** still owed once BackOffice 2445 and 2446 are merged; it can fold into BackOffice
2447.
