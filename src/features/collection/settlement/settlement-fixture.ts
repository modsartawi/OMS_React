import type {
  SettlementAccount,
  SettlementConsumption,
  SettlementEntry,
} from '@/core/models/settlement'

/**
 * **The six hostile branches** — the read model ticket 269 is built against, and
 * the one the drive serves over the wire.
 *
 * They are transcribed from the prototype's `fake.js`
 * (`C:\Work\DMSCO\BackOffice\.scratch\proto\settlement-accountant-screen\`, branch
 * `proto/1147-accountant-screen`) into **this repo's wire types**. ⚠️ Read, not
 * pasted: that spike is another repo's throwaway, its rows are nested inside their
 * entry and its consumption carries `isReversal` / `consumedByName`, none of which
 * this contract has. What survives the crossing is the **cases**, which are the
 * only part that was ever the deliverable.
 *
 * 🚩 **Every Arabic string below is copied from `fake.js`, never retyped** — the
 * ruling `csv.test.ts` made for the ACR fixtures. A retyped Arabic string looks
 * right and is a different sequence of code points, which is how a diacritic or a
 * ـه/ـة swap gets into a screen nobody can proofread.
 *
 * Why these six and not a happy path (spec 267 §Further Notes — the fixture is
 * *deliberately hostile*, each case chosen because it broke a layout that looked
 * fine on the easy one):
 *
 * | branch | what it breaks |
 * |---|---|
 * | `0142` | holds an open **shortage and an open surplus at once**, and the surplus is partly consumed — so *"was my amount used?"* has a real answer |
 * | `0207` | a surplus **consumed to zero last night** — is the accountant reading last night's closes this morning? |
 * | `0331` | an **orphan consumption**: no document, and one that will never arrive (rule 1) |
 * | `0455` | a prepared-but-uncollected receipt with a **compensating void** — the restoration row (rule 2), directly under the receipt it voids |
 * | `0512` | **square**: zero open entries, history only. Every layout has to decide what it does with a branch that owes nothing |
 * | `0688` | a `CLOSED_OUT` beside a `CANCELLED` — the two correction states, and 🚩 the estate's **BHD** branch |
 *
 * 🔑 **0688 is Bahraini and that is load-bearing, not decoration.** Al-Muharraq is
 * in Muharraq, and BHD is the footprint's only 3-decimal currency (D10). It is the
 * branch that proves `95.250` renders as `95.250` rather than being silently
 * rounded to `95.25`, which is a misquoted figure to the branch manager reading it.
 * The other five are SAR and draw at two.
 *
 * ⚠️ **274 removed `currencyKey` from these accounts, because the door does not send
 * one** (`.afk/FINDINGS-274.md` §B6) — and that makes 0688 MORE important, not less.
 * Its three-decimal figures are now the live check on
 * `formatMoneyOfUnknownCurrency`: with no currency to read, the renderer must still
 * show `95.250` intact rather than falling back to two decimals and rounding a fils
 * away. The branch that proved D10 with a currency now proves it without one.
 */

const HUDA = { staffId: '30117', name: 'هدى القحطاني / Huda Al-Qahtani' }
const SAAD = { staffId: '30124', name: 'سعد الدوسري / Saad Al-Dosari' }

/** Terse constructors: the fixture is meant to be **read as cases**, and thirty
 *  lines of `documentId: ''` between two of them is how a case stops being visible. */
function entry(o: Partial<SettlementEntry> & Pick<SettlementEntry, 'settlementEntryId' | 'entryNumber' | 'storeId' | 'entryKind' | 'amount' | 'remainingAmount' | 'reason' | 'postedAt'>): SettlementEntry {
  return {
    status: 'OPEN',
    batchId: '',
    postedByStaffId: HUDA.staffId,
    postedByName: HUDA.name,
    closedByStaffId: '',
    closedAt: '',
    closedReason: '',
    ...o,
  }
}

function consumption(o: Partial<SettlementConsumption> & Pick<SettlementConsumption, 'settlementConsumptionId' | 'settlementEntryId' | 'storeId' | 'amount' | 'remainingAfter' | 'businessDay' | 'consumedByOperatorId' | 'consumedAt'>): SettlementConsumption {
  return {
    consumptionKind: 'CONSUME',
    documentType: 'SHIFT_CLOSE',
    documentId: '',
    documentNumber: '',
    ...o,
  }
}

