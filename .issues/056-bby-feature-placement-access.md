---
type: wayfinder-ticket
wayfinder: grilling
map: 053
status: done
blocked-by: —
---

# 056 — Feature placement, nav & access gate

## Question

Decide where the screen lives and how it's gated, per the feature-structure rule:

- **Area / URL**: new `features/pricing/` area behind `/pricing/*` (BBY is Pricing, alongside the
  sim/cache-access work), or fold under an existing area? A new nav group ⇒ new area folder + menu
  group. Name the feature folder + i18n namespace (`bby-inquiry`?).
- **Menu**: one item in `layout/menu-model.ts` — label, group, icon.
- **Access**: the WPF gates on `Permissions.Check("BbyInquiry", Display)`. Does the react screen
  need an `accessProbe` (like the NC compose gate, ticket 038) or a permission code? If so, is there
  a backend probe today, or is it a flagged dependency? Ungated read is the alternative.

Reference: `.claude/rules/feature-structure.md`, `layout/menu-model.ts`, `BbyInquiryController.cs`
(permission check), and the NC access-gate pattern (map 023 / ticket 038).

## Answer

Decided in a HITL grilling session (2026-07-20), grounded in the live codebase.

**Area / URL — fold into the existing Pricing area (no new area).** `features/pricing/` already
exists behind `/pricing/*` with a "Pricing" menu group and three siblings (`simulation`,
`bonus-buy-download`, `coupons`). BBY Inquiry is Pricing and joins them. The feature-structure rule's
"new area only when a new nav group / URL prefix does" is not triggered — no new area folder, no new
menu group.

**Feature folder + i18n namespace — `bonus-buy-inquiry`.** Spelled-out, matching the adjacent
sibling `bonus-buy-download` (the react convention favours the readable name over the SAP `Bby*`
token, even though the WPF ControllerID / screen-grant key is `BbyInquiry`).
- Folder: `src/features/pricing/bonus-buy-inquiry/` — `BonusBuyInquiryPage.tsx` (default export) +
  `api.ts`.
- i18n namespace `bonus-buy-inquiry` — `src/locales/en/bonus-buy-inquiry.json`, registered in
  `src/core/i18n.ts` (import, `ns[]`, `resources`). Namespace == feature name (i18n-zero-literal).
- URL: `/pricing/bonus-buy-inquiry`; one lazy route in `src/app/router.tsx` under the Pricing prefix.

**Menu — one leaf in the Pricing group.** Label "BBY Inquiry" (`bonus-buy-inquiry:menu.bbyInquiry`),
lucide `Search` icon (signals a searchable lookup), `activePrefix: '/pricing/bonus-buy-inquiry'`.

**Access — gated, mirroring the sibling `bonus-buy-download`.** The WPF `BbyInquiryController.Show()`
calls `Permissions.Check("BbyInquiry", Permissions.Activity.Display)` — a `BackOfficeScreen` grant
keyed on ControllerID `"BbyInquiry"` (verified in
`Sartawi.Retail/Pricing/BbyInquiry/BbyInquiryController.cs:27`). The react screen keeps that gate:

- `api.ts` exposes `access(): Promise<{ screenAllowed: boolean }>` calling a `…Web/Access` probe
  (endpoint name pinned by the list-contract ticket 057).
- One shared `accessProbe` drives BOTH the shell nav-hide (issue 429) and the in-page route-guard
  denied-card, keyed `['bonus-buy-inquiry','access']`, `visible: (r) => r.screenAllowed === true`
  — one network call, fail-closed (pending/error ⇒ hidden). The server grant stays authoritative on
  any read the screen performs; the nav hide is show/hide hygiene only.

```ts
access: accessProbe({
  key: ['bonus-buy-inquiry', 'access'],
  run: () => bonusBuyInquiryApi.access(),
  visible: (r) => r.screenAllowed === true,
})
```

**Backend dependency (flagged).** No SIS.Api BBY read endpoint exists today, so the `Web/Access`
probe is a *designed contract not yet built* — same posture as the NC compose gate (ticket 038). Its
shape (path, `screenAllowed` field, and the graceful behaviour when the endpoint 404s pre-build) is a
**third backend contract** to be pinned alongside the list-search (057) and detail (058) contracts —
see the map's Not-yet-specified note.

**Registration checklist for the build ticket** (feature-structure rule, 4 touch-points):
1. `src/features/pricing/bonus-buy-inquiry/` — folder + `BonusBuyInquiryPage.tsx` + `api.ts`.
2. `src/locales/en/bonus-buy-inquiry.json` + register in `src/core/i18n.ts`.
3. `src/app/router.tsx` — lazy route `/pricing/bonus-buy-inquiry`.
4. `src/layout/menu-model.ts` — Pricing-group leaf with the `accessProbe` above.
