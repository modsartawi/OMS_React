---
type: wayfinder-ticket
wayfinder: prototype
map: 023
status: done
blocked-by: 026, 027
---

# 029 — Bell / panel / compose UX prototype

## Question

Graduated from the map's fog once receive scope (026) and the channel model (027) locked. The POS
used a modal DevExpress grid; the web idiom is different. Build a cheap, throwaway `/prototype` to
react to and settle the shape of both halves for the spec. Ground every choice in the locked
decisions — do **not** re-open scope here.

**Receive (per 026 — "broadcasts-and-jobs" v1, read-only announcements):**

- **Bell + unread badge** in the top bar (`layout/` chrome, cross-cutting). Badge count =
  `Status==Active` ∧ `ExpiresAt > now` ∧ `!IsRead`, computed client-side. Hidden when NC disabled
  (poll 404 ⇒ feature off, not an error). Where does it sit relative to the account menu / POS chip?
- **Panel/list** — dropdown panel vs. a full page? Newest-on-top (`CreatedAt` desc). Row = Title +
  Body + relative time; unread = visual emphasis, read = muted (binary, **no** traffic-light). No
  SLA column, no claim affordance, no deep-link (nothing routable in v1).
- **Read interactions** — read-on-click (per-id `Read`) + an explicit "Mark all as read" (per-id
  loop). Opening the panel does **not** auto-clear. Thin optimistic overlay; `IsRead` authoritative.
- **Arrivals** — `sonner` for both styles: `Toast` auto-dismiss (~8s), `Banner` (broadcast)
  persistent + dismiss action; 15-min `CreatedAt` freshness gate; no sound. How does an arrival
  relate to the bell (badge bump + toast together)?

**Send (per 027 — two channels, one grant):**

- **Compose screen** (`features/admin/…`) — Title (≤200) + Body (≤1000) required, optional future
  `ExpiresAt` (blank ⇒ 30-day default). Channel picker: **All** (`AudienceKind=All`) vs **Store**
  (`AudienceKind=Store` + one storecode via the existing open-stores picker). Every send is
  `TypeCode=Broadcast`. Soft-gate the whole screen on the `NotificationBroadcast[01]` probe (028's
  `GET Notifications/Access`); server `Create` stays authoritative. What does a denied/ungranted
  user see (hidden nav vs. disabled form)? Confirmation before an All-fleet blast?

Output: a throwaway prototype (link it as an asset) + the settled UX decisions the spec will encode.
HITL. On resolution, the **Spec shape & lock** fog is the last item left before `/to-spec`.

## Answer

Throwaway click-through prototype built and reacted to — asset:
[029 UX prototype (self-contained HTML)](029-nc-bell-panel-compose-ux.PROTOTYPE.html) (also
published as an artifact for clicking). It mirrors the real oms-react shell tokens
(`src/app/global.css`) and top bar (`src/layout/AppShell.tsx`), with a control dock flipping each
open question. **User accepted all five recommendations**, and explicitly signed off the compose
screen at the prototype's fidelity ("do it as in the artifact"). Settled UX decisions the spec
encodes:

1. **List surface = dropdown panel** (not a full page). ~380px, anchored to the bell. v1 is
   read-only announcements with no filter/bulk/detail, so a page is over-built. Panel header =
   "Notifications" + "Mark all as read"; body = newest-on-top rows; empty state "You're all caught
   up." Opening the panel does **not** auto-clear (per 026).
2. **Bell placement = `POS chip → 🔔 bell → theme toggle → account`** — bell just left of the
   theme/account cluster, grouping the two status affordances. **Badge = terracotta** (`--ring`,
   the single app accent), unread integer, with a subtle pop on bump, hidden at zero. Bell hidden
   entirely when NC disabled (poll 404).
3. **Denied-compose = hidden nav + soft-gate backstop** (NOT a disabled form). Absent the
   `NotificationBroadcast[01]` grant, the "Send Broadcast" nav item is hidden (portal's
   permission-aware nav pattern); a direct route hit lands on a soft "You don't have access" gate
   naming the grant. Server `Create` stays authoritative (028's `GET Notifications/Access` drives
   the soft gate).
4. **All-fleet blast confirmation = confirm dialog for `AudienceKind=All` only.** Whole-fleet shows
   an inline amber warning while composing **and** a modal confirm on send ("reach every open store
   and back-office user… can't be recalled"). Single-store (`AudienceKind=Store`) sends go straight
   through.
5. **Arrival toast ↔ badge = lock-step + style split.** An arrival bumps the badge and pops a
   `sonner` notification simultaneously. `JOB_DONE` = auto-dismiss toast (~8s, progress bar);
   `BROADCAST` = persistent banner (gold rail, **View** opens the panel + **Dismiss**). 15-min
   `CreatedAt` freshness gate ⇒ only fresh items toast (no cold-start re-pop).

**Compose screen shape (locked "as in the artifact"):** card with **Title** (≤200, live counter) +
**Message** (≤1000, live counter) both required; **Send to** segmented control **Whole fleet**
(`AudienceKind=All`) vs **One store** (`AudienceKind=Store`, revealing the open-stores `<select>`);
optional **Expires** date (blank ⇒ 30-day default); pill **Send broadcast** disabled until valid,
with an inline validity hint. Every send is `TypeCode=Broadcast`. Success ⇒ a confirmation toast
("Broadcast sent — Delivered to <target>") and the form resets. Lives under `features/admin/…`.

**Note on build:** the user asked to "do it as in the artifact" — captured here as the build's
reference fidelity, not built in this planning session (the map's destination is a ready spec; the
compose screen is built via `/to-spec` → `/to-tickets` → `/implement`, implementing this prototype
faithfully). The prototype HTML is the primary-source reference for that build.