/** 0142 — both kinds open at once, and the surplus partly consumed. */
const ACCOUNT_0142: SettlementAccount = {
  storeId: '0142',
  storeName: 'صيدلية الروضة / Al-Rawdah Pharmacy',
  entries: [
    entry({
      settlementEntryId: '01J9SETL0142A', entryNumber: 143, storeId: '0142',
      entryKind: 'SHORTAGE', amount: 500.0, remainingAmount: 500.0,
      reason: 'نقص في تسليم يوم 2026-05-04 — فرق الجرد الشهري',
      postedAt: '2026-08-09T11:14:00',
    }),
    entry({
      settlementEntryId: '01J9SETL0142B', entryNumber: 151, storeId: '0142',
      entryKind: 'SURPLUS', amount: 320.0, remainingAmount: 120.0,
      reason: 'مرتجع شبكة — نقدي صُرف من الدرج لاسترجاع فاتورة بطاقة',
      postedAt: '2026-08-11T09:02:00',
    }),
    entry({
      settlementEntryId: '01J9SETL0142C', entryNumber: 128, storeId: '0142',
      entryKind: 'SHORTAGE', amount: 75.5, remainingAmount: 75.5,
      reason: 'adjustment for last month',
      postedByStaffId: SAAD.staffId, postedByName: SAAD.name,
      postedAt: '2026-07-21T16:40:00',
    }),
  ],
  consumptions: [
    consumption({
      settlementConsumptionId: '01J9SCON0142B1', settlementEntryId: '01J9SETL0142B', storeId: '0142',
      amount: 200.0, remainingAfter: 120.0,
      documentId: 'Z40318', documentNumber: 'Z-40318', businessDay: '2026-08-12',
      consumedByOperatorId: '41207', consumedAt: '2026-08-12T22:41:00',
    }),
  ],
}

/** 0207 — a surplus consumed to zero **last night**, over two closes. */
const ACCOUNT_0207: SettlementAccount = {
  storeId: '0207',
  storeName: 'صيدلية الخالدية / Al-Khalidiyah Pharmacy',
  entries: [
    entry({
      settlementEntryId: '01J9SETL0207A', entryNumber: 149, storeId: '0207',
      entryKind: 'SURPLUS', amount: 260.0, remainingAmount: 0.0, status: 'CONSUMED',
      reason: 'مرتجع شبكة 2026-08-02',
      postedAt: '2026-08-10T10:31:00',
    }),
    entry({
      settlementEntryId: '01J9SETL0207B', entryNumber: 155, storeId: '0207',
      entryKind: 'SHORTAGE', amount: 1240.0, remainingAmount: 1240.0,
      reason: 'عجز مكتشف في مراجعة الربع الثاني — فروقات تسليم متفرقة',
      postedAt: '2026-08-12T14:55:00',
    }),
  ],
  consumptions: [
    consumption({
      settlementConsumptionId: '01J9SCON0207A1', settlementEntryId: '01J9SETL0207A', storeId: '0207',
      amount: 60.0, remainingAfter: 200.0,
      documentId: 'Z51120', documentNumber: 'Z-51120', businessDay: '2026-08-11',
      consumedByOperatorId: '41318', consumedAt: '2026-08-11T23:04:00',
    }),
    consumption({
      settlementConsumptionId: '01J9SCON0207A2', settlementEntryId: '01J9SETL0207A', storeId: '0207',
      amount: 200.0, remainingAfter: 0.0,
      documentId: 'Z51204', documentNumber: 'Z-51204', businessDay: '2026-08-12',
      consumedByOperatorId: '41318', consumedAt: '2026-08-12T23:19:00',
    }),
  ],
}

/**
 * 0331 — the **orphan**. The close timed out and the Z was never written (1146),
 * so `documentNumber` is `''` **permanently**. Rule 1's whole constituency: the row
 * must name the condition in words, because a blank cell here is 150.000 of a
 * branch's money with nothing behind it.
 */
