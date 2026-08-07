/* PROTOTYPE — throwaway. Wayfinder ticket 247 (map 240).
 *
 * VARIANT C — "the web's reading." The recommendation.
 *
 * The same rule ticket 246 settled the receipt with, applied to a document that
 * is a RESHAPE rather than a facsimile (242 §6.2), so it has far more departures
 * to sort: where the WPF left the pad because it KNOWS something the pad could
 * not, keep the departure; where it left by accident or omission, go back to the
 * pad.
 *
 *   kept from the WPF — real gains the pad could not carry
 *     · `تاريخ اليوم` per row: a catch-up ACR collects more than one sales day,
 *       and the pad's single header date cannot say which row is which
 *     · `رقم المشغل` in place of `توقيع الصيدلي`: the system knows who closed
 *       the shift, so a wet-signature column would be a hand-fill slot on a
 *       printed record — 246's `Store. {code}` ruling, again
 *     · no 18 pre-ruled rows: ruled lines exist to be written on
 *     · the `صفحة n / m` stamp: the pad was one sheet; this prints three
 *     · the three difference rows + `سبب الفرق` stay dropped — the only paper
 *       furniture dropped for a STATED reason (the difference lives on the Z
 *       record, not on the collector's form)
 *
 *   back to the pad — accidents and omissions
 *     · `الموافق`, the Hijri companion date, restored beside `عن يوم`: the pad
 *       carries it, and the server can compute it (242 §7.6 already pins an
 *       Umm al-Qura culture), so it costs one model field, not a hand-fill
 *     · `ملخص التحصيل` back on the LEFT with the signature on the RIGHT, as the
 *       pad lays them out; the WPF swapped the two for no stated reason
 *
 *   the four loose ends 242 §8 left, answered
 *     · O5 the notes column speaks Arabic — `تقرير Z غير مُرحّل`. The literal is
 *       OURS, produced by our builder; passing it through as "server data" is a
 *       technicality, not an answer. The fix belongs in `AcrFormBuilder`.
 *     · O6 `IsShortfall` earns its warning style: a negative cash figure prints
 *       in the same `#B00020` the mismatch mark uses. It is built, documented,
 *       and bound by nobody today.
 *     · O7 `رقم الإيداع` + `الحالة` of the deposit join meta row 2. The ACR's
 *       banking fate is precisely what a supervisor opens this screen to ask,
 *       and both fields are already on the model.
 *     · O8 UNRESOLVED — this renders al-dawaa, as the WPF does. See the ticket:
 *       which mark, and in which lockup, is one decision shared with the receipt.
 */
import type { AcrModel, AcrRow } from './acr-mock'
import { paginate, pageText } from './acr-mock'
import Sheet from './Sheet'
import logoUrl from './logo-aldawaa.png'

export const NAME = 'C — the web’s reading (recommended)'
export const ROWS_PER_PAGE = 22

const INK = '#1A1A1A'
const LINE = '#8A8A8A'
const HEAD = '#EDEDF2'
const MARK = '#B00020'

const W = [26, 58, 68, 66, 66, 70, 56, 44, 108, 62, 114]

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

/* A money cell is an LTR ISLAND — 242 §1.1's trap, one place further than the
   inventory looked. Under the RTL parent a negative figure renders `412.50-`,
   with the sign trailing, because the minus is a neutral character and bidi
   resolves it to the paragraph direction. WPF does exactly the same thing, so
   this is a divergence from the WPF that goes back to what the number MEANS. */
const moneyCell = (i: number): React.CSSProperties => ({ ...dataCell(i), direction: 'ltr' })

