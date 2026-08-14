/* The نموذج متابعة المبيعات النقدية ومبيعات الشبكة بالصيدليات facsimile — one A4
 * sheet per `AcrPage`.
 *
 * ⚠ DOCUMENTED EXCEPTION (spec 249, tickets 251/252), shared with
 * `collection-acr.css`: this file is a paper form, so the Arabic IS the form
 * rather than UI copy (no `t()`) and the geometry is physical and mirrors
 * nothing. The third rule — the colour-literal gate — is exercised by the
 * stylesheet, which holds the whole-file exclusion; every colour on this document
 * lives there, so this file needs none and a colour creeping into the markup
 * still trips the gate. Screen chrome around it — `PrintMiss` — obeys every rule,
 * unexceptionally.
 *
 * Every mark below is a RULING, signed off in ticket 247 against the paper pad
 * and the WPF side by side; §4, §5 and §7 of `assets/242-fidelity-inventory.RESEARCH.md`
 * is the mark-by-mark inventory. The prototype's `VariantC` settled them; this is
 * the rewrite, not the promotion.
 *
 * ⚠ The ACR is a RESHAPE, not a facsimile (242 §6.2) — the WPF redrew this form
 * rather than copying it, so "matches the WPF" and "matches the paper" are
 * genuinely different tests. 247 sorted every departure with one rule: where the
 * WPF left the pad because it KNOWS something the pad could not, keep the
 * departure; where it left by accident or omission, go back to the pad. The
 * places that rule bit are commented at their marks.
 *
 * 🔑 The component computes NOTHING. Every displayed value arrives pre-formatted
 * from the server (245 §0) — no money, no date, no page chunking, and the `م`
 * sequence is READ off the row rather than counted, which is what keeps it
 * continuous across pages. If a string is missing the answer is a server change.
 */
import type { ReactNode } from 'react'
import Ltr from '@/core/ui/Ltr'
import PrintSheet from './PrintSheet'
import type { AcrForm, AcrPage, AcrRow } from '@/core/models/collection'
import logoUrl from './logo-aldawaa.png'
import './collection-acr.css'

/* The twelve columns, in the RTL order they print — column 0 is the sheet's
 * right. Widths live in `collection-acr.css`.
 *
 * BackOffice 1183 added تسويات and المستلم after إجمالي المبيعات, and the
 * 2026-08-15 owner sign-off on that sheet removed مطابقة الكاش والشبكة outright —
 * so this list went 11 → 13 → 12. Both moves are the SERVER's: `matchText` left
 * the contract with the column, so it cannot be re-added here by accident. */
const HEADERS = [
  'م',
  'رقم الصيدلية',
  'تاريخ اليوم',
  // GROSS cash sales since 1183 — what the drawer sold, not what was handed over.
  'المبيعات النقدية',
  'مبيعات الشبكة',
  'إجمالي المبيعات',
  // ONE SIGNED column over both kinds: a surplus kept back is negative, a
  // settlement receipt positive. Two columns were rejected — the sign is the
  // whole distinction.
  'تسويات',
  // What the collector was actually handed — the number المبيعات النقدية carried
  // before 1183 re-based it to gross.
  'المستلم',
  'رقم سند القبض',
  'اسم الصيدلي',
  // 247's amendment 1 — the WPF calls this `رقم المشغل`, the operator's id. The
  // closer IS the pharmacist, so the column says so and pairs with the name
  // beside it. 245's field is `pharmacistId`.
  'رقم الصيدلي',
  'ملاحظات',
]

