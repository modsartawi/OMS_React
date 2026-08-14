/* The سند قبض (RECEIPT VOUCHER) facsimile — one A4 sheet per `VoucherPage`.
 *
 * ⚠ DOCUMENTED EXCEPTION (spec 249, ticket 251), shared with
 * `collection-voucher.css`: this file is a paper facsimile, so the Arabic IS the
 * form rather than UI copy (no `t()`) and the geometry is physical and mirrors
 * nothing. The third rule — the colour-literal gate — is exercised by the
 * stylesheet, which holds the whole-file exclusion; every colour on this
 * document lives there, so this file needs none. Screen chrome around it —
 * `ReceiptPrintPage`'s miss state — obeys every rule, unexceptionally.
 *
 * Every mark below is a RULING, signed off in ticket 246 against the paper pad
 * and the WPF side by side; §1–§3 of `assets/242-fidelity-inventory.RESEARCH.md`
 * is the mark-by-mark inventory. The prototype's `VariantC` settled them; this
 * is the rewrite, not the promotion.
 *
 * 🔑 The component computes NOTHING. Every displayed value arrives pre-formatted
 * from the server (245 §0) — no money, no date, no amount-in-words, no page
 * chunking. If a string is missing the answer is a server change.
 */
import Ltr from '@/core/ui/Ltr'
import PrintSheet from './PrintSheet'
import type { VoucherAmountParts, VoucherPage } from '@/core/models/collection'
import logoUrl from './logo-aldawaa.png'
import './collection-voucher.css'

