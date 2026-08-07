/* PROTOTYPE — throwaway. Wayfinder ticket 246 (map 240).
 *
 * VARIANT A — "As the WPF renders it."
 *
 * A literal port of `CollectionVoucherControl.xaml`: every setter, every
 * MinWidth, every leading/trailing space in a static Run, and every one of the
 * WPF's deliberate departures from the paper LEFT IN PLACE. This is the
 * baseline the map's settled decision points at ("the web output matches the
 * WPF output"), and the thing the other two variants are argued against.
 *
 * Carries, knowingly, the four marks 242 §8 put on this sign-off's agenda:
 *   O2 — `P.O. Box …` is the ONE non-bold line in the English block.
 *   O3 — the paper's `Receiver` / `Pharmacist` English words are absent
 *        (they are `<!-- -->`'d out in the XAML).
 *   fill-lines are SOLID 1px #8A8A8A; the paper's are dot leaders.
 *   `Store. {code}` stands where the paper prints a bare red `PH.`.
 *
 * Not a shared layout on purpose — each variant owns its whole document so it
 * is free to disagree with the others about any mark.
 */
import type { VoucherModel } from './voucher-mock'
import logoUrl from './logo-aldawaa.png'

export const NAME = 'A — the WPF, ported'

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
  padding: '16px 24px', // XAML Padding="24,16"
}

/** XAML `FillLine` style: bottom border only, Padding 6,0,6,1, bottom-aligned. */
const fillLine: React.CSSProperties = {
  borderBottom: `1px solid ${LINE}`,
  padding: '0 6px 1px',
  alignSelf: 'flex-end',
  textAlign: 'center',
  minHeight: 17,
}

/** XAML `AmountCell` + `AmountDigits`. */
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

/** XAML `BilingualLabel`: bold ink, bottom-aligned. */
const label: React.CSSProperties = { fontWeight: 700, color: INK, alignSelf: 'flex-end' }

const ltr: React.CSSProperties = { direction: 'ltr' }

