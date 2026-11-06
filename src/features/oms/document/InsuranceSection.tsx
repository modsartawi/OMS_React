import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router'
import { useTranslation } from 'react-i18next'
import type { OrderInsuranceRead } from '@/core/models/order-insurance'
import type { SdDocumentLogModel } from '@/core/models/sd-document'
import Chip from '@/core/ui/Chip'
import ErrorBanner from '@/core/ui/ErrorBanner'
import { HEADING } from './facts-heading'
import InsuranceLinesPart from './InsuranceLinesPart'
import InsuranceMoneyPart from './InsuranceMoneyPart'
import InsurancePlanPart from './InsurancePlanPart'
import InsuranceChangesPart from './InsuranceChangesPart'
import InsuranceReceivedPart from './InsuranceReceivedPart'
// The section's anchor: `/oms/document/<no>#insurance` opens the page on it (789's strip links here).
import { INSURANCE_SECTION_ID } from './insurance-section'

/** The section's parts, one tab each, in reading order: the verdict (Money) first. */
const PARTS = ['money', 'lines', 'plan', 'changes', 'received'] as const
type Part = (typeof PARTS)[number]

/**
 * **The Insurance section** of Document Details (ticket 787, BackOffice spec 3389, door 3390): a
 * full-width section of the layout, drawn only where `insuranceSectionGate` admits: an order (not a
 * delivery), the insurance-view grant, and a read that answered an insurance order. Its five parts
 * are tabs (one part on screen at a time — stacked, they crowded the page), Money first:
 *
 * - **Money** (`InsuranceMoneyPart`) — 787;
 * - **Lines** with "How it was priced" (`InsuranceLinesPart`) — 787;
 * - **Plan** (`InsurancePlanPart`) — 788;
 * - **Changes** (`InsuranceChangesPart`): the change timeline with money before / after, the document
 *   log merged in (the page's `logs`, used only when the read carries no log of its own) — 788;
 * - **Received** (`InsuranceReceivedPart`): the intake body, or why it was not kept — 788.
 *
 * Linkable: when the page was opened at `#insurance`, the section scrolls itself into view once, on
 * mount — which is after the read has landed, so the sections above have their heights.
 * Read-only: nothing here writes.
 */
export default function InsuranceSection({
  read,
  error,
  logs,
}: {
  read: OrderInsuranceRead | null
  error?: string | null
  /** The page's document log rows (`documentApi.getLogs`), for the Changes timeline. */
  logs?: readonly SdDocumentLogModel[] | null
}) {
  const { t } = useTranslation('document')
  const ref = useRef<HTMLElement>(null)
  const { hash } = useLocation()
  const scrolled = useRef(false)
  const [part, setPart] = useState<Part>('money')

  useEffect(() => {
    if (scrolled.current || hash !== `#${INSURANCE_SECTION_ID}`) return
    scrolled.current = true
    ref.current?.scrollIntoView({ block: 'start' })
  }, [hash])

  return (
    <section
      ref={ref}
      id={INSURANCE_SECTION_ID}
      aria-labelledby="doc-insurance-heading"
      className="min-w-0 scroll-mt-4 rounded-lg border border-border bg-card p-3 text-[0.8125rem]"
      data-insurance-section=""
    >
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        <h3 id="doc-insurance-heading" className={`${HEADING} text-muted-foreground`}>
          {t('insurance.heading')}
        </h3>
        {read && !error && (
          <div role="tablist" aria-label={t('insurance.tabsLabel')} className="flex flex-wrap gap-1" data-insurance-tabs="">
            {PARTS.map((p) => (
              <Chip
                key={p}
                variant="tab"
                on={part === p}
                id={`doc-insurance-tab-${p}`}
                aria-controls="doc-insurance-panel"
                onClick={() => setPart(p)}
                data-insurance-tab={p}
              >
                {t(`insurance.${p}.heading`)}
              </Chip>
            ))}
          </div>
        )}
      </div>
      {error ? (
        <ErrorBanner message={error} className="px-3 py-2" />
      ) : (
        read && (
          // The tab names the part, so each part's own heading is kept for screen readers only.
          <div
            role="tabpanel"
            id="doc-insurance-panel"
            aria-labelledby={`doc-insurance-tab-${part}`}
            className="min-w-0 [&_h4]:sr-only"
            data-insurance-panel={part}
          >
            {part === 'money' && <InsuranceMoneyPart read={read} />}
            {part === 'lines' && <InsuranceLinesPart read={read} />}
            {part === 'plan' && <InsurancePlanPart read={read} />}
            {part === 'changes' && <InsuranceChangesPart read={read} logs={logs} />}
            {part === 'received' && <InsuranceReceivedPart read={read} />}
          </div>
        )
      )}
    </section>
  )
}
