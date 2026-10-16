import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { ArrowUpRight } from 'lucide-react'
import { pickSupportDiagnosisQuery } from '@/core/pick-support/api'
import { pickSupportConsoleHref } from '@/core/pick-support/console-link'
import DeliveryDiagnosis from '@/core/pick-support/DeliveryDiagnosis'
import StatusBadge from '@/core/ui/StatusBadge'
import Disclosure from './Disclosure'
import { headingShowsStuck } from './pick-support-section'

/**
 * **Pick support** on a delivery's Document Details (ticket 499, BackOffice brief 2691): the
 * brief's "tab", a folded section of the facts column since spec 380 removed the tabs. The page
 * draws it only while `pickSupportSectionGate` admits, and keys it by the delivery, so another
 * delivery starts folded and unread.
 *
 * 🚩 It reads nothing until it is first opened, like Attachments: the first opening calls
 * `GET PickSupport/Delivery/{deliveryNo}` and draws the SHARED panel from `@/core/pick-support`
 * (never the console's feature), refusals and the fix dialog included. Its body stays mounted
 * once built, so a fix dialog survives a fold. The heading takes the stuck marker only once the
 * read says `STUCK`. A fix that stands tells the page (`onFixed`), whose own load it changed.
 */
export default function PickSupportSection({ deliveryNo, onFixed }: { deliveryNo: string; onFixed: () => void }) {
  const { t } = useTranslation('pick-support')
  const [opened, setOpened] = useState(false)
  // The same entry the panel reads, observed for the heading only; disabled until opened, so it
  // never starts the read itself, and a diagnosis cached by the console earlier marks nothing.
  // A failed re-read drops the marker, as the panel drops the verdict for its failure banner.
  const diagnosis = useQuery({ ...pickSupportDiagnosisQuery(deliveryNo), enabled: opened })
  const stuck = opened && !diagnosis.isError && headingShowsStuck(diagnosis.data)

  return (
    <Disclosure
      id="doc-pick-support"
      summary={
        <span className="inline-flex flex-wrap items-center gap-2" data-ps-doc-heading="">
          {t('section.heading')}
          {stuck && (
            <span data-ps-doc-stuck="">
              <StatusBadge sev="warn">{t('list.stuck')}</StatusBadge>
            </span>
          )}
        </span>
      }
      onToggle={(open) => {
        if (open) setOpened(true)
      }}
    >
      {opened && (
        <div className="flex min-w-0 flex-col gap-2" data-ps-doc-section={deliveryNo}>
          <Link
            to={pickSupportConsoleHref(deliveryNo)}
            className="inline-flex items-center gap-1 self-start text-[0.8125rem] font-semibold text-primary hover:underline"
            data-ps-doc-console=""
          >
            {t('section.openConsole')}
            {/* An SVG path never mirrors on its own: flipped under RTL to point at the inline end. */}
            <ArrowUpRight className="h-3.5 w-3.5 rtl:-scale-x-100" aria-hidden />
          </Link>
          <DeliveryDiagnosis deliveryNo={deliveryNo} onFixed={onFixed} />
        </div>
      )}
    </Disclosure>
  )
}
