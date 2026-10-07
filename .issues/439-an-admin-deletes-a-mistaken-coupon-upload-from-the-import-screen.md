---
status: open
spec: C:\Work\DMSCO\BackOffice\.issues\2463-an-operator-deletes-a-coupon-import-uploaded-by-mistake-spec.md
blocked-by: BackOffice 2465, 2466 (live endpoints; build against the contract below with stubs meanwhile)
---

# 439 — An admin deletes a mistaken coupon upload from the Import screen, and the detail pane shows the earlier upload

Moved here from BackOffice ticket 2467 (owner, 2026-10-07). The spec, the decisions and ADR 0070
live in BackOffice: `C:\Work\DMSCO\BackOffice\.issues\2463-*-spec.md` and
`C:\Work\DMSCO\BackOffice\docs\adr\0070-a-coupon-redemption-log-outlives-its-coupon.md`.

**What a delete does.** It hard-deletes the coupons the upload added to its own template, redeemed
ones included. The codes in the file that belong to other templates are never touched. The
redemption history is kept, the job stays in the grid marked **Deleted**, and the action is audited.

## What to build

Work in `src/features/pricing/coupons` and `src/core/models/coupons.ts`.

**Model**
- `ImportJobStatus` gains `'Deleted'`.
- `ImportJob` gains `deletedAt: string | null` and `deletedBy: string | null`.
- `isTerminalJob` treats Deleted as terminal, so polling stops.

**Jobs grid on the Import screen**
- A **Delete** action on Completed and Failed rows.
- **Deleted** rows get a new status pill, are greyed out, and show deleted-by and deleted-at. They
  have no Retry and no Delete.

**Delete dialog**
- It loads the preview and states it in plain language. For example: "Deletes 2,904 coupons (3
  already redeemed; their redemption history is kept). 12,096 codes in this file belong to other
  templates and are not touched."
- When `canDelete` is false, it shows `refusalMessage` and disables Confirm.
- A reason is required.
- On success it refreshes the jobs grid. A refusal shows the server's message through the existing
  `notify.apiError` path.

**Coupon detail pane** (`CouponDetailPane`)
- Under the current redemptions, one section per `earlierUploads` entry: **"Earlier upload, deleted
  &lt;date&gt; by &lt;who&gt;: &lt;reason&gt;"**, listing its transactions.
- When `isDeleted` is true, the pane shows only those sections. There is no instance or template
  card in that case.

All new strings are in English and Arabic.

## Wire contract (fixed by BackOffice 2465/2466; build against it, do not change it here)

JSON is camelCase. `BASE = 'CouponsAdminWeb'`.

```ts
// ImportJob: status may be 'Deleted'; new fields
deletedAt: string | null
deletedBy: string | null

// GET  CouponsAdminWeb/Jobs/{jobId}/DeletePreview          (404 unknown job)
interface ImportJobDeletePreview {
  jobId: string
  toDelete: number          // coupons the delete removes
  redeemed: number          // of which already redeemed
  redemptionCount: number   // sum of their redeem counts (taken off the template total)
  inOtherTemplates: number  // codes in the file held by other templates - untouched
  canDelete: boolean
  refusalCode: string | null
  refusalMessage: string | null
}

// POST CouponsAdminWeb/Jobs/{jobId}/Delete   body { reason: string }
// 200 -> { jobId, deleted: number, redeemed: number, redemptionCount: number }
// 404 unknown job; 409 not finished / already deleted / another upload active; 400 blank reason
// (the existing coupon error envelope)

// GET  CouponsAdminWeb/Coupons/{couponCode}   (existing; two fields added)
interface CouponDetails {
  instance: CouponInstance | null       // null when isDeleted
  template: CouponTemplate | null       // null when isDeleted
  transactions: CouponTransaction[]     // the CURRENT coupon's only
  isDeleted: boolean
  earlierUploads: EarlierUpload[]       // always present, oldest first, may be empty
}
interface EarlierUpload {
  deletedAt: string
  deletedBy: string
  reason: string
  templateId: string
  redeemCount: number
  transactions: CouponTransaction[]
}
```

## Spine reach

UI → app (the BackOffice 2465/2466 endpoints)

## Proof (→ `tdd` red-green cycles)

Vitest, next to `helpers.test.ts`.

- [ ] `jobActions`: Completed and Failed rows offer Delete, only Failed offers Retry, and Deleted,
      Pending and Processing offer neither. `isTerminalJob('Deleted')` is true.
- [ ] `describeDeletePreview`: the counts turn into the sentence, including the zero-redeemed and
      zero-other-template variants.
- [ ] `couponHistorySections`: a deleted-shape response gives only the earlier-upload sections; a
      re-uploaded code gives the current section first, then the earlier ones.
- [ ] `tsc`, `npm run lint` (feature boundaries) and the existing coupon tests stay green.
- [ ] **OWNER: the walk on staging.** After BackOffice 009 and SIS.Api 1.0.7 are deployed, delete
      job `06GHFEGGVDNRTFR8Q6VBGMGNA7` on template `OMS000000619`:
      - 2,904 coupons are deleted, and `OMS000000618`'s 12,096 stay;
      - the job reads Deleted;
      - re-uploading the same file to 619 adds 2,904 again;
      - looking up a deleted, redeemed code shows its earlier upload.

## Boundaries

oms-react only. Deploy after the SIS.Api that carries BackOffice 2465 and 2466. No feature flag:
the action shows only on the `CouponsAdmin` screen. The BackOffice side is being built in parallel
(worktree `C:\Work\DMSCO\BackOffice-afk2463`). Until it lands, prove the screen against stubs of the
contract above.

## Done when

The helper tests are green and the build and lint pass. The owner walk closes it after deploy.

## Blocked by

BackOffice [2465](C:\Work\DMSCO\BackOffice\.issues\2465-a-coupons-admin-deletes-a-finished-upload-audited.md)
and [2466](C:\Work\DMSCO\BackOffice\.issues\2466-an-admin-previews-a-delete-and-support-sees-a-deleted-codes-history.md),
for the live endpoints only. The code can be built now against the contract.
