/* Four ACRs — نموذج متابعة المبيعات النقدية ومبيعات الشبكة بالصيدليات — as TEST
 * DATA, chosen for their PAGING: 47 rows over three sheets, 25, the ugly 23, and
 * the idle one. Graduated out of `__prototype__/acr/acr-mock.ts` (ticket 247).
 *
 * ⚠ **These are no longer what the screen renders.** Ticket 259 put
 * `CollectionWeb/AcrForm/{acrId}` behind the print route, and the CONTRACT they
 * are typed against moved with it, to `@/core/models/collection`. What is left
 * here is four documents the drives serve over a stubbed wire.
 *
 * 🔑 The prototype mock this fixture graduates from DID compute its figures —
 * `toFixed`, a `paginate()` chunker, running totals. None of that survived: the
 * values below were produced by running that mock once at authoring time and
 * serializing the result, so the sheet a reviewer sees is the sheet the 247
 * sign-off saw, down to the byte, with no arithmetic left in the browser.
 */

import type { AcrDocument, AcrRow } from '@/core/models/collection'

const ROWS_PER_PAGE = 22

/** Page 1, shared by all three non-empty scenarios because it is byte-identical in each.
 * Row 6 carries the unsynced Z mirror (`؟` + تقرير Z غير مُرحّل), row 12 a real whole-riyal
 * diff (`✗`), and row 18 the shortfall — a NEGATIVE cash figure, which is the LTR-island
 * trap 242 §1.1 missed and the WPF still has. */
