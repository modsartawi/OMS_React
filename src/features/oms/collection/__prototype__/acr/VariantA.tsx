/* PROTOTYPE — throwaway. Wayfinder ticket 247 (map 240).
 *
 * VARIANT A — "the WPF, as it stands." The control ported mark for mark:
 * `Sartawi.Retail\OMS\AcrInquiry\AcrFormControl.xaml`, at its own widths, with
 * its own dropped furniture still dropped and its own loose ends still loose.
 *
 * It is the pole the sign-off measures from — "matches the WPF" in the literal
 * sense — and it deliberately carries the four things 242 §8 flagged rather than
 * quietly fixing them, so the user sees what is actually being chosen:
 *   · O5  the notes column prints `Z report missing` — English, in an Arabic form
 *   · O6  the shortfall row (row 18, negative cash) gets NO warning style
 *   · O7  `رقم الإيداع` / deposit status are on the model and rendered nowhere
 *   · O8  the mark is al-dawaa; the paper beside it is DMSCO
 * and O9's dropped paper furniture (الموافق, the 18 ruled rows, the three
 * difference rows, سبب الفرق, both instruction blocks) stays dropped.
 */
import type { AcrModel, AcrRow } from './acr-mock'
import { paginate, pageText } from './acr-mock'
import Sheet from './Sheet'
import logoUrl from './logo-aldawaa.png'

export const NAME = 'A — the WPF as it stands'
export const ROWS_PER_PAGE = 22

const INK = '#1A1A1A'
const LINE = '#8A8A8A'
const HEAD = '#EDEDF2'
const MARK = '#B00020'

// 242 §4 band 3 — eleven fixed widths, right to left. The last is `*`: 738px of
// inner width (780 − 2×20 padding − 2×1 border) less 624px of fixed columns.
const W = [26, 58, 68, 66, 66, 70, 56, 44, 108, 62, 114]

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

// The XAML's labels carry a TRAILING SPACE ('عن يوم: ') and HTML collapses it.
const metaLabel: React.CSSProperties = { fontWeight: 700, whiteSpace: 'pre' }

/* WPF's Cell/HeadCell collapse the grid by drawing, on every cell, its trailing
   vertical edge — the first column then closes the run on the outer side. Under
   the RTL root that reads as `inline-end` everywhere + `inline-start` on col 0. */
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
  printColorAdjust: 'exact',
  WebkitPrintColorAdjust: 'exact',
})

const dataCell = (i: number): React.CSSProperties => ({ ...cellBase(i), fontSize: 10 })

const HEADERS = [
  'م',
  'رقم الصيدلية',
  'تاريخ اليوم',
  'المبيعات النقدية',
  'مبيعات الشبكة',
  'إجمالي المبيعات',
  'رقم سند القبض',
  'مطابقة الكاش والشبكة',
  'اسم الصيدلي',
  'رقم المشغل',
  'ملاحظات',
]

export default function VariantA({ m }: { m: AcrModel }) {
  const pages = paginate(m.rows, ROWS_PER_PAGE)
  let seq = 0
  return (
    <>
      {pages.map((rows, i) => {
        const from = seq
        seq += rows.length
        return (
          <Page
            key={i}
            m={m}
            rows={rows}
            firstSeq={from}
            stamp={pageText(i, pages.length)}
            showSummary={i === pages.length - 1}
          />
        )
      })}
    </>
  )
}

