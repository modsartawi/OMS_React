/* PROTOTYPE — throwaway. Wayfinder ticket 247 (map 240) — breaker gate 2.
 *
 * A hard-coded ACR (نموذج متابعة المبيعات النقدية ومبيعات الشبكة بالصيدليات),
 * shaped exactly like `AcrFormBuilder.Build`'s output as ticket 242 inventoried
 * it: every money and date figure is a PRE-FORMATTED STRING, because the WPF
 * control never formats a figure either (242 §7.7 — `F2` invariant, no
 * thousands separator, no currency symbol; dates `dd/MM/yyyy` invariant).
 *
 * The scenarios exist to force the page break into every awkward place the gate
 * has to judge: three full pages, a last page holding a single row, an ACR still
 * OPEN, and the idle ACR that still prints one page.
 */

export type AcrRow = {
  seqText: string
  storeCode: string
  salesDateText: string
  cashText: string
  cardText: string
  totalText: string
  receiptNoText: string
  /** 242 §5: '' = reconciled · '✗' = a real whole-riyal diff · '؟' = no Z mirror. */
  matchText: '' | '✗' | '؟'
  pharmacistName: string
  operatorId: string
  /** The builder's literal, English, in an Arabic form — 242 §8-O5. */
  notes: string
  /** What O5 would send instead, if the answer is "translate it server-side". */
  notesAr: string
  /** 242 §8-O6 — negative NetCollected. Built by the server, bound by nobody. */
  isShortfall: boolean
}

export type AcrModel = {
  acrDateText: string
  acrNumberText: string
  areas: string
  /** '' while the ACR is still OPEN — 242 §4 B2.1. */
  closedAtText: string
  label: string
  status: string
  /** The paper's `الموافق` companion date. Dropped by the WPF — 242 §8-O9. */
  hijriText: string
  /** On the model, bound by nobody — 242 §8-O7. '' when un-banked. */
  depositNumberText: string
  depositStatus: string
  cashTotalText: string
  cardTotalText: string
  grandTotalText: string
  revenuesText: string
  depositText: string
  collectorName: string
  collectorId: string
  rows: AcrRow[]
}

const money = (n: number) => n.toFixed(2)

const PHARMACISTS = [
  'محمد عبدالله الشهري',
  'أحمد سعيد القحطاني',
  'خالد ناصر الدوسري',
  'فيصل عمر الزهراني',
  'سلطان علي العتيبي',
  'ماجد حسن الغامدي',
  'عبدالعزيز راشد الحربي',
  'طارق سالم المالكي',
]

/** Deterministic — a prototype that reshuffles on every reload cannot be compared. */
function makeRows(count: number, opts: { marks?: boolean } = {}): AcrRow[] {
  const rows: AcrRow[] = []
  for (let i = 0; i < count; i++) {
    const n = i + 1
    const cash = 1840 + ((i * 733) % 5200) + (i % 7) * 11.25
    const card = 2610 + ((i * 419) % 7400) + (i % 5) * 3.5
    const day = 3 + (i % 4) // a catch-up ACR carries more than one sales day
    const marks = opts.marks !== false

    // The three states col 7 has to prove, planted at fixed indices.
    const isZMissing = marks && i === 5
    const isDiff = marks && i === 11
    const isShortfall = marks && i === 17

    const cashValue = isShortfall ? -412.5 : cash
    rows.push({
      seqText: String(n),
      storeCode: String(1204 + ((i * 37) % 620)),
      salesDateText: `${String(day).padStart(2, '0')}/06/2026`,
      cashText: money(cashValue),
      cardText: money(card),
      totalText: money(cashValue + card),
      receiptNoText: String(90411 + i * 3),
      matchText: isZMissing ? '؟' : isDiff ? '✗' : '',
      pharmacistName: PHARMACISTS[i % PHARMACISTS.length],
      operatorId: String(70155 + ((i * 91) % 800)),
      notes: isZMissing ? 'Z report missing' : isDiff ? 'فرق كاش 3 ريال' : '',
      notesAr: isZMissing ? 'تقرير Z غير مُرحّل' : isDiff ? 'فرق كاش 3 ريال' : '',
      isShortfall,
    })
  }
  return rows
}

function totals(rows: AcrRow[]) {
  const cash = rows.reduce((s, r) => s + Number(r.cashText), 0)
  const card = rows.reduce((s, r) => s + Number(r.cardText), 0)
  return {
    cashTotalText: money(cash),
    cardTotalText: money(card),
    grandTotalText: money(cash + card),
    revenuesText: money(cash + card),
    depositText: money(cash),
  }
}

function model(rows: AcrRow[], over: Partial<AcrModel> = {}): AcrModel {
  return {
    acrDateText: '06/06/2026',
    acrNumberText: '4482',
    areas: 'الشرقية - الخبر',
    closedAtText: '07/06/2026',
    label: 'تحصيل يوم السبت',
    status: 'مغلق',
    hijriText: '20/12/1447',
    depositNumberText: '5590241',
    depositStatus: 'مودع',
    collectorName: 'إبراهيم ياسين الشمري',
    collectorId: '40219',
    rows,
    ...totals(rows),
    ...over,
  }
}

export const SCENARIOS = [
  {
    key: 'three-pages',
    label: '47 rows — three full pages',
    proves: 'the header repeats, the seq runs 1→47 unbroken, and only the last page carries الاجمالي + ملخص التحصيل',
    model: model(makeRows(47)),
  },
  {
    key: 'boundary',
    label: '23 rows — the ugly break',
    proves: 'one row on page 2, and the whole summary block underneath it: the worst place the page can break',
    model: model(makeRows(23)),
  },
  {
    key: 'open',
    label: '25 rows — the ACR is still OPEN',
    proves: 'تاريخ التحصيل blank, status مفتوح, no deposit number — and a short last page',
    model: model(makeRows(25), {
      closedAtText: '',
      status: 'مفتوح',
      depositNumberText: '',
      depositStatus: 'غير مودع',
      label: 'تحصيل قيد الفتح',
    }),
  },
  {
    key: 'empty',
    label: '0 rows — the idle ACR',
    proves: '“an idle ACR still prints one page”: header, empty body, totals of 0.00, summary and signature all present',
    model: model(makeRows(0)),
  },
]

/** `AcrFormBuilder.Paginate` — a plain chunk, one empty page when there are none. */
export function paginate<T>(rows: T[], perPage: number): T[][] {
  if (rows.length === 0) return [[]]
  const pages: T[][] = []
  for (let i = 0; i < rows.length; i += perPage) pages.push(rows.slice(i, i + perPage))
  return pages
}

export const pageText = (i: number, count: number) => `${i + 1} / ${count}`