export default function CollectionAcr({ form, page }: { form: AcrForm; page: AcrPage }) {
  return (
    <PrintSheet docClassName="acr-doc">
      <div className="acr-head">
        {/* 🚩 INTERIM (251/252 open question, and sharper on this document than on
            the receipt): the paper original prints the DMSCO mark and the WPF
            prints al-dawaa. This renders the stacked al-dawaa the WPF ships. The
            honest fallback if that is rejected is the prototype's labelled
            placeholder — never a faked DMSCO mark. One decision, both documents,
            and it needs a file from the brand side (BackOffice 1088). Alt is
            empty on purpose: the mark is decorative on a form that titles itself
            on the line beside it. */}
        <div className="acr-head-side">
          <img className="acr-logo" src={logoUrl} alt="" />
        </div>

        <div className="acr-title">نموذج متابعة المبيعات النقدية ومبيعات الشبكة بالصيدليات</div>

        {/* The pad was one sheet; this prints three, so the WPF's stamp is kept.
            NOT an LTR island, deliberately: `pageText` reads `1 / 3`, and under
            the RTL paragraph its two numbers already resolve in logical order —
            صفحة, then 1, then 3, right to left. Isolating it would flip the pair
            against the WPF and against the sign-off, for no reading gain. */}
        <div className="acr-stamp">صفحة {page.pageText}</div>
      </div>

      <div className="acr-meta">
        <Meta label="عن يوم: " value={form.acrDateText} />
        {/* Back to the pad: the WPF dropped `الموافق` by omission, and the server
            can compute Umm al-Qura (242 §7.6), so it costs a model field rather
            than a hand-fill. */}
        <Meta label="الموافق: " value={form.hijriText} />
        {/* 247's amendment 2 — `نموذج رقم ( )` becomes `رقم التجميعي`: the field is
            the ACR's own serial, not a form-stock number. The pad's parentheses
            went with it; they bracket a blank a collector wrote into, and this is
            printed. */}
        <Meta label="رقم التجميعي: " value={form.acrNumberText} strong />
        <Meta label="المنطقة: " value={form.areas} />
      </div>

      {/* 247's amendment 3 — NO deposit mark, here or in the summary below.
          242 §8-O7 answered OUT and wider than it was asked: the ACR states what
          was COLLECTED; where the money went afterwards is the deposit's own
          document. `depositNumberText`, `depositStatus` and `depositText` all
          left the contract, so there is nothing here to bind. */}
      <div className="acr-meta acr-meta--last">
        {/* `closedAtText` is `''` while the ACR is still OPEN and renders BLANK —
            no placeholder, no dash. It is rendered as it came, with no `||`
            fallback that could put an invented mark on a printed record. */}
        <Meta label="تاريخ التحصيل: " value={form.closedAtText} />
        <Meta label="الوصف: " value={form.label} />
        <Meta label="الحالة: " value={form.status} />
      </div>

      {/* The header repeats on EVERY page — each printed side is a whole reading
          of the form, exactly as the WPF's FixedPage-per-chunk printer builds it. */}
      <div className="acr-tr">
        {HEADERS.map((header, col) => (
          <Cell key={col} col={col} className="acr-th">
            {header}
          </Cell>
        ))}
      </div>

      {/* Keyed by POSITION, like the receipt's pages: `seqText` is a server string
          and the list never reorders or filters, so the index is the stable key
          and a duplicated sequence number cannot collide silently. */}
      {page.rows.map((row, index) => (
        <Row key={index} row={row} />
      ))}

      {/* Last page only. Earlier pages simply end after their last data row. */}
      {page.showSummary && (
        <>
          {/* The label cell spans columns 0–2 (24 + 52 + 60 = 136px), so the five
              totals below carry the SAME column numbers as the data rows above
              them and line up under المبيعات النقدية / مبيعات الشبكة / إجمالي
              المبيعات / تسويات / المستلم. Change a width in `collection-acr.css`
              and both move. */}
          <div className="acr-tr">
            <div className="acr-td acr-th acr-td--first acr-total-label">الاجمالي</div>
            <Cell col={3} className="acr-money acr-td--bold">
              <Ltr>{form.cashTotalText}</Ltr>
            </Cell>
            <Cell col={4} className="acr-money acr-td--bold">
              <Ltr>{form.cardTotalText}</Ltr>
            </Cell>
            <Cell col={5} className="acr-money acr-td--bold">
              <Ltr>{form.grandTotalText}</Ltr>
            </Cell>
            {/* The first SIGNED money on this form — the LTR island is what keeps a
                leading − or + on the LEFT of its digits under the RTL sheet. */}
            <Cell col={6} className="acr-money acr-td--bold">
              <Ltr>{form.settlementTotalText}</Ltr>
            </Cell>
            <Cell col={7} className="acr-money acr-td--bold">
              <Ltr>{form.bankedTotalText}</Ltr>
            </Cell>
            {/* The WPF's filler — it keeps the run's borders closed. */}
            <div className="acr-td acr-total-filler">&nbsp;</div>
          </div>

          {/* ⚠ THE WPF'S SIDES, not the pad's: ملخص التحصيل on the RIGHT, the
              signature on the LEFT. 247 read the WPF's swap as accidental and went
              back to the pad; the owner ruled the other way on 2026-08-15 looking at
              the two sheets side by side — the POS form is the one the collectors
              already read, so the web one follows it. Under RTL the first child is
              the sheet's right, so the summary is written FIRST here. */}
          <div className="acr-foot">
            {/* THREE rows since 1183, and they read downward as an explanation of
                how the revenue above becomes the cash the collector carries:
                  اجمالي الايرادات      ⚠ MEANING UNCHANGED — sales-only, cash + card,
                                       and settlement never enters it;
                  صافي التسويات         the signed net of the تسويات column;
                  المبلغ المطلوب ايداعه  the counted cash LESS the surplus the branch
                                       kept back — what this collection owes the bank.
                ⚠ That last line read `المبلغ المودع بالبنك` until the 2026-08-15
                sign-off: the collector holds this sheet BEFORE banking anything, so
                the paper states an obligation rather than a completed deposit. The
                FIGURE did not move, and neither did the wire field (`bankedTotalText`).
                Every collector-DEPOSIT mark is still gone (247's amendment 3) — this
                line says what this ACR owes, not where an earlier one was banked. */}
            <div className="acr-summary">
              <div className="acr-td acr-th acr-summary-title">ملخص التحصيل</div>
              <div className="acr-tr">
                <div className="acr-td acr-summary-label">اجمالي الايرادات</div>
                <div className="acr-td acr-summary-value acr-money">
                  <Ltr>{form.revenuesText}</Ltr>
                </div>
              </div>
              <div className="acr-tr">
                <div className="acr-td acr-summary-label">صافي التسويات</div>
                <div className="acr-td acr-summary-value acr-money">
                  <Ltr>{form.settlementTotalText}</Ltr>
                </div>
              </div>
              <div className="acr-tr">
                <div className="acr-td acr-summary-label">المبلغ المطلوب ايداعه</div>
                <div className="acr-td acr-summary-value acr-money">
                  <Ltr>{form.bankedTotalText}</Ltr>
                </div>
              </div>
            </div>

            <div className="acr-foot-gap" />

            <div className="acr-sign">
              {/* `الأسم` with the hamza — the XAML's spelling, kept. */}
              <div className="acr-sign-name">
                <span className="acr-meta-label">الأسم: </span>
                <span>{form.collectorName}</span>
                <span>&nbsp;&nbsp;( </span>
                <span>{form.collectorId}</span>
                <span> )</span>
              </div>
              <div className="acr-sign-line-row">
                <span className="acr-meta-label">التوقيع: </span>
                {/* ALWAYS EMPTY — a wet signature is never printed. */}
                <span className="acr-sign-line">&nbsp;</span>
              </div>
            </div>
          </div>
        </>
      )}
    </PrintSheet>
  )
}

