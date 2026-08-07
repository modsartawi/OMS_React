/* PROTOTYPE — throwaway. Wayfinder ticket 246 (map 240).
 *
 * VARIANT B — "As the paper reads."
 *
 * Every place the WPF drifted from `Collection Receipt.jpg` pulled back to the
 * paper. Built by reading the scan, not the XAML — this is what a store
 * supervisor who has handled the pre-printed pad expects to be handed.
 *
 * Differs from A on seven marks, all of them 242 §6.1 / §8 entries:
 *   1. fill-lines are DOT LEADERS, not solid rules
 *   2. `Receiver` and `Pharmacist` restored beside the two name lines   (O3)
 *   3. the English block is uniformly bold — `P.O. Box …` included      (O2)
 *   4. a bare red `PH.` where the WPF prints `Store. {code}`
 *   5. no POSTED banner — the paper had no way to carry that state
 *   6. `بتاريخ  __ / __ / __` slash cells instead of an ISO fill-line
 *   7. no green `مطابق` — the paper has no such mark
 *
 * ⚠ The logo is still the WPF's STACKED `logo-aldawaa.png`. The paper carries
 * the HORIZONTAL lockup (with `care for life / نهتم بالحياة`), which is not an
 * asset either repo ships. Flagged at sign-off rather than faked.
 */
import type { VoucherModel } from './voucher-mock'
import logoUrl from './logo-aldawaa.png'

export const NAME = 'B — the paper, restored'

const RED = '#C00000'
const INK = '#1A1A1A'
const LINE = '#8A8A8A'
const FILL = '#EDEDF2'

const frame: React.CSSProperties = {
  width: 780,
  boxSizing: 'border-box',
  background: '#fff',
  color: INK,
  fontFamily: 'Tahoma, sans-serif',
  fontSize: 12,
  lineHeight: 1.35,
  direction: 'rtl',
  border: `1px solid ${LINE}`,
  padding: '16px 24px',
}

/** The paper's dot leader, not the WPF's solid rule. */
const fillLine: React.CSSProperties = {
  borderBottom: `1px dotted ${LINE}`,
  padding: '0 6px 1px',
  alignSelf: 'flex-end',
  textAlign: 'center',
  minHeight: 17,
}

const cell: React.CSSProperties = {
  background: FILL,
  border: `1px solid ${INK}`,
  padding: '2px 6px',
  fontWeight: 700,
  textAlign: 'center',
  direction: 'ltr',
  boxSizing: 'border-box',
  printColorAdjust: 'exact',
  WebkitPrintColorAdjust: 'exact',
}

const label: React.CSSProperties = { fontWeight: 700, color: INK, alignSelf: 'flex-end' }
const ltr: React.CSSProperties = { direction: 'ltr' }