function Page({
  m,
  rows,
  firstSeq,
  stamp,
  showSummary,
}: {
  m: AcrModel
  rows: AcrRow[]
  firstSeq: number
  stamp: string
  showSummary: boolean
}) {
  return (
    <Sheet>
    <div style={page}>
      {/* Band 0 — logo right, title centred, page stamp left. */}
      <div style={{ display: 'flex', alignItems: 'flex-start', marginBottom: 8 }}>
        <div style={{ flex: `0 0 120px`, display: 'flex', justifyContent: 'flex-start' }}>
          <img src={logoUrl} alt="" style={{ direction: 'ltr', maxHeight: 42, objectFit: 'contain' }} />
        </div>
        <div style={{ flex: 1, alignSelf: 'center', textAlign: 'center', fontSize: 13, fontWeight: 700 }}>
          نموذج متابعة المبيعات النقدية ومبيعات الشبكة بالصيدليات
        </div>
        <div style={{ flex: `0 0 120px`, textAlign: 'end', fontSize: 10 }}>صفحة {stamp}</div>
      </div>

      {/* Bands 1 + 2 — the two meta strips, three equal columns each. */}
      <div style={{ display: 'flex', marginBottom: 2 }}>
        <Meta label="عن يوم: " value={m.acrDateText} />
        <div style={{ flex: 1, display: 'flex' }}>
          <span style={metaLabel}>نموذج رقم ( </span>
          <span style={{ fontWeight: 700 }}>{m.acrNumberText}</span>
          <span style={metaLabel}> )</span>
        </div>
        <Meta label="المنطقة: " value={m.areas} />
      </div>
      <div style={{ display: 'flex', marginBottom: 8 }}>
        <Meta label="تاريخ التحصيل: " value={m.closedAtText} />
        <Meta label="الوصف: " value={m.label} />
        <Meta label="الحالة: " value={m.status} />
      </div>

      {/* Band 3 — the header row, on EVERY page (each page is a fresh control). */}
      <div style={{ display: 'flex' }}>
        {HEADERS.map((h, i) => (
          <div key={i} style={headCell(i)}>
            {h}
          </div>
        ))}
      </div>

      {/* Band 4 — this page's slice. */}
      {rows.map((r, i) => (
        <div key={i} style={{ display: 'flex' }}>
          <div style={dataCell(0)}>{String(firstSeq + i + 1)}</div>
          <div style={dataCell(1)}>{r.storeCode}</div>
          <div style={dataCell(2)}>{r.salesDateText}</div>
          <div style={dataCell(3)}>{r.cashText}</div>
          <div style={dataCell(4)}>{r.cardText}</div>
          <div style={{ ...dataCell(5), fontWeight: 700 }}>{r.totalText}</div>
          <div style={dataCell(6)}>{r.receiptNoText}</div>
          <div style={{ ...dataCell(7), fontWeight: 700, color: MARK }}>{r.matchText}</div>
          <div style={dataCell(8)}>{r.pharmacistName}</div>
          <div style={dataCell(9)}>{r.operatorId}</div>
          <div style={{ ...dataCell(10), fontSize: 9 }}>{r.notes}</div>
        </div>
      ))}

      {showSummary && (
        <>
          {/* Band 5 — الاجمالي, its money columns aligned with data columns 3–5. */}
          <div style={{ display: 'flex' }}>
            <div
              style={{
                ...headCell(0),
                flex: `0 0 152px`,
                borderTop: 'none',
                borderInlineStart: `1px solid ${LINE}`,
              }}
            >
              الاجمالي
            </div>
            <div style={{ ...dataCell(3), fontWeight: 700 }}>{m.cashTotalText}</div>
            <div style={{ ...dataCell(4), fontWeight: 700 }}>{m.cardTotalText}</div>
            <div style={{ ...dataCell(5), fontWeight: 700 }}>{m.grandTotalText}</div>
            <div style={{ ...dataCell(10), flex: 1 }}>&nbsp;</div>
          </div>

          {/* Band 6 — ملخص التحصيل (340) · gutter (20) · signature block. */}
          <div style={{ display: 'flex', marginTop: 12 }}>
            <div style={{ flex: `0 0 340px` }}>
              <div style={{ ...headCell(0), flex: 'none', borderTop: `1px solid ${LINE}` }}>ملخص التحصيل</div>
              <SummaryRow label="اجمالي الايرادات" value={m.revenuesText} />
              <SummaryRow label="اجمالي ايداع المحصل" value={m.depositText} bold />
            </div>
            <div style={{ flex: `0 0 20px` }} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
              <div style={{ display: 'flex', marginBottom: 10 }}>
                <span style={metaLabel}>الأسم: </span>
                <span>{m.collectorName}</span>
                <span>&nbsp;&nbsp;( </span>
                <span>{m.collectorId}</span>
                <span> )</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                <span style={metaLabel}>التوقيع: </span>
                <span style={{ width: 180, borderBottom: `1px solid ${LINE}` }}>&nbsp;</span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
    </Sheet>
  )
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ flex: 1, display: 'flex' }}>
      <span style={metaLabel}>{label}</span>
      <span>{value}</span>
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
          justifyContent: 'flex-start',
          textAlign: 'start',
          borderInlineStart: `1px solid ${LINE}`,
          fontWeight: bold ? 700 : 400,
        }}
      >
        {label}
      </div>
      <div style={{ ...dataCell(0), flex: 1, fontWeight: bold ? 700 : 400 }}>{value}</div>
    </div>
  )
}