const ROWS_1_22: AcrRow[] = [
  { seqText: '1', storeCode: '1204', salesDateText: '03/06/2026', cashText: '1840.00', cardText: '2610.00', totalText: '4450.00', settlementText: '—', netCollectedText: '1840.00', isSettlement: false, receiptNoText: '90411', pharmacistName: 'محمد عبدالله الشهري', pharmacistId: '70155', notes: '', isShortfall: false },
  { seqText: '2', storeCode: '1241', salesDateText: '04/06/2026', cashText: '2584.25', cardText: '3032.50', totalText: '5616.75', settlementText: '—', netCollectedText: '2584.25', isSettlement: false, receiptNoText: '90414', pharmacistName: 'أحمد سعيد القحطاني', pharmacistId: '70246', notes: '', isShortfall: false },
  { seqText: '3', storeCode: '1278', salesDateText: '05/06/2026', cashText: '3328.50', cardText: '3455.00', totalText: '6783.50', settlementText: '—', netCollectedText: '3328.50', isSettlement: false, receiptNoText: '90417', pharmacistName: 'خالد ناصر الدوسري', pharmacistId: '70337', notes: '', isShortfall: false },
  { seqText: '4', storeCode: '1315', salesDateText: '06/06/2026', cashText: '4072.75', cardText: '3877.50', totalText: '7950.25', settlementText: '—', netCollectedText: '4072.75', isSettlement: false, receiptNoText: '90420', pharmacistName: 'فيصل عمر الزهراني', pharmacistId: '70428', notes: '', isShortfall: false },
  { seqText: '5', storeCode: '1352', salesDateText: '03/06/2026', cashText: '4817.00', cardText: '4300.00', totalText: '9117.00', settlementText: '—', netCollectedText: '4817.00', isSettlement: false, receiptNoText: '90423', pharmacistName: 'سلطان علي العتيبي', pharmacistId: '70519', notes: '', isShortfall: false },
  { seqText: '6', storeCode: '1389', salesDateText: '04/06/2026', cashText: '5561.25', cardText: '4705.00', totalText: '10266.25', settlementText: '—', netCollectedText: '5561.25', isSettlement: false, receiptNoText: '90426', pharmacistName: 'ماجد حسن الغامدي', pharmacistId: '70610', notes: 'تقرير Z غير مُرحّل', isShortfall: false },
  { seqText: '7', storeCode: '1426', salesDateText: '05/06/2026', cashText: '6305.50', cardText: '5127.50', totalText: '11433.00', settlementText: '—', netCollectedText: '6305.50', isSettlement: false, receiptNoText: '90429', pharmacistName: 'عبدالعزيز راشد الحربي', pharmacistId: '70701', notes: '', isShortfall: false },
  { seqText: '8', storeCode: '1463', salesDateText: '06/06/2026', cashText: '6971.00', cardText: '5550.00', totalText: '12521.00', settlementText: '—', netCollectedText: '6971.00', isSettlement: false, receiptNoText: '90432', pharmacistName: 'طارق سالم المالكي', pharmacistId: '70792', notes: '', isShortfall: false },
  { seqText: '9', storeCode: '1500', salesDateText: '03/06/2026', cashText: '2515.25', cardText: '5972.50', totalText: '8487.75', settlementText: '—', netCollectedText: '2515.25', isSettlement: false, receiptNoText: '90435', pharmacistName: 'محمد عبدالله الشهري', pharmacistId: '70883', notes: '', isShortfall: false },
  { seqText: '10', storeCode: '1537', salesDateText: '04/06/2026', cashText: '3259.50', cardText: '6395.00', totalText: '9654.50', settlementText: '—', netCollectedText: '3259.50', isSettlement: false, receiptNoText: '90438', pharmacistName: 'أحمد سعيد القحطاني', pharmacistId: '70174', notes: '', isShortfall: false },
  { seqText: '11', storeCode: '1574', salesDateText: '05/06/2026', cashText: '4003.75', cardText: '6800.00', totalText: '10803.75', settlementText: '—', netCollectedText: '4003.75', isSettlement: false, receiptNoText: '90441', pharmacistName: 'خالد ناصر الدوسري', pharmacistId: '70265', notes: '', isShortfall: false },
  { seqText: '12', storeCode: '1611', salesDateText: '06/06/2026', cashText: '4748.00', cardText: '7222.50', totalText: '11970.50', settlementText: '—', netCollectedText: '4748.00', isSettlement: false, receiptNoText: '90444', pharmacistName: 'فيصل عمر الزهراني', pharmacistId: '70356', notes: '', isShortfall: false },
  { seqText: '13', storeCode: '1648', salesDateText: '03/06/2026', cashText: '5492.25', cardText: '7645.00', totalText: '13137.25', settlementText: '—', netCollectedText: '5492.25', isSettlement: false, receiptNoText: '90447', pharmacistName: 'سلطان علي العتيبي', pharmacistId: '70447', notes: '', isShortfall: false },
  { seqText: '14', storeCode: '1685', salesDateText: '04/06/2026', cashText: '6236.50', cardText: '8067.50', totalText: '14304.00', settlementText: '—', netCollectedText: '6236.50', isSettlement: false, receiptNoText: '90450', pharmacistName: 'ماجد حسن الغامدي', pharmacistId: '70538', notes: '', isShortfall: false },
  { seqText: '15', storeCode: '1722', salesDateText: '05/06/2026', cashText: '6902.00', cardText: '8490.00', totalText: '15392.00', settlementText: '—', netCollectedText: '6902.00', isSettlement: false, receiptNoText: '90453', pharmacistName: 'عبدالعزيز راشد الحربي', pharmacistId: '70629', notes: '', isShortfall: false },
  { seqText: '16', storeCode: '1759', salesDateText: '06/06/2026', cashText: '2446.25', cardText: '8895.00', totalText: '11341.25', settlementText: '—', netCollectedText: '2446.25', isSettlement: false, receiptNoText: '90456', pharmacistName: 'طارق سالم المالكي', pharmacistId: '70720', notes: '', isShortfall: false },
  { seqText: '17', storeCode: '1796', salesDateText: '03/06/2026', cashText: '3190.50', cardText: '9317.50', totalText: '12508.00', settlementText: '—', netCollectedText: '3190.50', isSettlement: false, receiptNoText: '90459', pharmacistName: 'محمد عبدالله الشهري', pharmacistId: '70811', notes: '', isShortfall: false },
  { seqText: '18', storeCode: '1213', salesDateText: '04/06/2026', cashText: '-412.50', cardText: '9740.00', totalText: '9327.50', settlementText: '—', netCollectedText: '-412.50', isSettlement: false, receiptNoText: '90462', pharmacistName: 'أحمد سعيد القحطاني', pharmacistId: '70902', notes: '', isShortfall: true },
  { seqText: '19', storeCode: '1250', salesDateText: '05/06/2026', cashText: '4679.00', cardText: '2762.50', totalText: '7441.50', settlementText: '—', netCollectedText: '4679.00', isSettlement: false, receiptNoText: '90465', pharmacistName: 'خالد ناصر الدوسري', pharmacistId: '70193', notes: '', isShortfall: false },
  { seqText: '20', storeCode: '1287', salesDateText: '06/06/2026', cashText: '5423.25', cardText: '3185.00', totalText: '8608.25', settlementText: '—', netCollectedText: '5423.25', isSettlement: false, receiptNoText: '90468', pharmacistName: 'فيصل عمر الزهراني', pharmacistId: '70284', notes: '', isShortfall: false },
  { seqText: '21', storeCode: '1324', salesDateText: '03/06/2026', cashText: '6167.50', cardText: '3590.00', totalText: '9757.50', settlementText: '—', netCollectedText: '6167.50', isSettlement: false, receiptNoText: '90471', pharmacistName: 'سلطان علي العتيبي', pharmacistId: '70375', notes: '', isShortfall: false },
  { seqText: '22', storeCode: '1361', salesDateText: '04/06/2026', cashText: '6833.00', cardText: '4012.50', totalText: '10845.50', settlementText: '—', netCollectedText: '6833.00', isSettlement: false, receiptNoText: '90474', pharmacistName: 'ماجد حسن الغامدي', pharmacistId: '70466', notes: '', isShortfall: false },
]

