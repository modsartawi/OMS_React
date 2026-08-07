/* PROTOTYPE — throwaway. Wayfinder ticket 247 (map 240).
 *
 * VARIANT B — "the pad restored." The other pole: the paper original
 * (`Scanned Document 4.pdf`, rendered beside this route) taken as the authority,
 * with the system's figures typed into it. Everything 242 §6.2 found the WPF had
 * dropped is back:
 *   · `الموافق` — the Hijri companion date, in meta row 1 where the pad has it
 *   · the pad's own meta ORDER (تاريخ التحصيل / نموذج رقم / المنطقة on row 2)
 *   · the pad's TEN columns — no `تاريخ اليوم`, and `توقيع الصيدلي` back in
 *     place of `رقم المشغل`
 *   · exactly 18 pre-ruled rows a page, blank ones included
 *   · the five-row `ملخص التحصيل` with the two difference rows, the remainder
 *     row, and the `سبب الفرق` box beneath — the three of them hand-fill, because
 *     no server field feeds them
 *   · both prose blocks: `تعليمات عامه` and `خطوات مراجعة الصيدلي`
 *   · the summary on the LEFT and the signature on the RIGHT, as the pad lays
 *     them out (the WPF swapped the two)
 *   · the DMSCO mark, not al-dawaa — §8-O8
 *   · NO page stamp, because a single-sheet pad never needed one. On a
 *     three-page render that is B's own bill: the sheets are unidentifiable.
 *
 * The instruction text is transcribed BY EYE off the scan (the source PDF has no
 * text layer). Treat it as approximate until someone with the paper checks it.
 */
import type { AcrModel, AcrRow } from './acr-mock'
import { paginate } from './acr-mock'
import Sheet from './Sheet'

export const NAME = 'B — the pad restored'
export const ROWS_PER_PAGE = 18

const INK = '#1A1A1A'
const LINE = '#8A8A8A'
const HEAD = '#EDEDF2'
const MARK = '#B00020'

// The pad's ten columns, right to left. 738px inner width less 630px fixed.
const W = [26, 58, 70, 70, 74, 56, 46, 150, 80, 108]

const HEADERS = [
  'م',
  'رقم الصيدلية',
  'المبيعات النقدية',
  'مبيعات الشبكة',
  'إجمالي المبيعات',
  'رقم سند القبض',
  'مطابقة الكاش والشبكة',
  'اسم الصيدلي',
  'توقيع الصيدلي',
  'ملاحظات',
]

const GENERAL = [
  'يمنع منعاً باتاً تسليم إيراد اليوم إلا بعد الاطلاع على قسيمة الإيداع ونموذج متابعة المبيعات المجمع لليوم السابق له مباشرة.',
  'لا يتم تسليم الإيراد للمحصل إلا بعد التأكد من عمل ترحيل للمبيعات على النظام Cash Clearance.',
]

const STEPS = [
  'التأكد من قيمة المبيعات النقدية الخاصة بالصيدلية التي يعمل بها والمسلمة للمحصل وتكون مطابقة للمسجل بسند القبض.',
  'يتم مطابقة مبلغ الشبكة في الموازنة مع المبلغ في مختصر العمليات، وفي حالة عدم التطابق يتم مراجعة القصاصات وكتابة قيمتها بسند القبض.',
  'يكتب عدد القصاصات على سند القبض.',
  'التأكد من تطابق إجمالي المبيعات بالنموذج المجمع مع المبلغ المودع في قسيمة الإيداع.',
  'يتم كتابة اسم الصيدلي بالكامل منفصلاً عن التوقيع.',
  'في حالة وجود أي ملاحظات أو اختلافات تسجل في خانة الملاحظات.',
  'بعد القيام بالخطوات السابقة يتم تسليم إيراد اليوم الجديد للمحصل.',
]

const page: React.CSSProperties = {
  width: 780,
  boxSizing: 'border-box',
  background: '#fff',
  color: INK,
  fontFamily: 'Tahoma, sans-serif',
  fontSize: 11,
  lineHeight: 1.3,
  direction: 'rtl',
  border: `1px solid ${LINE}`,
  padding: '14px 20px',
}

const cellBase = (i: number): React.CSSProperties => ({
  flex: `0 0 ${W[i]}px`,
  boxSizing: 'border-box',
  padding: '2px 3px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  textAlign: 'center',
  // WPF's TextWrapping="Wrap" breaks at WORD boundaries; 'anywhere' shears
  // مطابقة الكاش والشبكة into four lines with a lone ة on the last.
  overflowWrap: 'break-word',
  borderInlineEnd: `1px solid ${LINE}`,
  borderBottom: `1px solid ${LINE}`,
  ...(i === 0 ? { borderInlineStart: `1px solid ${LINE}` } : null),
})