export default function CollectionVoucher({ page }: { page: VoucherPage }) {
  return (
    <PrintSheet docClassName="cv-doc">
      {/* 246 — NO POSTED banner. `No.` IS the posted state: a receipt that took
          a number is posted, so a green band restating it is chrome the paper
          never had. `isPosted` left the contract with it (245 §3). */}

      <div className="cv-head">
        <div className="cv-head-block">
          <div className="cv-head-name">صيدليات الدواء</div>
          {/* Arabic-Indic digits, and they are STATIC header text — never a
              value. Every value on this form is Western-digit (§7). */}
          <div>س.ت : ٢٠٥١٠١٤٩٤٠/٠٠٢</div>
          <div>هاتف : ٩٢٠٠٠٠٨٣٨</div>
          <div>حي الروابي طريق الملك فهد - ابراج اسمنت الشرقية</div>
          <div>ص.ب ٤٣٢٦ الخبر ٣١٩٥٢</div>
          <div>المملكة العربية السعودية</div>
        </div>

        {/* 🚩 INTERIM (251/252 open question): the WPF's STACKED al-dawaa mark.
            The paper pad carries a horizontal lockup with `care for life /
            نهتم بالحياة` and the ACR's paper original prints DMSCO — neither
            asset exists in either repo, and this is a file to obtain from the
            brand side, not a decision to take here. Alt is empty on purpose:
            the mark is decorative inside a document that names the company in
            two scripts on the line beside it. */}
        <img className="cv-logo" src={logoUrl} alt="" />

        <div className="cv-head-block cv-head-en">
          <div className="cv-head-en-name">Al-Dawaa Pharmacies</div>
          <div>C. R. : 2051014940/002</div>
          <div>Tel. : 920000838</div>
          {/* Wraps. Held on one line it runs into the logo, which is worse
              than the extra line the WPF already lives with. */}
          <div>Al Rawabi District, King Fahd Road, Eastern Cement Towers.</div>
          <div>P.O. Box 4326 Al-Khobar 31952</div>
          <div>Kingdom of Saudi Arabia</div>
        </div>
      </div>

      <div className="cv-overage">
        {/* A HAND-FILL SLOT, exactly as the pad prints it: red label, ruled box,
            nothing inside. 246 answered 242 §8-O4 by deletion — neither
            `varianceText` nor `matchedMarkText` reaches the browser, so there is
            no reconciliation figure here to bind.

            ⚠ ONE OCCUPANT, AND ONLY WHEN THERE IS ONE (spec 1173 D9/D10). A close
            that spent a SURPLUS puts the amount and the entry number in the slot,
            because the collector is walking out with less cash than the drawer
            held and the paper has to say by how much and against which entry. On
            every other receipt both strings are `''` and NOTHING renders — not an
            empty line, which would grow the box and push the sheet below it down.
            The label itself never moves: it is on the blank pad, so it is part of
            this form and not a value the server sends. */}
        <div className="cv-overage-box">
          <span className="cv-overage-label">خصم فائض : </span>
          {page.surplusAmountText && (
            <span className="cv-overage-fill">
              {/* ⚠ NOT wrapped in `<Ltr>`, deliberately. A value breaks only when
                  it contains a SPACE and begins or ends with a digit; `240.70` is
                  on `Ltr`'s own measured-safe list and `200.00` is the same
                  shape. The date beside it is isolated because `2026-08-06 21:14`
                  has a space — this does not. */}
              <span className="cv-overage-amount">{page.surplusAmountText}</span>
              {page.surplusEntryText && (
                <span className="cv-overage-entry">{page.surplusEntryText}</span>
              )}
            </span>
          )}
        </div>
      </div>

      <div className="cv-title-band">
        <div className="cv-band-side cv-band-side--store">
          <div className="cv-stamp">
            <span>Store.&nbsp;</span>
            <span>{page.storeCode}</span>
          </div>
        </div>

        <div className="cv-title-col">
          <div className="cv-title">سـنـد قـبـض</div>
          <div className="cv-subtitle">RECEIPT VOUCHER</div>
          <div className="cv-amount cv-amount--grand">
            <div className="cv-amount-col">
              <div className="cv-amount-cap">
                <b>S.R.</b>
                <span>&nbsp;&nbsp;ريال</span>
              </div>
              <div className="cv-cell cv-cell--whole-grand">{page.grand.whole}</div>
            </div>
            <div className="cv-amount-col">
              <div className="cv-amount-cap">
                <b>H.</b>
                <span>&nbsp;&nbsp;هـ</span>
              </div>
              <div className="cv-cell cv-cell--minor-grand">{page.grand.minor}</div>
            </div>
          </div>
        </div>

        <div className="cv-band-side cv-band-side--no">
          <div className="cv-stamp">
            <span>No.&nbsp;</span>
            <span>{page.noText}</span>
          </div>
        </div>
      </div>

      <div className="cv-row cv-row--date">
        <div className="cv-inline-row">
          <span className="cv-label">التاريخ&nbsp;</span>
          {/* 🚩 An LTR ISLAND, and the WPF is wrong here. `2026-08-06 21:14`
              mixes digits with a space, so the bidi algorithm treats the two
              halves as weak runs and the RTL paragraph orders them
              right-to-left — the sheet prints `21:14 2026-08-06`. Every other
              value on this form is already isolated (the money cells and the
              two stamps sit in `direction: ltr` islands, and `2026-08-06`
              alone has no space to break on); this one was the gap. */}
          <div className="cv-line cv-line--date">
            <Ltr>{page.collectedAtText}</Ltr>
          </div>
          <span className="cv-label">&nbsp;Date</span>
        </div>
      </div>

      <div className="cv-row">
        <span className="cv-label">استلمت أنا/&nbsp;</span>
        <div className="cv-line cv-line--name">{page.collectorName}</div>
        <span className="cv-label cv-label--en">&nbsp;Receiver Name /</span>
      </div>

      <MoneyRow parts={page.cash} arabic="نقدا - مبلغ وقدره " words={page.cashWords} english=" Cash - The Sum of" />
      <MoneyRow parts={page.card} arabic="شبكة - مبلغ وقدره " words={page.cardWords} english=" Bank - The Sum of" />

      <div className="cv-row cv-row--day">
        <span className="cv-label">وذلك عن يوم&nbsp;</span>
        <div className="cv-line cv-line--grow">{page.shiftDayName}</div>
        <span className="cv-label">&nbsp;بتاريخ / Date&nbsp;</span>
        <div className="cv-line cv-line--grow">{page.shiftDayText}</div>
        <span className="cv-label">&nbsp;This For Day of</span>
      </div>

      {/* `Receiver` and `Pharmacist` RESTORED — they are on the pad, and the
          XAML comments them out for no stated reason. */}
      <div className="cv-names">
        <NameBlock name={page.collectorName} english="Receiver" id={page.collectorId} nameLabel="اسم المحصل : " />
        <div className="cv-names-gap" />
        <NameBlock name={page.pharmacistName} english="Pharmacist" id={page.pharmacistId} nameLabel="اسم الصيدلي : " />
      </div>
    </PrintSheet>
  )
}

function MoneyRow({
  parts,
  arabic,
  words,
  english,
}: {
  parts: VoucherAmountParts
  arabic: string
  words: string
  english: string
}) {
  return (
    <div className="cv-row">
      <div className="cv-amount cv-amount--row">
        <div className="cv-cell cv-cell--whole-row">{parts.whole}</div>
        <div className="cv-cell cv-cell--minor-row">{parts.minor}</div>
      </div>
      <span className="cv-label">{arabic}</span>
      <div className="cv-line cv-line--grow">{words}</div>
      <span className="cv-label">{english}</span>
    </div>
  )
}

/* An empty `name` or `id` renders an empty fill-line, never a `0` — which is why
 * the strings arrive as `''` and are rendered as they came, with no `||` fallback
 * that could put a placeholder on a printed record. */
function NameBlock({
  nameLabel,
  name,
  english,
  id,
}: {
  nameLabel: string
  name: string
  english: string
  id: string
}) {
  return (
    <div className="cv-name-block">
      <div className="cv-inline-row">
        <span className="cv-label">{nameLabel}</span>
        <div className="cv-line cv-line--name">{name}</div>
        <span className="cv-label cv-label--en">&nbsp;{english}</span>
      </div>
      <div className="cv-name-id">
        <span className="cv-label">الرقم الوظيفي : </span>
        <div className="cv-line cv-line--grow">{id}</div>
      </div>
    </div>
  )
}