/** Page 2 of the 47-row ACR — a full page with no summary under it. */
const ROWS_23_44: AcrRow[] = [
  { seqText: '23', storeCode: '1398', salesDateText: '05/06/2026', cashText: '2377.25', cardText: '4435.00', totalText: '6812.25', settlementText: '—', netCollectedText: '2377.25', isSettlement: false, receiptNoText: '90477', pharmacistName: 'عبدالعزيز راشد الحربي', pharmacistId: '70557', notes: '', isShortfall: false },
  { seqText: '24', storeCode: '1435', salesDateText: '06/06/2026', cashText: '3121.50', cardText: '4857.50', totalText: '7979.00', settlementText: '—', netCollectedText: '3121.50', isSettlement: false, receiptNoText: '90480', pharmacistName: 'طارق سالم المالكي', pharmacistId: '70648', notes: '', isShortfall: false },
  { seqText: '25', storeCode: '1472', salesDateText: '03/06/2026', cashText: '3865.75', cardText: '5280.00', totalText: '9145.75', settlementText: '—', netCollectedText: '3865.75', isSettlement: false, receiptNoText: '90483', pharmacistName: 'محمد عبدالله الشهري', pharmacistId: '70739', notes: '', isShortfall: false },
  { seqText: '26', storeCode: '1509', salesDateText: '04/06/2026', cashText: '4610.00', cardText: '5685.00', totalText: '10295.00', settlementText: '—', netCollectedText: '4610.00', isSettlement: false, receiptNoText: '90486', pharmacistName: 'أحمد سعيد القحطاني', pharmacistId: '70830', notes: '', isShortfall: false },
  { seqText: '27', storeCode: '1546', salesDateText: '05/06/2026', cashText: '5354.25', cardText: '6107.50', totalText: '11461.75', settlementText: '—', netCollectedText: '5354.25', isSettlement: false, receiptNoText: '90489', pharmacistName: 'خالد ناصر الدوسري', pharmacistId: '70921', notes: '', isShortfall: false },
  { seqText: '28', storeCode: '1583', salesDateText: '06/06/2026', cashText: '6098.50', cardText: '6530.00', totalText: '12628.50', settlementText: '—', netCollectedText: '6098.50', isSettlement: false, receiptNoText: '90492', pharmacistName: 'فيصل عمر الزهراني', pharmacistId: '70212', notes: '', isShortfall: false },
  { seqText: '29', storeCode: '1620', salesDateText: '03/06/2026', cashText: '6764.00', cardText: '6952.50', totalText: '13716.50', settlementText: '—', netCollectedText: '6764.00', isSettlement: false, receiptNoText: '90495', pharmacistName: 'سلطان علي العتيبي', pharmacistId: '70303', notes: '', isShortfall: false },
  { seqText: '30', storeCode: '1657', salesDateText: '04/06/2026', cashText: '2308.25', cardText: '7375.00', totalText: '9683.25', settlementText: '—', netCollectedText: '2308.25', isSettlement: false, receiptNoText: '90498', pharmacistName: 'ماجد حسن الغامدي', pharmacistId: '70394', notes: '', isShortfall: false },
  { seqText: '31', storeCode: '1694', salesDateText: '05/06/2026', cashText: '3052.50', cardText: '7780.00', totalText: '10832.50', settlementText: '—', netCollectedText: '3052.50', isSettlement: false, receiptNoText: '90501', pharmacistName: 'عبدالعزيز راشد الحربي', pharmacistId: '70485', notes: '', isShortfall: false },
  { seqText: '32', storeCode: '1731', salesDateText: '06/06/2026', cashText: '3796.75', cardText: '8202.50', totalText: '11999.25', settlementText: '—', netCollectedText: '3796.75', isSettlement: false, receiptNoText: '90504', pharmacistName: 'طارق سالم المالكي', pharmacistId: '70576', notes: '', isShortfall: false },
  { seqText: '33', storeCode: '1768', salesDateText: '03/06/2026', cashText: '4541.00', cardText: '8625.00', totalText: '13166.00', settlementText: '—', netCollectedText: '4541.00', isSettlement: false, receiptNoText: '90507', pharmacistName: 'محمد عبدالله الشهري', pharmacistId: '70667', notes: '', isShortfall: false },
  { seqText: '34', storeCode: '1805', salesDateText: '04/06/2026', cashText: '5285.25', cardText: '9047.50', totalText: '14332.75', settlementText: '—', netCollectedText: '5285.25', isSettlement: false, receiptNoText: '90510', pharmacistName: 'أحمد سعيد القحطاني', pharmacistId: '70758', notes: '', isShortfall: false },
  { seqText: '35', storeCode: '1222', salesDateText: '05/06/2026', cashText: '6029.50', cardText: '9470.00', totalText: '15499.50', settlementText: '—', netCollectedText: '6029.50', isSettlement: false, receiptNoText: '90513', pharmacistName: 'خالد ناصر الدوسري', pharmacistId: '70849', notes: '', isShortfall: false },
  { seqText: '36', storeCode: '1259', salesDateText: '06/06/2026', cashText: '6695.00', cardText: '9875.00', totalText: '16570.00', settlementText: '—', netCollectedText: '6695.00', isSettlement: false, receiptNoText: '90516', pharmacistName: 'فيصل عمر الزهراني', pharmacistId: '70940', notes: '', isShortfall: false },
  { seqText: '37', storeCode: '1296', salesDateText: '03/06/2026', cashText: '2239.25', cardText: '2897.50', totalText: '5136.75', settlementText: '—', netCollectedText: '2239.25', isSettlement: false, receiptNoText: '90519', pharmacistName: 'سلطان علي العتيبي', pharmacistId: '70231', notes: '', isShortfall: false },
  { seqText: '38', storeCode: '1333', salesDateText: '04/06/2026', cashText: '2983.50', cardText: '3320.00', totalText: '6303.50', settlementText: '—', netCollectedText: '2983.50', isSettlement: false, receiptNoText: '90522', pharmacistName: 'ماجد حسن الغامدي', pharmacistId: '70322', notes: '', isShortfall: false },
  { seqText: '39', storeCode: '1370', salesDateText: '05/06/2026', cashText: '3727.75', cardText: '3742.50', totalText: '7470.25', settlementText: '—', netCollectedText: '3727.75', isSettlement: false, receiptNoText: '90525', pharmacistName: 'عبدالعزيز راشد الحربي', pharmacistId: '70413', notes: '', isShortfall: false },
  { seqText: '40', storeCode: '1407', salesDateText: '06/06/2026', cashText: '4472.00', cardText: '4165.00', totalText: '8637.00', settlementText: '—', netCollectedText: '4472.00', isSettlement: false, receiptNoText: '90528', pharmacistName: 'طارق سالم المالكي', pharmacistId: '70504', notes: '', isShortfall: false },
  { seqText: '41', storeCode: '1444', salesDateText: '03/06/2026', cashText: '5216.25', cardText: '4570.00', totalText: '9786.25', settlementText: '—', netCollectedText: '5216.25', isSettlement: false, receiptNoText: '90531', pharmacistName: 'محمد عبدالله الشهري', pharmacistId: '70595', notes: '', isShortfall: false },
  { seqText: '42', storeCode: '1481', salesDateText: '04/06/2026', cashText: '5960.50', cardText: '4992.50', totalText: '10953.00', settlementText: '—', netCollectedText: '5960.50', isSettlement: false, receiptNoText: '90534', pharmacistName: 'أحمد سعيد القحطاني', pharmacistId: '70686', notes: '', isShortfall: false },
  { seqText: '43', storeCode: '1518', salesDateText: '05/06/2026', cashText: '6626.00', cardText: '5415.00', totalText: '12041.00', settlementText: '—', netCollectedText: '6626.00', isSettlement: false, receiptNoText: '90537', pharmacistName: 'خالد ناصر الدوسري', pharmacistId: '70777', notes: '', isShortfall: false },
  { seqText: '44', storeCode: '1555', salesDateText: '06/06/2026', cashText: '2170.25', cardText: '5837.50', totalText: '8007.75', settlementText: '—', netCollectedText: '2170.25', isSettlement: false, receiptNoText: '90540', pharmacistName: 'فيصل عمر الزهراني', pharmacistId: '70868', notes: '', isShortfall: false },
]

