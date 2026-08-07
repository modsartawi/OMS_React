/* PROTOTYPE — throwaway. Wayfinder ticket 246 (map 240).
 *
 * VARIANT C — "The web's own reading." The recommendation.
 *
 * The reconciliation A and B are the poles of. The rule it applies: where the
 * WPF departed from the paper for a REASON — it knows something the blank pad
 * could not — keep the departure; where it departed by ACCIDENT or by omission,
 * go back to the paper.
 *
 *   kept from the paper (accidents / omissions)
 *     · dot-leader fill-lines — the pad's own texture, and free in CSS
 *     · `Receiver` / `Pharmacist` restored beside the names          (O3 → yes)
 *     · English block uniformly bold, `P.O. Box …` included          (O2 → bold)
 *     · the خصم فائض box on the RIGHT, `No.` LEFT, date line RIGHT   (O1 → paper)
 *
 *   kept from the WPF (real gains the paper could not carry)
 *     · the green POSTED banner — a state that only exists once collection posts
 *     · `Store. {code}` over a bare `PH.` — the web always knows the store,
 *       so leaving a hand-fill slot would be a regression
 *     · ISO `yyyy-MM-dd` over the pad's `__/__/__` cells — this is a printed
 *       system record, nothing on it is hand-written
 *
 *   left open for the sign-off
 *     · `مطابق` is rendered here, but 242 §8-O4 shows it can NEVER fire on the
 *       HQ path the web reads (`FromInquiryRow` leaves the rounding flags
 *       false). Either it is dead markup on the web, or ticket 245's model must
 *       carry `CashRoundingMatched` / `Absorbed`. The user decides; 245 absorbs.
 */
import type { VoucherModel } from './voucher-mock'
import logoUrl from './logo-aldawaa.png'

export const NAME = 'C — the web’s reading (recommended)'

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

export default function VariantC({ m }: { m: VoucherModel }) {
  return (
    <div style={frame}>
      {/* SIGNED OFF 246 — no POSTED banner. `No.` IS the posted state: a receipt
          that took a number is posted, so a green band restating it is chrome the
          paper never had and the form does not need. `isPosted` therefore leaves
          the print-ready model (ticket 245). An unposted receipt is still legible
          as one — `NoText` renders `—`. */}

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
          {/* SIGNED OFF 246 — wraps. Held on one line it runs into the logo,
              which is worse than the extra line the WPF already lives with. */}
          <div>Al Rawabi District, King Fahd Road, Eastern Cement Towers.</div>
          <div>P.O. Box 4326 Al-Khobar 31952</div>
          <div>Kingdom of Saudi Arabia</div>
        </div>
      </div>

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
          {/* SIGNED OFF 246 — the box is ALWAYS EMPTY, exactly as the pad prints
              it: red label, ruled box, nothing inside. It is a hand-fill slot,
              not an output field.

              This is the map's answer to 242 §8-O4, and it answers it wider than
              the question was asked. `مطابق` was only ever a POS artifact (the
              HQ path leaves the rounding flags false), so the web could not have
              rendered it — but `VarianceText` goes with it. Neither
              `varianceText` nor `matchedMarkText` nor the `CashRounding` flags
              need to reach the browser, so ticket 245's model carries NONE of
              them and the endpoint owes no reconciliation data at all. */}
          <span style={{ color: RED, fontWeight: 700 }}>خصم فائض : </span>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-start', marginBottom: 10 }}>
        {/* O1 → paper. `flex-start` under RTL is the OUTER right edge; the XAML's
            `HorizontalAlignment="Right"` puts this run against the centre
            instead, which the pad does not do. Same, mirrored, for `No.` below.
            Dropped to the subtitle's line, where the pad prints them. */}
        <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-start' }}>
          <div style={{ ...ltr, display: 'flex', color: RED, fontSize: 16, fontWeight: 700, marginTop: 20 }}>
            <span>Store.&nbsp;</span>
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

      <div style={{ display: 'flex', alignItems: 'flex-end', marginBottom: 18 }}>
        <span style={label}>وذلك عن يوم&nbsp;</span>
        <div style={{ ...fillLine, flex: 1 }}>{m.shiftDayName}</div>
        <span style={label}>&nbsp;بتاريخ / Date&nbsp;</span>
        <div style={{ ...fillLine, flex: 1 }}>{m.shiftDayText}</div>
        <span style={label}>&nbsp;This For Day of</span>
      </div>

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
