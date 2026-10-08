import { Trans, useTranslation } from 'react-i18next'
import StatusBadge from '@/core/ui/StatusBadge'
import Ltr from '@/core/ui/Ltr'
import { bbyStatusSeverity, readBbyStatus } from './status'

/** The BBY header status badge — code → reading → severity, then the core badge. One
 *  wrapper for all three sites (the Status column, the pinned identity cell and the
 *  Details modal, which Simulation opens too), so they never disagree about one bonus buy.
 *
 *  It always renders: SAP's blank is Activated, not "no status" (ticket 442). An unknown
 *  code shows its raw value beside the label, isolated as the machine value it is.
 *  Colour is redundant to the text, so it never carries meaning alone (WCAG). */
export default function BbyStatusBadge({ code }: { code: string | null | undefined }) {
  const { t } = useTranslation('bonus-buy-inquiry')
  const status = readBbyStatus(code)
  const raw = code?.trim() ?? ''
  return (
    <StatusBadge sev={bbyStatusSeverity(status)}>
      {status === 'unknown' && raw !== '' ? (
        // One inline run: the badge is `inline-flex`, so a bare label + isolate would be two
        // flex items and the space between them would collapse ("UnknownZ"). The locale owns
        // the word order; the code rides in an `Ltr` slot.
        <span>
          <Trans t={t} i18nKey="status.unknownCode" values={{ code: raw }} components={{ code: <Ltr /> }} />
        </span>
      ) : (
        t(`status.${status}`)
      )}
    </StatusBadge>
  )
}