/** Page 3 of the 47-row ACR — a short last page, and the only one that shows the summary.
 * It also carries the two rows BackOffice 1183 exists for: 46 is a trading day whose branch
 * KEPT A SURPLUS BACK (تسويات −200.00, so المستلم is 200 under the gross المبيعات النقدية),
 * and 47 is a SETTLEMENT RECEIPT — no sales day, no cash, no card, no total, every one of
 * those cells an em dash, and its whole amount entering through تسويات as +500.00. */
const ROWS_45_47: AcrRow[] = [
  { seqText: '45', storeCode: '1592', salesDateText: '03/06/2026', cashText: '2914.50', cardText: '6260.00', totalText: '9174.50', settlementText: '—', netCollectedText: '2914.50', isSettlement: false, receiptNoText: '90543', pharmacistName: 'سلطان علي العتيبي', pharmacistId: '70159', notes: '', isShortfall: false },
  { seqText: '46', storeCode: '1629', salesDateText: '04/06/2026', cashText: '3658.75', cardText: '6665.00', totalText: '10323.75', settlementText: '-200.00', netCollectedText: '3458.75', isSettlement: false, receiptNoText: '90546', pharmacistName: 'ماجد حسن الغامدي', pharmacistId: '70250', notes: '', isShortfall: false },
  { seqText: '47', storeCode: '1666', salesDateText: '—', cashText: '—', cardText: '—', totalText: '—', settlementText: '+500.00', netCollectedText: '500.00', isSettlement: true, receiptNoText: '90549', pharmacistName: 'عبدالعزيز راشد الحربي', pharmacistId: '70341', notes: '', isShortfall: false },
]

