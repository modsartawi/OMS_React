---
status: done
spec: BO 2737 (brief C:\Work\DMSCO\BackOffice\.issues\assets\2737-oms-react-rule-engine-brief.md)
blocked-by: —
---

# 502 — A marketer creates a campaign from a name and features, or copies one

## What to build

**+ New campaign** on the list opens the **Create campaign** dialog: a name in **EN + AR** (both
required), and the optional **features** (coupons, points), each with a line saying what it switches on.
Create saves a new draft and lands on its dashboard. The features decide which workspace menu items
(Coupons) and, later, which palette items show. The dashboard's **⋯** menu gets **Copy campaign**:
it creates an independent draft named "<name> (copy)" and opens it.

## Spine reach

model/api (`create`, `copy`) · logic (features → menu items) · component (dialog, menu) · i18n · test

## Proof (→ `tdd` red-green cycles)

- [x] `workspaceMenu_showsCouponsOnlyWithTheCouponsFeature` · pure
- [x] `createForm_requiresBothNames` · pure
- [x] drive: create → the new draft's dashboard; copy → a second draft, original untouched (stubbed) · flow

## Boundaries

Provisional `create` / `copy` endpoints (BackOffice 2758 drafts, 2759 copy), stubbed.

## Done when

The drive creates and copies a campaign against stubs, and the gates are green.

## Blocked by

[501](501-a-marketer-sees-the-campaigns-list-by-state-and-opens-a-campaigns-dashboard.md)

## Comments

**Done 2026-10-16 (AFK).** The brief still has no contract section, so this is built on PROVISIONAL shapes. Ticket 520 re-points the same two files as 501: `RuleCampaignCreate` in `src/core/models/rule-campaign.ts`, and `POST RuleCampaign/Campaigns` plus `POST RuleCampaign/Campaigns/{id}/Copy` in `src/core/rules/api.ts`.

- **Create** (`features/campaigns/list`): **New campaign** on the list opens **Create campaign**. It has an English and an Arabic name (both required, the Arabic input `dir="rtl"`) and two optional features, each with a line saying what it switches on. Coupons starts off and Loyalty points on, as in the prototype. A missing name is reported at its field once Create has been tried, and nothing is sent. Enter submits. HQ mints the code and the id. A success seeds the draft's query, refreshes the list, toasts, and lands on the new draft's dashboard. A refusal is shown in the dialog, verbatim, through `apiErrorMessage`, with the form kept; editing the form clears it. Logic is in the pure `create-form.ts`.
- **Copy** (`features/campaigns/workspace`): the dashboard's State cell has a **⋯** menu with **Copy campaign**. HQ makes the independent draft named "<name> (copy)", and it opens on its own dashboard. The original is untouched. Navigation rides on the per-call `onSuccess`, so a user who moved on while a create or copy was pending is not pulled to the draft. `rememberNewDraft` (in `core/rules/api.ts`) is shared by both.
- **Features → menu:** the pure `workspace/menu.ts` has `workspaceMenu(features)`, which offers Coupons only when the coupons feature is on, and `drawnMenu`, which draws only items whose page has landed. Coupons is `landed: false` until 515, so for now the gating is proven by the pure test, not on screen.
- **Proof:** `menu.test.ts` (3 tests, including the named one) and `create-form.test.ts` (4, including the named one). The drive `tools/campaigns-drive.mjs` has a 502 section (checks 10–15: create, required names, Cancel, refusal, copy, original untouched, list counts), served by the new stubbed HQ `createDraft` / `copyOf` in `tools/campaigns-fixtures.mjs`; each browser context now has its own copy of the fixtures. It passes **80/80** on port 5199 (it was 47/47). The gates were green: typecheck, `npm test` (306 files, 5274 tests), lint (all four gates), and build.
- **501's drive fix:** a 501 step typed into the search before the All tile's render had committed, so the stale tile was written back into the URL. It failed reliably here. The drive now waits for the tile to be pressed. The underlying race (a keystroke inside the same navigation transition) is in 501's list page and is noted in the HITL doc.
- **Reviews:** `/code-review` and `/standards-review` were both run. Fixed: navigation after unmount; a stale refusal after an edit; Enter submits through a real submit button; menu arrow-wrap from outside the items; the form is cleared on the way out; the stub's copy code keeps its `-COPY`; the shell's landed-filter is now tested (`drawnMenu`); the shared draft-cache helper; the en bundle no longer holds an Arabic placeholder. Left as is: `ActionsPopover` is a third copy of the MyViews/UserMenu popover. Graduating a shared core menu is out of this slice.
- **Decisions** are logged in `.afk/HITL-502.md`.
- **Outstanding (not AFK's):** a live-door check (ticket 520); an eyeball of the Arabic rendering of the EN + AR pairs; and the owner sign-off on the defaults logged in the HITL doc.