function Row({ row }: { row: AcrRow }) {
  return (
    <div className="acr-tr">
      {/* Read, never counted: the server numbers the rows 1..n over the whole
          form, which is what keeps `م` unbroken across a page break. */}
      <Cell col={0}>{row.seqText}</Cell>
      <Cell col={1}>{row.storeCode}</Cell>
      {/* Per row, and kept: a catch-up ACR carries more than one sales day, and
          the pad's single header date cannot say which row is which. */}
      <Cell col={2}>{row.salesDateText}</Cell>
      {/* 242 §8-O6, answered IN by 247: a shortfall is a negative hand-in and it
          prints in the form's mismatch red. The WPF builds `IsShortfall` and
          binds it nowhere.
          ⚠ The CASH FIGURE reddens, not the whole row. Spec 249 story 77 says
          "a shortfall ROW"; 247's ruling and the variant C that was signed off
          side-by-side against the paper both redden the figure alone, and the
          narrower reading is the one a human actually looked at. Widening it to
          the row is a one-line change if 260's paper proof asks for it. */}
      <Cell col={3} className={row.isShortfall ? 'acr-money acr-mark' : 'acr-money'}>
        <Ltr>{row.cashText}</Ltr>
      </Cell>
      <Cell col={4} className="acr-money">
        <Ltr>{row.cardText}</Ltr>
      </Cell>
      <Cell col={5} className="acr-money acr-td--bold">
        <Ltr>{row.totalText}</Ltr>
      </Cell>
      {/* تسويات — SIGNED, and the `—` on a row with no settlement is the server's
          string too. An LTR island like every money cell, which is what keeps the
          leading − or + on the left of its digits rather than trailing them. */}
      <Cell col={6} className="acr-money">
        <Ltr>{row.settlementText}</Ltr>
      </Cell>
      {/* المستلم — always a real figure, on BOTH kinds of row, and the only reason
          the totals line up down the page. */}
      <Cell col={7} className="acr-money">
        <Ltr>{row.netCollectedText}</Ltr>
      </Cell>
      <Cell col={8}>{row.receiptNoText}</Cell>
      <Cell col={9}>{row.pharmacistName}</Cell>
      <Cell col={10}>{row.pharmacistId}</Cell>
      {/* 242 §8-O5 — the note speaks the form's own language. The English
          `Z report missing` was OUR literal, so 245 §6a moved the fix into
          `AcrFormBuilder`; nothing is translated here. */}
      <Cell col={11} className="acr-notes">
        {row.notes}
      </Cell>
    </div>
  )
}

/* Column 0 is the RTL row's leading cell and closes the run on the sheet's
 * right — the WPF's `1,0,1,1` against every other cell's `0,0,1,1`. */
function Cell({ col, className, children }: { col: number; className?: string; children?: ReactNode }) {
  const classes = ['acr-td', `acr-c${col}`]
  if (col === 0) classes.push('acr-td--first')
  if (className) classes.push(className)
  return <div className={classes.join(' ')}>{children}</div>
}

function Meta({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="acr-meta-cell">
      <span className="acr-meta-label">{label}</span>
      <span className={strong ? 'acr-meta-value--strong' : undefined}>{value}</span>
    </div>
  )
}