/** Page 2 of the still-OPEN 25-row ACR. Duplicated from ROWS_23_44's first three rows rather
 * than sliced: a slice is chunking, and this feature does none. */
const ROWS_23_25: AcrRow[] = [
  { seqText: '23', storeCode: '1398', salesDateText: '05/06/2026', cashText: '2377.25', cardText: '4435.00', totalText: '6812.25', settlementText: '—', netCollectedText: '2377.25', isSettlement: false, receiptNoText: '90477', pharmacistName: 'عبدالعزيز راشد الحربي', pharmacistId: '70557', notes: '', isShortfall: false },
  { seqText: '24', storeCode: '1435', salesDateText: '06/06/2026', cashText: '3121.50', cardText: '4857.50', totalText: '7979.00', settlementText: '—', netCollectedText: '3121.50', isSettlement: false, receiptNoText: '90480', pharmacistName: 'طارق سالم المالكي', pharmacistId: '70648', notes: '', isShortfall: false },
  { seqText: '25', storeCode: '1472', salesDateText: '03/06/2026', cashText: '3865.75', cardText: '5280.00', totalText: '9145.75', settlementText: '—', netCollectedText: '3865.75', isSettlement: false, receiptNoText: '90483', pharmacistName: 'محمد عبدالله الشهري', pharmacistId: '70739', notes: '', isShortfall: false },
]

