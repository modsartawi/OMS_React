---
status: done
spec: BO 3953 (C:\Work\DMSCO\BackOffice\.issues\3953-every-web-oms-document-shows-its-whole-family-spec.md)
blocked-by: 906, BO 3956
---

# 907 — Billings fold, a cut-short family warns, and a failed load stays quiet

## What to build

BackOffice spec [3953](C:\Work\DMSCO\BackOffice\.issues\3953-every-web-oms-document-shows-its-whole-family-spec.md) ("Family panel"), the rest of the prototype's rulings:

- **Billings** are grey, not a link, with the tooltip "Billings have no page" and the till invoice as a
  dashed label. Under one parent with **more than two** billings, only the first shows, followed by a
  "+ N more billings" button that expands them in place. The folding is part of the model.
- **A truncated family** shows a warning line under the tree: "Family cut short at 100 members — not
  every document is shown."
- **The root's partner reference** shows as a small label (source and order number).
- **A failed call** shows one quiet line in the section, and the rest of the page is unaffected.
- **Phone width and RTL:** the meta line is cut short before the chip, and the badge, number and chip
  never wrap away.

## Spine reach

tree model → UI.

## Proof (→ `tdd` red-green cycles)

- [x] `family-tree` model: billings fold at more than two, with the N count; two billings both show;
  truncated is passed through · vitest
- [x] i18n keys for the new strings in EN and AR · vitest
- [x] By eye, against the prototype: RTL, phone width, dark mode, a truncated answer, and a failed call
  — **against a stubbed drive only** (see Comments); the live look waits on BackOffice 3956

## Boundaries

oms-react only. The partner label and the truncated flag need BackOffice 3956 deployed.

## Done when

The model tests are green and the by-eye checks match the prototype.

## Blocked by

[906](906-an-order-page-shows-its-family-and-every-delivery-opens-in-one-click.md), BackOffice
[3956](C:/Work/DMSCO/BackOffice/.issues/3956-a-family-past-the-cap-answers-truncated-and-a-bad-request-is-refused.md)

## Comments

**2026-11-16 — client half built, stubbed; live walk owed on BackOffice 3956.** "Done" here is the client
half only, as prior waves mark it: BO 3956 (the `truncated` flag, the partner reference) and BO 3954 (the
Family endpoint) are not deployed, so this is built against spec 3953's fixed wire shape and has never
met a real answer.

- **Model** (`family-tree.ts`): each `FamilyTreeNode` now carries `shown` (the children drawn while
  folded) and `folded` (the billings past the first, when a parent has **more than two**); `children`
  stays every child in the answer's order, and `count` still counts every member. A non-billing sibling
  is never folded and keeps its place. `FamilyTreeView.truncated` passes the answer's flag through
  (`=== true`). `FAMILY_MEMBER_CAP = 100` is the warning's number. Proved in `family-tree.test.ts`
  (six fold to one + 5, two both show, three with a return order between, no billings, truncated on/off/absent).
- **i18n:** `family.{title, noPage.billing, noPage.memo, tillInvoice, tillInvoiceTitle, partnerReference,
  moreBillings, truncated, failed, failedWithReason}` in en and ar, proved by `family-i18n-keys.test.ts`.
- **UI** (`FamilyPanel.tsx`): "+ N more billings" is a core `Button` (ghost) expanding that parent's
  billings in place (state per parent key in the panel); a billing row (no page) takes the tooltip
  "Billings have no page" (C/V: "Memos have no page") and its till invoice as a dashed label (`Ltr`);
  the root's partner reference is a dashed label, `formatPair(source, orderNo || sourceReference)` in
  one `Ltr`; the cut-short warning (attention tint, `role="note"`) sits under the tree with the cap in
  `Ltr`; a failed read draws one quiet line, `apiErrorMessage` as the reason in a `<bdi>`, instead of
  the section. The labels shrink only after the meta line (meta is `flex-1` basis 0), so the badge,
  number and chip never wrap away.
- **Drive** (`tools/document-family-drive.mjs`): 68/68. Adds the prototype's big family (3 deliveries,
  6 billings on the middle one, `truncated: true`) in LTR light 1440px, RTL dark 375px and LTR dark
  375px: title (12), fold to one + "+ 5 more billings", expand in place, the warning under the tree,
  every row one line with badge/number/chip whole and no sideways scroll, the meta line the one cut
  short, inline-start indentation; on the Bupa family the billing tooltip, the till label and the
  partner label (root only), and the failed read's quiet line in LTR and RTL.
- **By eye vs the prototype (3943)** from the drive's shots: the labels, fold button, warning tint and
  accent bar match; at 375px the meta line gives way first. The app's `lng` stays `en`, so under RTL
  the English words of the fold button and the warning read mirrored ("more billings 5 +") — a drive
  artefact; the Arabic strings carry their own order.
- **Note:** a 500 reaches the line as `core/api`'s generic "unexpected error" wording, not the
  server's message — the envelope's design, not this ticket's.
- `npm run lint`'s boundary gate still fails only on the pre-existing
  `src/features/insurance-rules/aliases/door-shapes.test.ts`; the other four gates pass.