export default function VariantC({ m }: { m: AcrModel }) {
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
      <div style={{ display: 'flex', alignItems: 'flex-start', marginBottom: 8 }}>
        <div style={{ flex: `0 0 120px`, display: 'flex', justifyContent: 'flex-start' }}>
          <img src={logoUrl} alt="" style={{ direction: 'ltr', maxHeight: 42, objectFit: 'contain' }} />
        </div>
        <div style={{ flex: 1, alignSelf: 'center', textAlign: 'center', fontSize: 13, fontWeight: 700 }}>
          نموذج متابعة المبيعات النقدية ومبيعات الشبكة بالصيدليات
        </div>
        <div style={{ flex: `0 0 120px`, textAlign: 'end', fontSize: 10 }}>صفحة {stamp}</div>
      </div>

      {/* Meta row 1 — the WPF's, with the pad's `الموافق` restored beside عن يوم. */}
      <div style={{ display: 'flex', marginBottom: 2 }}>
        <Meta label="عن يوم: " value={m.acrDateText} />
        <Meta label="الموافق: " value={m.hijriText} />
        <div style={{ flex: 1, display: 'flex' }}>
          <span style={metaLabel}>نموذج رقم ( </span>
          <span style={{ fontWeight: 700 }}>{m.acrNumberText}</span>
          <span style={metaLabel}> )</span>
        </div>
        <Meta label="المنطقة: " value={m.areas} />
      </div>

      {/* Meta row 2 — with the deposit's fate, which the WPF built and never bound. */}
      <div style={{ display: 'flex', marginBottom: 8 }}>
        <Meta label="تاريخ التحصيل: " value={m.closedAtText} />
        <Meta label="الوصف: " value={m.label} />
        <Meta label="الحالة: " value={m.status} />
        <Meta label="رقم الإيداع: " value={m.depositNumberText || m.depositStatus} />
      </div>

      <div style={{ display: 'flex' }}>
        {HEADERS.map((h, i) => (
          <div key={i} style={headCell(i)}>
            {h}
          </div>
        ))}
      </div>

      {rows.map((r, i) => (
        <div key={i} style={{ display: 'flex' }}>
          <div style={dataCell(0)}>{String(firstSeq + i + 1)}</div>
          <div style={dataCell(1)}>{r.storeCode}</div>
          <div style={dataCell(2)}>{r.salesDateText}</div>
          {/* O6 — a shortfall is a negative hand-in, and it prints as a warning. */}
          <div style={{ ...moneyCell(3), ...(r.isShortfall ? { color: MARK, fontWeight: 700 } : null) }}>
            {r.cashText}
          </div>
          <div style={moneyCell(4)}>{r.cardText}</div>
          <div style={{ ...moneyCell(5), fontWeight: 700 }}>{r.totalText}</div>
          <div style={dataCell(6)}>{r.receiptNoText}</div>
          <div style={{ ...dataCell(7), fontWeight: 700, color: MARK }}>{r.matchText}</div>
          <div style={dataCell(8)}>{r.pharmacistName}</div>
          <div style={dataCell(9)}>{r.operatorId}</div>
          {/* O5 — the note in the form's own language. */}
          <div style={{ ...dataCell(10), fontSize: 9 }}>{r.notesAr}</div>
        </div>
      ))}

      {showSummary && (
        <>
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
            <div style={{ ...moneyCell(3), fontWeight: 700 }}>{m.cashTotalText}</div>
            <div style={{ ...moneyCell(4), fontWeight: 700 }}>{m.cardTotalText}</div>
            <div style={{ ...moneyCell(5), fontWeight: 700 }}>{m.grandTotalText}</div>
            <div style={{ ...dataCell(10), flex: 1 }}>&nbsp;</div>
          </div>

          {/* The pad's arrangement restored: signature right, summary left. */}
          <div style={{ display: 'flex', marginTop: 12 }}>
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
            <div style={{ flex: `0 0 20px` }} />
            <div style={{ flex: `0 0 340px` }}>
              <div style={{ ...headCell(0), flex: 'none' }}>ملخص التحصيل</div>
              <SummaryRow label="اجمالي الايرادات" value={m.revenuesText} />
              <SummaryRow label="اجمالي ايداع المحصل" value={m.depositText} bold />
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