export default function VariantB({ m }: { m: VoucherModel }) {
  // 6 — the paper's day line is three slash cells, not an ISO date.
  const [yyyy, mm, dd] = m.shiftDayText.split('-')

  return (
    <div style={frame}>
      {/* 5 — no POSTED banner. */}

      {/* Company header. */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
          <div style={{ fontSize: 17, fontWeight: 700 }}>صيدليات الدواء</div>
          <div>س.ت : ٢٠٥١٠١٤٩٤٠/٠٠٢</div>
          <div>هاتف : ٩٢٠٠٠٠٨٣٨</div>
          <div>حي الروابي طريق الملك فهد - ابراج اسمنت الشرقية</div>
          <div>ص.ب ٤٣٢٦ الخبر ٣١٩٥٢</div>
          <div>المملكة العربية السعودية</div>
        </div>

        <img src={logoUrl} alt="" style={{ ...ltr, height: 80, margin: '0 5px', objectFit: 'contain' }} />

        {/* 3 — uniformly bold, `P.O. Box` included. */}
        <div
          style={{
            ...ltr,
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            textAlign: 'left',
            fontWeight: 700,
          }}
        >
          <div style={{ fontSize: 16 }}>Al-Dawaa Pharmacies</div>
          <div>C. R. : 2051014940/002</div>
          <div>Tel. : 920000838</div>
          <div>Al Rawabi District, King Fahd Road, Eastern Cement Towers.</div>
          <div>P.O. Box 4326 Al-Khobar 31952</div>
          <div>Kingdom of Saudi Arabia</div>
        </div>
      </div>

      {/* خصم فائض — the paper's box, on the right, under the Arabic block. */}
      <div style={{ display: 'flex', marginBottom: 10 }}>
        <div
          style={{
            minWidth: 220,
            minHeight: 34,
            border: `1px solid ${RED}`,
            padding: '4px 8px',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <span style={{ color: RED, fontWeight: 700 }}>خصم فائض : </span>
          <span style={{ fontWeight: 700 }}>{m.varianceText}</span>
          {/* 7 — no مطابق mark. */}
        </div>
      </div>

      {/* Title band. 4 — a bare red `PH.` label. */}
      <div style={{ display: 'flex', alignItems: 'flex-start', marginBottom: 10 }}>
        {/* The pad prints these hard against the outer edges, on the subtitle's
            line — not tucked against the centre the way the XAML places them. */}
        <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-start' }}>
          <div style={{ ...ltr, display: 'flex', color: RED, fontSize: 16, fontWeight: 700, marginTop: 20 }}>
            <span>PH.&nbsp;</span>
            <span>{m.storeCode}</span>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ fontSize: 20, fontWeight: 700 }}>سـنـد قـبـض</div>
          <div style={{ fontSize: 14, fontWeight: 700, textDecoration: 'underline' }}>RECEIPT VOUCHER</div>
          <div style={{ ...ltr, display: 'flex', marginTop: 6 }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ textAlign: 'center' }}>
                <b>S.R.</b>
                <span>&nbsp;&nbsp;ريال</span>
              </div>
              <div style={{ ...cell, minWidth: 88 }}>{m.grand.whole}</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', marginLeft: 6 }}>
              <div style={{ textAlign: 'center' }}>
                <b>H.</b>
                <span>&nbsp;&nbsp;هـ</span>
              </div>
              <div style={{ ...cell, minWidth: 44 }}>{m.grand.minor}</div>
            </div>
          </div>
        </div>

        <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end' }}>
          <div style={{ ...ltr, display: 'flex', color: RED, fontSize: 16, fontWeight: 700, marginTop: 20 }}>
            <span>No.&nbsp;</span>
            <span>{m.noText}</span>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'flex-end' }}>
          <span style={label}>التاريخ&nbsp;</span>
          <div style={{ ...fillLine, minWidth: 140 }}>{m.collectedAtText}</div>
          <span style={label}>&nbsp;Date</span>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-end', marginBottom: 12 }}>
        <span style={label}>استلمت أنا/&nbsp;</span>
        <div style={{ ...fillLine, flex: 1, fontWeight: 700 }}>{m.collectorName}</div>
        <span style={{ ...label, ...ltr }}>&nbsp;Receiver Name /</span>
      </div>

      <MoneyRow parts={m.cash} arabic="نقدا - مبلغ وقدره " words={m.cashWords} english=" Cash - The Sum of" />
      <MoneyRow parts={m.card} arabic="شبكة - مبلغ وقدره " words={m.cardWords} english=" Bank - The Sum of" />

      {/* 6 — the paper's slash cells. */}
      <div style={{ display: 'flex', alignItems: 'flex-end', marginBottom: 18 }}>
        <span style={label}>وذلك عن يوم&nbsp;</span>
        <div style={{ ...fillLine, flex: 1 }}>{m.shiftDayName}</div>
        <span style={label}>&nbsp;بتاريخ&nbsp;</span>
        <div style={{ ...ltr, display: 'flex', alignItems: 'flex-end', gap: 4 }}>
          <div style={{ ...fillLine, minWidth: 34 }}>{dd}</div>
          <span style={label}>/</span>
          <div style={{ ...fillLine, minWidth: 34 }}>{mm}</div>
          <span style={label}>/</span>
          <div style={{ ...fillLine, minWidth: 48 }}>{yyyy}</div>
        </div>
        <span style={label}>&nbsp;Date&nbsp;&nbsp;This For Day of</span>
      </div>

      {/* Name blocks. 2 — the English words restored. */}
      <div style={{ display: 'flex' }}>
        <NameBlock
          nameLabel="اسم المحصل : "
          name={m.collectorName}
          english="Receiver"
          idLabel="الرقم الوظيفي : "
          id={m.collectorId}
        />
        <div style={{ width: 24, flex: '0 0 24px' }} />
        <NameBlock
          nameLabel="اسم الصيدلي : "
          name={m.pharmacistName}
          english="Pharmacist"
          idLabel="الرقم الوظيفي : "
          id={m.pharmacistId}
        />
      </div>
    </div>
  )
}

function MoneyRow({
  parts,
  arabic,
  words,
  english,
}: {
  parts: { whole: string; minor: string }
  arabic: string
  words: string
  english: string
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', marginBottom: 12 }}>
      <div style={{ ...ltr, display: 'flex', alignSelf: 'flex-end', marginLeft: 8 }}>
        <div style={{ ...cell, minWidth: 70 }}>{parts.whole}</div>
        <div style={{ ...cell, minWidth: 40, marginLeft: 2 }}>{parts.minor}</div>
      </div>
      <span style={label}>{arabic}</span>
      <div style={{ ...fillLine, flex: 1 }}>{words}</div>
      <span style={label}>{english}</span>
    </div>
  )
}

function NameBlock({
  nameLabel,
  name,
  english,
  idLabel,
  id,
}: {
  nameLabel: string
  name: string
  english: string
  idLabel: string
  id: string
}) {
  return (
    <div style={{ flex: 1 }}>
      <div style={{ display: 'flex', alignItems: 'flex-end' }}>
        <span style={label}>{nameLabel}</span>
        <div style={{ ...fillLine, flex: 1, fontWeight: 700 }}>{name}</div>
        <span style={{ ...label, ...ltr }}>&nbsp;{english}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', marginTop: 6 }}>
        <span style={label}>{idLabel}</span>
        <div style={{ ...fillLine, flex: 1 }}>{id}</div>
      </div>
    </div>
  )
}
