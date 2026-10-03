import { Fragment } from 'react'
import { useTranslation } from 'react-i18next'
import Kbd from '@/core/ui/Kbd'
import Ltr from '@/core/ui/Ltr'
import { legendOf } from './keys'

/**
 * A key's hint as caps (ticket 393, spec 380 K15, K17): `R`, `?`, `Ctrl` `Enter`.
 * Letters and symbols print their Latin legend, derived from the code; named keys go
 * through `common:keys.*`.
 *
 * 🚩 **Isolated as one unit** (378 §5): one `Ltr` around the whole chord, never one per
 * cap — RTL lays separate isolates out right-to-left, as `Enter Ctrl`.
 */
export default function KeyChord({ keys }: { keys: string }) {
  const { t } = useTranslation()
  return (
    <span className="shrink-0 whitespace-nowrap" data-key-chord={keys}>
      <Ltr>
        {legendOf(keys).map((part, i) => (
          <Fragment key={i}>
            {i > 0 && ' '}
            <Kbd>{'cap' in part ? part.cap : t(part.named)}</Kbd>
          </Fragment>
        ))}
      </Ltr>
    </span>
  )
}
