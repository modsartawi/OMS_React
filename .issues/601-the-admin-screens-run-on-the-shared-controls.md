---
status: done
spec: 590
blocked-by: 597
---

# 601 — The admin screens run on the shared controls

From spec [590](590-the-back-office-wears-the-dmsco-theme-spec.md) (map 580).

## What to build

**Migrate** the `admin` screens onto the shared controls (spec 590 §Shared controls). This is a
pure restyle: nothing about behaviour, arrangement, copy or density changes.

- **Fields** (text, number, date, search, select, textarea) move onto `Input` / `Select` /
  `Textarea`. A label, hint or error beside a field becomes `Field`. Any local `INPUT`-style
  constant in the area is replaced by the shared control, and the constant is deleted once the
  area no longer uses it.
- **Buttons:**
  - Icon-only buttons become `IconButton`.
  - Chips, toggles and tab bars become `Chip`.
  - Outlined look-alikes and buttons that carry a variant's colours become `Button`.
  - Text-style buttons that navigate take the link look.
- **Restyled in place:** one-offs, row or tile pickers, grid-cell actions and non-navigating text
  buttons are rewritten to tokens and the new radius, and listed in the ratchet's allowlist with a
  one-line reason.
- **Checkboxes and radios** stay native with `accent-color: var(--primary)`.
- **Untouched:** anything under `__prototype__`, and the printed facsimiles' ink.

Heaviest first: Sync console (48), Authz admin (22), UA admin (16).

583's inventory (`assets/583-control-inventory/`) lists every occurrence by file and bucket. Re-run
its script before and after, and paste both counts in the ticket.

## Spine reach

component/route (admin) · test

## Proof (→ `tdd` red-green cycles)

- [x] `dmsco-theme-drive` gains the heaviest admin screen(s): light, dark and RTL screenshots; every field labelled, every icon button named, role tokens resolved · flow (Playwright)
- [x] the area's existing drives stay green unchanged (colour checks are by role after 593) · flow (Playwright)
- [x] the lint ratchet shows `admin` at its allowlist (documented one-offs and pickers only) · lint gate

React Testing Library is still not installed (spec 083), so shared controls are proven through the
drive; verify via typecheck + drive.

## Boundaries