export default function VariantA({ m }: { m: VoucherModel }) {
  return (
    <div style={frame}>
      {/* Band 0 — POSTED banner. Collapsed entirely when unposted, so the band
          takes no height (BooleanToVisibility → Collapsed, not Hidden). */}
      {m.isPosted && (
        <div
          style={{
            background: '#EAF4EC',
            border: '1px solid #9CCBA6',
            borderRadius: 3,
            padding: '4px 8px',
            marginBottom: 10,
            textAlign: 'center',
            fontWeight: 700,
            color: '#1E6B2F',
            printColorAdjust: 'exact',
            WebkitPrintColorAdjust: 'exact',
          }}
        >
          تم الترحيل — POSTED
        </div>
      )}

      {/* Band 1 — company header: Arabic (right) · logo · English (left). */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
          <div style={{ fontSize: 17, fontWeight: 700 }}>صيدليات الدواء</div>
          <div>س.ت : ٢٠٥١٠١٤٩٤٠/٠٠٢</div>
          <div>هاتف : ٩٢٠٠٠٠٨٣٨</div>
          <div>حي الروابي طريق الملك فهد - ابراج اسمنت الشرقية</div>
          <div>ص.ب ٤٣٢٦ الخبر ٣١٩٥٢</div>
          <div>المملكة العربية السعودية</div>
        </div>

        {/* LTR-forced so the artwork is never mirrored. */}
        <img src={logoUrl} alt="" style={{ ...ltr, height: 80, margin: '0 5px', objectFit: 'contain' }} />

        <div
          style={{
            ...ltr,
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            textAlign: 'left',
          }}
        >
          <div style={{ fontSize: 16, fontWeight: 700 }}>Al-Dawaa Pharmacies</div>
          <div style={{ fontWeight: 700 }}>C. R. : 2051014940/002</div>
          <div style={{ fontWeight: 700 }}>Tel. : 920000838</div>
          <div style={{ fontWeight: 700 }}>Al Rawabi District, King Fahd Road, Eastern Cement Towers.</div>
          {/* O2 — the only non-bold line in this block, exactly as the XAML has it. */}
          <div>P.O. Box 4326 Al-Khobar 31952</div>
          <div style={{ fontWeight: 700 }}>Kingdom of Saudi Arabia</div>
        </div>
      </div>

      {/* Band 2 — خصم فائض. Always drawn; only its contents are conditional. */}
      <div style={{ display: 'flex', marginBottom: 10 }}>
        <div
          style={{
            minWidth: 220,
            minHeight: 34,
            border: `1px solid ${RED}`,
            padding: '4px 8px',
            display: 'flex',
            alignItems: 'center',
            gap: 0,
          }}
        >
          <span style={{ color: RED, fontWeight: 700 }}>خصم فائض : </span>
          <span style={{ fontWeight: 700 }}>{m.varianceText}</span>
          <span style={{ color: '#2E7D32', fontWeight: 700 }}>{m.matchedMarkText}</span>
        </div>
      </div>

      {/* Band 3 — title band: Store (right) · سـنـد قـبـض + S.R.|H. (centre) · No. (left). */}
      <div style={{ display: 'flex', alignItems: 'flex-start', marginBottom: 10 }}>
        <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end' }}>
          <div style={{ ...ltr, display: 'flex', color: RED, fontSize: 16, fontWeight: 700 }}>
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

        <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-start' }}>
          <div style={{ ...ltr, display: 'flex', color: RED, fontSize: 16, fontWeight: 700 }}>
            <span>No.&nbsp;</span>
            <span>{m.noText}</span>
          </div>
        </div>
      </div>

      {/* Band 4 — date. */}
      <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'flex-end' }}>
          <span style={label}>التاريخ&nbsp;</span>
          <div style={{ ...fillLine, minWidth: 140 }}>{m.collectedAtText}</div>
          <span style={label}>&nbsp;Date</span>
        </div>
      </div>

      {/* Band 5 — receiver name. */}
      <div style={{ display: 'flex', alignItems: 'flex-end', marginBottom: 12 }}>
        <span style={label}>استلمت أنا/&nbsp;</span>
        <div style={{ ...fillLine, flex: 1, fontWeight: 700 }}>{m.collectorName}</div>
        <span style={{ ...label, ...ltr }}>&nbsp;Receiver Name /</span>
      </div>

      {/* Band 6 — cash. */}
      <MoneyRow
        parts={m.cash}
        arabic="نقدا - مبلغ وقدره "
        words={m.cashWords}
        english=" Cash - The Sum of"
      />

      {/* Band 7 — bank / شبكة. */}
      <MoneyRow
        parts={m.card}
        arabic="شبكة - مبلغ وقدره "
        words={m.cardWords}
        english=" Bank - The Sum of"
      />

      {/* Band 8 — this for day of. The widest gap on the form (18). */}
      <div style={{ display: 'flex', alignItems: 'flex-end', marginBottom: 18 }}>
        <span style={label}>وذلك عن يوم&nbsp;</span>
        <div style={{ ...fillLine, flex: 1 }}>{m.shiftDayName}</div>
        <span style={label}>&nbsp;بتاريخ / Date&nbsp;</span>
        <div style={{ ...fillLine, flex: 1 }}>{m.shiftDayText}</div>
        <span style={label}>&nbsp;This For Day of</span>
      </div>

      {/* Band 9 — name blocks. Collector (right) · 24px gutter · pharmacist (left).
          No wet-signature lines: the digital confirm is the assent. */}
      <div style={{ display: 'flex' }}>
        <NameBlock
          nameLabel="اسم المحصل : "
          name={m.collectorName}
          idLabel="الرقم الوظيفي : "
          id={m.collectorId}
        />
        <div style={{ width: 24, flex: '0 0 24px' }} />
        <NameBlock
          nameLabel="اسم الصيدلي : "
          name={m.pharmacistName}
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
  idLabel,
  id,
}: {
  nameLabel: string
  name: string
  idLabel: string
  id: string
}) {
  return (
    <div style={{ flex: 1 }}>
      <div style={{ display: 'flex', alignItems: 'flex-end' }}>
        <span style={label}>{nameLabel}</span>
        {/* O3 — the paper's English word beside the name is commented out in the XAML. */}
        <div style={{ ...fillLine, flex: 1, fontWeight: 700 }}>{name}</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', marginTop: 6 }}>
        <span style={label}>{idLabel}</span>
        <div style={{ ...fillLine, flex: 1 }}>{id}</div>
      </div>
    </div>
  )
}
