# HITL — ticket 474 (Replay… in the receipt drawer)

## Q: Should the in-memory draft also empty when the session ends (sign-out, 401, another user)?
**Decision taken:** Yes — `replay-draft.ts` subscribes to `useSession` and clears the draft when `userId` changes; a same-user session refresh keeps it.
**Why:** a sign-out is no reload, so without this the next user on the same tab would see the previous tester's snapshot (customer/loyalty/tender data).
**Revisit if:** the owner wants the draft to survive a sign-out (or a 401) followed by the same tester signing back in — today that empties it.

## Q: Should the page say which receipt the drawer brought?
**Decision taken:** A muted line under the box, "Brought from receipt <receipt> of store <store>.", shown only while the box's JSON still reads as that receipt (`shownSource`); each value in `Ltr` via a `<Trans>` slot.
**Why:** the ticket stores the source with the draft; naming it once it no longer matches the box would mislead.
**Revisit if:** the design review wants the source dropped or shown elsewhere (no prototype covers the page).

## Q: Replay… while the snapshot is still loading?
**Decision taken:** Rendered (for a holder of both grants) but disabled until the snapshot read succeeds; absent entirely without `canReplay`/`canOperate`.
**Why:** "absent, not disabled" governs the grant; a disabled button during a load is the drawer's own state, like Copy JSON.
**Revisit if:** the owner reads the ruling as "never disabled".

## Resume note
The first 474 session was killed at its end (vite stop matched its own process). This session re-ran every gate on the working tree: typecheck clean, vitest 269 files / 4788 tests, lint 4/4, build green; drives on :5199 — store 336/336, replay 110/110, controls 110/110.