- **No new i18n keys,** except an accessible name an icon button was missing (add it in the
  feature's own namespace).
- **All rules stand:** logical Tailwind, bidi isolation, zero literals.
- **A restyle only.** If a screen seems to need a behaviour change, stop and write it under
  Open questions.
- **Runs AFK** (`/afk-loop`) once 597's pattern note exists.

## Done when

Every admin feature is at its allowlist, its drives are green, and the theme drive covers its heaviest screen.

## Blocked by

[597](597-the-campaign-workspace-runs-on-the-shared-controls.md)


## Comments

**2026-10-26 — built (branch `impl/590-601`).**

**Counts.**

| feature | ratchet before | ratchet after (= allowlist) | 583 inventory before | 583 after |
|---|---:|---:|---:|---:|
| admin/sync-console | 44 | 7 | 48 | 11 |
| admin/authz-admin | 22 | 6 | 22 | 6 |
| admin/data-sync | 13 | 1 | 21 | 9 |
| admin/ua-admin | 15 | 2 | 16 | 3 |
| admin/active-sessions | 7 | 1 | 7 | 1 |
| admin/broadcast | 6 | 0 | 6 | 0 |
| admin/engine-switch | 4 | 0 | 4 | 0 |
| **admin** | **111** | **17** | **124** | **30** |

The 583 "after" column is the allowlist plus the native checkboxes/radios/file inputs spec 590 keeps
(4 in sync-console, 8 in data-sync, 1 file input in ua-admin). Local constants deleted: `INPUT`
(AuditPage, CommandsPage, NewStorePage, RecentPassesPage), `SELECT` (TransactionsTab, MirrorTab,
ReplayPage), `FIELD`/`LABEL` (ua-admin NewIdentityModal, UserDetailPane), the `select` string
(data-sync ChangesPage), the pager's `btn` (data-sync Pager); engine-switch no longer imports core
`RULE_INPUT`.

**Where the buckets went.** Fields → `Input`/`Select`/`Textarea`; label-above blocks → `Field`
(authz Edit/New role, ua New identity, broadcast expiry, engine-switch filters + flip reason,
data-sync create/apply/control dialogs, sync-console Audit/Commands/RecentPasses filters, TextField,
NewStorePage, RePush/Reason dialogs, Replay). Hand-built search boxes → `Input type="search"` (authz
users/roles/bind-grant, active sessions, engine switch, fleet). Icon-only → `IconButton` (authz
remove member / revoke holder / remove role as `danger compact`; engine-switch history close,
data-sync job drawer close, sync-console snapshot close, CommandRun/ControlResults dismiss). Tabs →
`Chip variant="tab"` inside the existing tablists (authz workspace + role/person tabs, ua person
tabs, broadcast channel, sync-console store tabs); `aria-pressed` filters → `Chip` (active-sessions
channel/Idle). Variant look-alikes → `Button` (primary search/new/send, outlined export/bulk/
refresh/pager/close, danger-outlined revoke-all).

**Allowlist (17).** Tile pickers (authz worklist cards ×2, DeleteBlocked tiles, ua report cards,
fleet state tiles, pass-kind tiles), row pickers (authz role rows, holder rows, sync-console
agreement day rows), grid-cell actions (active-sessions Revoke, data-sync job store cell,
sync-console View JSON / Show error / pass start ×2), and two non-navigating danger-ink text
buttons (authz Unbind, ua session Revoke). All restyled to tokens (`border-border/60` → `border-border`).

**Label-beside layouts kept (597 Q1):** ua-admin UserDetailPane's `dl` (mobile/email/channel — the
`dt` is not a `<label>`, so these fields stay unnamed except the channel's `aria-label`, as before),
sync-console TransactionsTab, MirrorTab, PassesTab.

**Proof.**
- Theme drive, block "601", screens `admin-sync` (Fleet toolbar + Audit filters), `admin-authz`
  (users workspace, person tabs + remove IconButtons, roles workspace + composite detail, New role
  dialog) and `admin-ua-users` (search, toolbar Buttons, New identity dialog), light/dark/RTL:
  232/232 (admin-sync/light timed out once on first compile, green on the one retry). Red first,
  on the integration tip `67fe1c5f` with the block's hooks swapped for structural selectors: 2/24 —
  36px fields with no `--card` ground and radius 0, unlabelled search boxes, no pill buttons, no
  tab chips.
- Area drives: data-sync apply 67/67, campaign 60/60, campaigns 55/55, changes 50/50, controls
  50/50, create 36/36, handback 32/32; engine-switch 56/56; ua-bulk-create 10/10, ua-channel 17/17;
  sync-console controls 113/113, onboard 83/83, replay 128/128, commands 68/69 (a 30-reads timing
  check, load; 69/69 on the tip), fleet 87/88, store crash at section 21.
  **Pre-existing, same on the tip:** fleet's Admin-menu-order check; store's crash at the Replay
  hand-off (`[data-replay-json]`); ua-users-scale 83/85 — "it is labelled Activation done" and
  "the grid is titled with its label" pin copy that cf25f8e7 renamed to "Authenticator active".
- `npm run typecheck` clean; `npm run lint` 5 gates clean ("none above the baseline"); `npm test`
  424 files / 6728 tests.

**`/admin/sync` crash in foundation-drive (from 593): pre-existing, not caused by this sweep.**
Reproduced on the integration tip `67fe1c5f` with foundation's leaf-walk stubs (every unknown door
→ `[]`): `ActionSync/Fleet/Summary` answers `[]`, so `summary.data?.counts[tile]`
(`FleetPage.tsx`, tile row) reads a tile of `undefined` → React Router's error boundary
("Cannot read properties of undefined (reading 'all')"). Same shape as 597's `/campaigns/priority`
finding. The fix belongs to foundation's `SCREEN_DATA` (a shaped `ActionSync/Fleet/Summary`) or to a
page guard; neither is a theme change, so neither is made here.

**Snags / visible changes.**
- Search boxes that held their button INSIDE the pill (authz users/roles, ua, active sessions) now
  have the shared search Input with the Button beside it.
- Underline tab bars are now chip rows (594 mapping); the `border-b` under them is kept with `pb-2`.
- Placeholder-only search fields got an `aria-label` from their existing placeholder key (no new
  keys) so they are named.
- Fields that showed an error line now go `aria-invalid` with it (authz New role name, data-sync
  apply reason, engine-switch flip reason) — the danger edge appears with the words.
- New `data-*` hooks for the drive: `data-authz-workspace`, `data-authz-users-search`,
  `data-authz-users-run`, `data-authz-user-tab`, `data-authz-roles-search`, `data-authz-new-role`,
  `data-ua-search`.

**Open questions.**
- ua-admin UserDetailPane's mobile/email inputs have no programmatic label (a `dt` beside them).
  Pre-existing; keeping the label-beside layout (597 Q1) leaves them so. Link them (`<label htmlFor>`
  in the `dt`)?
