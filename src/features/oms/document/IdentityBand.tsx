import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { ChevronLeft, Zap } from 'lucide-react'
import type { SdDocumentHeaderModel } from '@/core/models/sd-document'
import { bandSubIds, overallStatusCode } from './fields'

/**
 * The document's identity (spec 083 D-2, ticket 091).
 *
 * A **dark band** at the top of the page — the one dark band on the page, which
 * is why 082 rejected a dark sidebar and two dark bands meeting at a corner. It
 * carries `documentNo` as the largest thing on screen, the sub-ids beneath it
 * and the customer block at the end, so *whose is this* is answered without a
 * read of the summary rail. The page title row and the toolbar row above it are
 * gone; **Back is the chevron at the start of the band**, so leaving the screen
 * is always in the same place whether or not any command is available.
 *
 * The dark ground is `--brand-panel` / `--brand-panel-foreground` — the design
 * system's one deep-steel slab pair, dark in both themes with fixed white ink
 * (082 D-9). No colour is minted here: this ticket consumes 082's tokens and
 * declares none, and `--brand-panel` is near-neutral steel rather than a brand
 * hue, which is what makes it the right ground for a document header.
 *
 * `document` is `null` while the document loads or fails to: the band still
 * renders, with the route id as its big line, because the chevron is this
 * screen's only way out and it must not appear and disappear underneath the
 * operator.
 */
export default function IdentityBand({
  document,
  routeId,
}: {
  document: SdDocumentHeaderModel | null
  routeId: string
}) {
  const { t } = useTranslation('document')

  const subIds = document ? bandSubIds(document, t) : []
  const overall = document ? overallStatusCode(document) : ''
  const customerName = (document?.customer?.customerName ?? '').trim()
  const customerLine = [document?.customer?.customerPhone, document?.shippingAddress?.cityName]
    .map((value) => (value ?? '').trim())
    .filter(Boolean)
    .join(' · ')

  return (
    <header
      // `role="group"` is load-bearing, exactly as it is on the pill rail: this
      // <header> sits inside the page's <section>, so its implicit role is
      // generic rather than banner — and `aria-label` on a generic element is
      // ignored. The label is what names this region now that the page's <h1>
      // is gone.
      role="group"
      aria-label={t('band.ariaLabel')}
      className="flex flex-wrap items-start gap-x-4 gap-y-2.5 rounded-lg bg-brand-panel px-4 py-3 text-brand-panel-foreground"
    >
      <Link
        to="/oms/deliveries"
        aria-label={t('back')}
        title={t('back')}
        className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-brand-panel-foreground/25 bg-brand-panel-foreground/10 hover:bg-brand-panel-foreground/20"
      >
        {/* Mirrors under RTL — an explicit SVG flip, never a punctuation glyph
            standing in for an icon. The `dir` switch itself is ticket 095. */}
        <ChevronLeft className="h-4 w-4 rtl:-scale-x-100" aria-hidden />
      </Link>

      <div className="min-w-0 flex-1 basis-80">
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
          <span className="text-xl leading-tight font-bold tracking-tight tabular-nums">
            {document?.documentNo ?? routeId}
          </span>

          {/* Labelled monospace code: `overallStatus` has no `*Description`
              companion on the payload, so the band says it is a code rather
              than letting it read as an unresolved word. Blank ⇒ no lozenge. */}
          {overall && (
            <span className="inline-flex items-center gap-1.5 rounded-md border border-brand-panel-foreground/25 bg-brand-panel-foreground/10 px-2 py-0.5 text-[0.625rem] font-bold tracking-widest uppercase">
              {t('band.overall')}
              <span className="font-mono text-xs tracking-normal">{overall}</span>
            </span>
          )}

          {/* Dawaa Now is an ATTRIBUTE of the order, not a lifecycle state — a
              squared tag in the band, never a pill on the status rail. */}
          {document?.isExpressDelivery === true && (
            <span className="inline-flex items-center gap-1 rounded-md bg-attention-050 px-2 py-0.5 text-[0.625rem] font-bold tracking-wider text-attention-800 uppercase">
              <Zap className="h-3 w-3" aria-hidden />
              {t('dawaaNow')}
            </span>
          )}
        </div>

        {subIds.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-brand-panel-foreground/70">
            {subIds.map((row) => (
              <span key={row.key}>
                {row.label}{' '}
                <b
                  className={
                    'font-semibold text-brand-panel-foreground tabular-nums' +
                    (row.isCode ? ' font-mono' : '')
                  }
                >
                  {row.value}
                </b>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* The customer block sits at the END of the band — duplicated with the
          Customer rail card by design. `ms-auto` is inert while the sub-ids
          column grows and bites the moment the band wraps. */}
      {(customerName || customerLine) && (
        <div className="ms-auto text-end">
          {customerName && <div className="text-sm font-semibold">{customerName}</div>}
          {customerLine && (
            <div className="mt-0.5 text-xs text-brand-panel-foreground/70 tabular-nums">
              {customerLine}
            </div>
          )}
        </div>
      )}
    </header>
  )
}