const ACCOUNT_0331: SettlementAccount = {
  storeId: '0331',
  storeName: 'صيدلية النخيل / Al-Nakheel Pharmacy',
  entries: [
    entry({
      settlementEntryId: '01J9SETL0331A', entryNumber: 137, storeId: '0331',
      entryKind: 'SURPLUS', amount: 450.0, remainingAmount: 300.0,
      reason: 'فائض عن مرتجعات شبكة يوليو',
      postedByStaffId: SAAD.staffId, postedByName: SAAD.name,
      postedAt: '2026-08-05T08:20:00',
    }),
  ],
  consumptions: [
    consumption({
      settlementConsumptionId: '01J9SCON0331A1', settlementEntryId: '01J9SETL0331A', storeId: '0331',
      amount: 150.0, remainingAfter: 300.0,
      businessDay: '2026-08-12',
      consumedByOperatorId: '41455', consumedAt: '2026-08-12T22:58:00',
    }),
  ],
}

/**
 * 0455 — four journal rows, one of them a **`REVERSE`**: the collector never came,
 * so SR-0455-0012 was voided and its 200.000 went back onto the entry. Rule 2's
 * constituency, and the reason the journal reads **oldest first** — the void sits
 * directly under the receipt it undoes, and `remainingAfter` climbs from 400 back to
 * 600 across that one row.
 */
const ACCOUNT_0455: SettlementAccount = {
  storeId: '0455',
  storeName: 'صيدلية السلامة / Al-Salamah Pharmacy',
  entries: [
    entry({
      settlementEntryId: '01J9SETL0455A', entryNumber: 141, storeId: '0455',
      entryKind: 'SHORTAGE', amount: 900.0, remainingAmount: 400.0,
      reason: 'عجز تسليم 2026-06-18',
      postedAt: '2026-08-06T12:02:00',
    }),
  ],
  consumptions: [
    consumption({
      settlementConsumptionId: '01J9SCON0455A1', settlementEntryId: '01J9SETL0455A', storeId: '0455',
      amount: 300.0, remainingAfter: 600.0, documentType: 'SPECIAL_RECEIPT',
      documentId: 'SR04550011', documentNumber: 'SR-0455-0011', businessDay: '2026-08-08',
      consumedByOperatorId: '41562', consumedAt: '2026-08-08T19:40:00',
    }),
    consumption({
      settlementConsumptionId: '01J9SCON0455A2', settlementEntryId: '01J9SETL0455A', storeId: '0455',
      amount: 200.0, remainingAfter: 400.0, documentType: 'SPECIAL_RECEIPT',
      documentId: 'SR04550012', documentNumber: 'SR-0455-0012', businessDay: '2026-08-10',
      consumedByOperatorId: '41562', consumedAt: '2026-08-10T20:11:00',
    }),
    consumption({
      settlementConsumptionId: '01J9SCON0455A3', settlementEntryId: '01J9SETL0455A', storeId: '0455',
      consumptionKind: 'REVERSE',
      amount: 200.0, remainingAfter: 600.0, documentType: 'SPECIAL_RECEIPT',
      documentId: 'SR04550012', documentNumber: 'SR-0455-0012', businessDay: '2026-08-10',
      consumedByOperatorId: '41562', consumedAt: '2026-08-10T20:58:00',
    }),
    consumption({
      settlementConsumptionId: '01J9SCON0455A4', settlementEntryId: '01J9SETL0455A', storeId: '0455',
      amount: 200.0, remainingAfter: 400.0, documentType: 'SPECIAL_RECEIPT',
      documentId: 'SR04550013', documentNumber: 'SR-0455-0013', businessDay: '2026-08-12',
      consumedByOperatorId: '41562', consumedAt: '2026-08-12T18:25:00',
    }),
  ],
}

/** 0512 — **square**. History only: one shortage, consumed in full six weeks ago.
 *  The headline reads `square`, and the grid is not empty. */