const headCell = (i: number): React.CSSProperties => ({
  ...cellBase(i),
  background: HEAD,
  borderTop: `1px solid ${LINE}`,
  fontWeight: 700,
  fontSize: 10,
  minHeight: 40,
  printColorAdjust: 'exact',
  WebkitPrintColorAdjust: 'exact',
})

// The pad's rows are RULED, so an empty one still has to occupy its height.
const dataCell = (i: number): React.CSSProperties => ({ ...cellBase(i), fontSize: 10, minHeight: 19 })

// The XAML's labels carry a TRAILING SPACE ('عن يوم: ') and HTML collapses it.
const metaLabel: React.CSSProperties = { fontWeight: 700, whiteSpace: 'pre' }

export default function VariantB({ m }: { m: AcrModel }) {
  const pages = paginate(m.rows, ROWS_PER_PAGE)
  let seq = 0
  return (
    <>
      {pages.map((rows, i) => {
        const from = seq
        seq += rows.length
        return <Page key={i} m={m} rows={rows} firstSeq={from} showSummary={i === pages.length - 1} />
      })}
    </>
  )
}

function Page({
  m,
  rows,
  firstSeq,
  showSummary,
}: {
  m: AcrModel
  rows: AcrRow[]
  firstSeq: number
  showSummary: boolean
}) {
  // The pad rules 18 lines whether or not there are 18 collections.
  const ruled = [...rows, ...Array(Math.max(0, ROWS_PER_PAGE - rows.length)).fill(null)] as (AcrRow | null)[]

  return (
    <Sheet>
    <div style={page}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 10 }}>
        <div style={{ flex: `0 0 150px`, display: 'flex', justifyContent: 'flex-start' }}>
          {/* The DMSCO mark exists in neither repo — 246 found the same gap for
              the receipt's horizontal al-dawaa lockup. Drawn as a placeholder
              rather than faked, so the sign-off argues about the RIGHT mark
              instead of about this stand-in. */}
          <div
            style={{
              direction: 'ltr',
              border: `1px dashed ${LINE}`,
              padding: '4px 10px',
              textAlign: 'center',
              fontSize: 15,
              fontWeight: 700,
              letterSpacing: '.14em',
            }}
          >
            DMSCO
            <div style={{ fontSize: 7, fontWeight: 400, letterSpacing: 0, color: LINE }}>mark not held in any repo</div>
          </div>
        </div>
        <div style={{ flex: 1, textAlign: 'center', fontSize: 13, fontWeight: 700 }}>
          نموذج متابعة المبيعات النقدية ومبيعات الشبكة بالصيدليات
        </div>
        <div style={{ flex: `0 0 150px` }} />
      </div>

      {/* Meta, in the PAD's order and pairing. */}
      <div style={{ display: 'flex', marginBottom: 4 }}>
        <div style={{ flex: 1, display: 'flex' }}>
          <span style={metaLabel}>عن يوم&nbsp;</span>
          <span style={{ minWidth: 90, borderBottom: `1px solid ${LINE}` }}>{m.acrDateText}</span>
        </div>
        <div style={{ flex: 1, display: 'flex' }}>
          <span style={metaLabel}>الموافق :&nbsp;</span>
          <span>{m.hijriText}</span>
        </div>
        <div style={{ flex: 1 }} />
      </div>
      <div style={{ display: 'flex', marginBottom: 6 }}>
        <div style={{ flex: 1, display: 'flex' }}>
          <span style={metaLabel}>تاريخ التحصيل:&nbsp;</span>
          <span>{m.closedAtText || ' /  / '}</span>
        </div>
        <div style={{ flex: 1, display: 'flex' }}>
          <span style={metaLabel}>نموذج رقم (&nbsp;</span>
          <span style={{ fontWeight: 700 }}>{m.acrNumberText}</span>
          <span style={metaLabel}>&nbsp;)</span>
        </div>
        <div style={{ flex: 1, display: 'flex' }}>
          <span style={metaLabel}>المنطقة :&nbsp;</span>
          <span>{m.areas}</span>
        </div>
      </div>

      <div style={{ display: 'flex' }}>
        {HEADERS.map((h, i) => (
          <div key={i} style={headCell(i)}>
            {h}
          </div>
        ))}
      </div>

      {ruled.map((r, i) => (
        <div key={i} style={{ display: 'flex' }}>
          <div style={dataCell(0)}>{String(firstSeq + i + 1)}</div>
          <div style={dataCell(1)}>{r?.storeCode ?? ''}</div>
          <div style={dataCell(2)}>{r?.cashText ?? ''}</div>
          <div style={dataCell(3)}>{r?.cardText ?? ''}</div>
          <div style={{ ...dataCell(4), fontWeight: 700 }}>{r?.totalText ?? ''}</div>
          <div style={dataCell(5)}>{r?.receiptNoText ?? ''}</div>
          <div style={{ ...dataCell(6), fontWeight: 700, color: MARK }}>{r?.matchText ?? ''}</div>
          <div style={dataCell(7)}>{r?.pharmacistName ?? ''}</div>
          {/* Hand-fill, always: a wet signature per row is what the pad is for. */}
          <div style={dataCell(8)} />
          <div style={{ ...dataCell(9), fontSize: 9 }}>{r?.notes ?? ''}</div>
        </div>
      ))}

      {showSummary && (
        <>
          <div style={{ display: 'flex' }}>
            <div style={{ ...dataCell(0), flex: `0 0 84px`, fontWeight: 700 }}>الاجمالي</div>
            <div style={{ ...dataCell(2), fontWeight: 700 }}>{m.cashTotalText}</div>
            <div style={{ ...dataCell(3), fontWeight: 700 }}>{m.cardTotalText}</div>
            <div style={{ ...dataCell(4), fontWeight: 700 }}>{m.grandTotalText}</div>
            <div style={{ ...dataCell(9), flex: 1 }}>&nbsp;</div>
          </div>

          {/* The pad's own arrangement: signature top-right, summary bottom-left,
              instructions filling the right column beneath the signature. */}
          <div style={{ display: 'flex', marginTop: 10, gap: 16 }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', marginBottom: 6 }}>
                <span style={metaLabel}>الأسم :&nbsp;</span>
                <span style={{ flex: 1, borderBottom: `1px solid ${LINE}` }}>{m.collectorName}</span>
              </div>
              <div style={{ display: 'flex', marginBottom: 10 }}>
                <span style={metaLabel}>التوقيع :&nbsp;</span>
                <span style={{ flex: 1, borderBottom: `1px solid ${LINE}` }}>&nbsp;</span>
              </div>
              <Prose title="تعليمات عامه :" items={GENERAL} />
              <Prose title="خطوات مراجعة الصيدلي :" items={STEPS} />
            </div>

            <div style={{ flex: `0 0 340px` }}>
              <div style={{ ...headCell(0), flex: 'none', minHeight: 0 }}>ملخص التحصيل</div>
              <SummaryRow label="اجمالي الايرادات" value={m.revenuesText} />
              {/* No server field feeds these three — on the pad they are written
                  by hand, and restoring them restores the hand-fill with them. */}
              <SummaryRow label="اجمالي فرق ( العجز ) المستلم +" value="" />
              <SummaryRow label="اجمالي فرق ( الفائض ) المخصوم -" value="" />
              <SummaryRow label="اجمالي ايداع المحصل" value={m.depositText} bold />
              <SummaryRow label="الفرق ( المتبقي او الزائد )" value="" />
              <div style={{ display: 'flex', marginTop: 8 }}>
                <div style={{ ...dataCell(0), flex: `0 0 120px`, minHeight: 34, fontWeight: 700 }}>سبب الفرق</div>
                <div style={{ ...dataCell(0), flex: 1, minHeight: 34 }} />
              </div>
            </div>
          </div>
        </>
      )}
    </div>
    </Sheet>
  )
}

function Prose({ title, items }: { title: string; items: string[] }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ fontWeight: 700, textDecoration: 'underline', fontSize: 10, marginBottom: 2 }}>{title}</div>
      {items.map((line, i) => (
        <div key={i} style={{ fontSize: 9, lineHeight: 1.5 }}>
          {i + 1}. {line}
        </div>
      ))}
    </div>
  )
}

function SummaryRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div style={{ display: 'flex' }}>
      <div
        style={{
          ...dataCell(0),
          flex: `0 0 220px`,
          minHeight: 24,
          borderInlineStart: `1px solid ${LINE}`,
          fontWeight: bold ? 700 : 400,
        }}
      >
        {label}
      </div>
      <div style={{ ...dataCell(0), flex: 1, minHeight: 24, fontWeight: bold ? 700 : 400 }}>{value}</div>
    </div>
  )
}