/** Page 2 of the 23-row ACR — ONE row alone, beneath the whole summary block. The worst place
 * the break can land, and the one the 247 sign-off looked hardest at. */
const ROWS_23_23: AcrRow[] = [
  { seqText: '23', storeCode: '1398', salesDateText: '05/06/2026', cashText: '2377.25', cardText: '4435.00', totalText: '6812.25', settlementText: '—', netCollectedText: '2377.25', isSettlement: false, receiptNoText: '90477', pharmacistName: 'عبدالعزيز راشد الحربي', pharmacistId: '70557', notes: '', isShortfall: false },
]

/**
 * A fixture case, keyed by the id that stands in for `:acrId` until the door lands:
 * `/collection/acr/three-pages` renders the first one. What each case proves is a
 * COMMENT and not a field — the prototype's switcher read `label`/`proves` off the
 * model, and shipping them would put a screenful of prose in every user's bundle.
 */
export type AcrScenario = {
  key: string
  document: AcrDocument
}

export const ACR_SCENARIOS: AcrScenario[] = [
  {
    // 47 rows over three pages: the header repeats on each, the م sequence runs 1→47
    // unbroken, and only the last page carries الاجمالي + ملخص التحصيل.
    key: 'three-pages',
    document: {
      form: {
        acrDateText: '06/06/2026',
        hijriText: '20/12/1447',
        acrNumberText: '4482',
        areas: 'الشرقية - الخبر',
        closedAtText: '07/06/2026',
        label: 'تحصيل يوم السبت',
        status: 'مغلق',
        collectorName: 'إبراهيم ياسين الشمري',
        collectorId: '40219',
        cashTotalText: '200832.75',
        cardTotalText: '272840.00',
        grandTotalText: '473672.75',
        // ⚠ Σ over the تسويات column: row 46's −200.00 and row 47's +500.00. SIGNED,
        // with the explicit + the server writes, because the direction is the content.
        settlementTotalText: '+300.00',
        // المبلغ المطلوب ايداعه = cash sales + settlements = 200832.75 + 300.00. THE
        // IDENTITY that makes the summary readable rather than three loose numbers.
        bankedTotalText: '201132.75',
        revenuesText: '473672.75',
      },
      rowsPerPage: ROWS_PER_PAGE,
      pages: [
        { pageIndex: 1, pageCount: 3, pageText: '1 / 3', showSummary: false, rows: ROWS_1_22 },
        { pageIndex: 2, pageCount: 3, pageText: '2 / 3', showSummary: false, rows: ROWS_23_44 },
        { pageIndex: 3, pageCount: 3, pageText: '3 / 3', showSummary: true, rows: ROWS_45_47 },
      ],
    },
  },
  {
    // 23 rows: one row alone on page 2 with the entire summary block beneath it.
    key: 'boundary',
    document: {
      form: {
        acrDateText: '06/06/2026',
        hijriText: '20/12/1447',
        acrNumberText: '4482',
        areas: 'الشرقية - الخبر',
        closedAtText: '07/06/2026',
        label: 'تحصيل يوم السبت',
        status: 'مغلق',
        collectorName: 'إبراهيم ياسين الشمري',
        collectorId: '40219',
        cashTotalText: '99341.75',
        cardTotalText: '129187.50',
        grandTotalText: '228529.25',
        // No settlement on any row — and the total still prints a figure rather
        // than the em dash a ROW uses: '0.00' here is a true statement about the
        // whole collection, not a claim that some settlement of nothing happened.
        settlementTotalText: '0.00',
        bankedTotalText: '99341.75',
        revenuesText: '228529.25',
      },
      rowsPerPage: ROWS_PER_PAGE,
      pages: [
        { pageIndex: 1, pageCount: 2, pageText: '1 / 2', showSummary: false, rows: ROWS_1_22 },
        { pageIndex: 2, pageCount: 2, pageText: '2 / 2', showSummary: true, rows: ROWS_23_23 },
      ],
    },
  },
  {
    // 25 rows and the ACR is still OPEN: تاريخ التحصيل is '' and must render BLANK — not
    // the two quote marks, not a placeholder, not a dash. And a short last page with it.
    key: 'open',
    document: {
      form: {
        acrDateText: '06/06/2026',
        hijriText: '20/12/1447',
        acrNumberText: '4482',
        areas: 'الشرقية - الخبر',
        closedAtText: '',
        label: 'تحصيل قيد الفتح',
        status: 'مفتوح',
        collectorName: 'إبراهيم ياسين الشمري',
        collectorId: '40219',
        cashTotalText: '106329.00',
        cardTotalText: '139325.00',
        grandTotalText: '245654.00',
        // No settlement on any row — and the total still prints a figure rather
        // than the em dash a ROW uses: '0.00' here is a true statement about the
        // whole collection, not a claim that some settlement of nothing happened.
        settlementTotalText: '0.00',
        bankedTotalText: '106329.00',
        revenuesText: '245654.00',
      },
      rowsPerPage: ROWS_PER_PAGE,
      pages: [
        { pageIndex: 1, pageCount: 2, pageText: '1 / 2', showSummary: false, rows: ROWS_1_22 },
        { pageIndex: 2, pageCount: 2, pageText: '2 / 2', showSummary: true, rows: ROWS_23_25 },
      ],
    },
  },
  {
    // The idle ACR still prints its one page: header, empty table body, totals of `0.00`,
    // summary and signature all present (242 §5).
    key: 'empty',
    document: {
      form: {
        acrDateText: '06/06/2026',
        hijriText: '20/12/1447',
        acrNumberText: '4482',
        areas: 'الشرقية - الخبر',
        closedAtText: '07/06/2026',
        label: 'تحصيل يوم السبت',
        status: 'مغلق',
        collectorName: 'إبراهيم ياسين الشمري',
        collectorId: '40219',
        cashTotalText: '0.00',
        cardTotalText: '0.00',
        grandTotalText: '0.00',
        // An idle ACR states zero everywhere, including المبلغ المطلوب ايداعه — it owes
        // the bank nothing, which is a figure, not an absence.
        settlementTotalText: '0.00',
        bankedTotalText: '0.00',
        revenuesText: '0.00',
      },
      rowsPerPage: ROWS_PER_PAGE,
      pages: [
        { pageIndex: 1, pageCount: 1, pageText: '1 / 1', showSummary: true, rows: [] },
      ],
    },
  },
]
