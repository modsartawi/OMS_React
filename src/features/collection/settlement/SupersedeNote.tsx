import { useTranslation } from 'react-i18next'
import { FilePenLine } from 'lucide-react'

import type { SupersedeWarning } from './change-request'

/**
 * **The supersede sentence** a direct act's confirm step carries (spec 342 W12, ticket
 * 352) — the correction pane's Cancel / Write off, the approval dialog's Approve /
 * Reject (from the entry panel and the *Awaiting approval* lane), and Bulk Cancel.
 *
 * 🔑 Whether it is said is `supersedeWarning`'s; this only words it. Nothing for
 * `none`, so a confirm step with nothing waiting reads exactly as it did before.
 *
 * The glyph is the *change waiting* mark's (351), so the sentence reads as being about
 * the same thing the row was marked for.
 */
export default function SupersedeNote({ warning }: { warning: SupersedeWarning }) {
  const { t } = useTranslation('settlement')
  if (warning === 'none') return null
  return (
    <p className="flex items-start gap-2 text-sm" data-testid="supersede-warning" data-supersede={warning}>
      <FilePenLine className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
      <span>{t(`changeRequest.supersede.${warning}`)}</span>
    </p>
  )
}