const ACCOUNT_0512: SettlementAccount = {
  storeId: '0512',
  storeName: 'صيدلية قرطبة / Qurtubah Pharmacy',
  entries: [
    entry({
      settlementEntryId: '01J9SETL0512A', entryNumber: 119, storeId: '0512',
      entryKind: 'SHORTAGE', amount: 210.0, remainingAmount: 0.0, status: 'CONSUMED',
      reason: 'عجز تسليم مايو',
      postedByStaffId: SAAD.staffId, postedByName: SAAD.name,
      postedAt: '2026-06-30T09:15:00',
    }),
  ],
  consumptions: [
    consumption({
      settlementConsumptionId: '01J9SCON0512A1', settlementEntryId: '01J9SETL0512A', storeId: '0512',
      amount: 210.0, remainingAfter: 0.0, documentType: 'SPECIAL_RECEIPT',
      documentId: 'SR05120004', documentNumber: 'SR-0512-0004', businessDay: '2026-07-02',
      consumedByOperatorId: '41679', consumedAt: '2026-07-02T17:12:00',
    }),
  ],
}

/**
 * 0688 — the two correction states, and the **BHD** branch.
 *
 * 🔑 Entry 133 is the Proof bullet in one row: `CLOSED_OUT`, remaining `0.000`, and
 * **one** consumption of 240.000 behind it that left 400.000 standing. The zero was
 * produced by an accountant forgiving the remainder, not by a till taking it — so it
 * must not read as consumed, and the 400.000 it wrote off is the journal's own last
 * `remainingAfter`, read back rather than differenced.
 *
 * Entry 147 is the other half: `CANCELLED` with an **empty** journal — withdrawn
 * while nothing had touched it.
 */
const ACCOUNT_0688: SettlementAccount = {
  storeId: '0688',
  storeName: 'صيدلية المحرق / Al-Muharraq Pharmacy',
  entries: [
    entry({
      settlementEntryId: '01J9SETL0688A', entryNumber: 133, storeId: '0688',
      entryKind: 'SHORTAGE', amount: 640.0, remainingAmount: 0.0, status: 'CLOSED_OUT',
      reason: 'عجز تسليم 2026-04-27',
      postedAt: '2026-07-14T10:05:00',
      closedByStaffId: HUDA.staffId, closedAt: '2026-08-11T15:30:00',
      closedReason: 'أُسقط الباقي بموافقة المدير المالي — تسوية نهائية',
    }),
    entry({
      settlementEntryId: '01J9SETL0688B', entryNumber: 147, storeId: '0688',
      entryKind: 'SURPLUS', amount: 180.0, remainingAmount: 180.0, status: 'CANCELLED',
      reason: 'مرتجع شبكة — سُجّل على الفرع الخطأ',
      postedByStaffId: SAAD.staffId, postedByName: SAAD.name,
      postedAt: '2026-08-09T13:44:00',
      closedByStaffId: SAAD.staffId, closedAt: '2026-08-09T13:51:00',
      closedReason: 'قيد على الفرع الخطأ — أُعيد على 0455',
    }),
    entry({
      settlementEntryId: '01J9SETL0688C', entryNumber: 152, storeId: '0688',
      entryKind: 'SHORTAGE', amount: 95.25, remainingAmount: 95.25,
      reason: 'فرق تسليم 2026-08-01',
      postedAt: '2026-08-11T15:35:00',
    }),
  ],
  consumptions: [
    consumption({
      settlementConsumptionId: '01J9SCON0688A1', settlementEntryId: '01J9SETL0688A', storeId: '0688',
      amount: 240.0, remainingAfter: 400.0, documentType: 'SPECIAL_RECEIPT',
      documentId: 'SR06880002', documentNumber: 'SR-0688-0002', businessDay: '2026-07-20',
      consumedByOperatorId: '41784', consumedAt: '2026-07-20T18:03:00',
    }),
  ],
}

/**
 * The six, by store id — what the drive serves from `Settlement/Account?storeId=…`
 * and what the projection suite asserts against.
 *
 * Exported as a `Record` rather than an array so both callers address a case by the
 * code the prototype's own commentary names it by (`0331` is *the orphan*), which is
 * how a failing assertion stays readable.
 */
export const SETTLEMENT_ACCOUNTS: Record<string, SettlementAccount> = {
  '0142': ACCOUNT_0142,
  '0207': ACCOUNT_0207,
  '0331': ACCOUNT_0331,
  '0455': ACCOUNT_0455,
  '0512': ACCOUNT_0512,
  '0688': ACCOUNT_0688,
}
