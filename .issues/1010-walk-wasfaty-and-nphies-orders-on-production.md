---
status: open
spec: 1006
blocked-by: 1009
---

# 1010: Walk Wasfaty and Nphies orders on production

**HITL.** On the local walk (SIS.Api `ProdWalk`, hosted services off, the vite console), as for spec 160. The
owner places the test orders and cancels them.

## Walk

1. A phone order with a fired 1+1 and a coupon, switched to **Wasfaty**:
   - the notice names both;
   - the price rises by the discount;
   - payment is locked;
   - there is no fee.
2. Back to **phone order**: the offer fires again, the coupon stays off, and the fee is back.
3. **Wasfaty delivery** with a patient ID and reference, and no items: submit. The OMS row has `WSFD`,
   `CallCenterWasfaty`, `PatientId`, `CustomerNationalId`, `ApprovalNumber`, the regular store and no fee.
4. **Nphies delivery** to a district whose `InsuranceStoreCode` differs from its `StoreCode`, with one item:
   - the store moves to the insurance store;
   - submit;
   - the OMS row has `NPHS` and the fields.
5. The same patient ID and reference again: the duplicate modal names order 3 or 4. Confirm, and it mints.
6. Pick-in-store on Nphies: the agent's store is kept.
7. Read the minted orders back in OMS (read-only SQL). The owner cancels them.

## Proof

- [ ] Every step above, with the document numbers, recorded here.
- [ ] Any finding filed as its own ticket.
