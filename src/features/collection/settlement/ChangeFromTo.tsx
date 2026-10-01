import { useTranslation } from 'react-i18next'

import { formatDay } from '@/core/util/date-format'
import { bidiIsolate, type CardChange } from './change-request'

/**
 * **One field's old → new** (spec 342 W6 / W11) — the waiting card and the audit column
 * draw the same request's change, so they draw it through one renderer (ticket 350).
 *
 * - The amount at the screen's money format; a theft's day as a bare day.
 * - 🚩 A Description on each side is ISOLATED (`bidiIsolate`), the arrow outside both:
 *   one `dir="auto"` run over two Arabic Descriptions turns the whole *"from → to"*
 *   right-to-left, and the arrow then points at the old one.
 */
export default function ChangeFromTo({
  change,
  money,
}: {
  change: CardChange
  money: (v: number | null | undefined) => string
}) {
  const { t } = useTranslation('settlement')

  switch (change.field) {
    case 'amount':
      return <>{t('changeRequest.card.fromTo', { from: money(change.from), to: money(change.to) })}</>
    case 'businessDay':
      return <>{t('changeRequest.card.fromTo', { from: formatDay(change.from), to: formatDay(change.to) })}</>
    case 'description':
      return (
        <>{t('changeRequest.card.fromTo', { from: bidiIsolate(change.from), to: bidiIsolate(change.to) })}</>
      )
  }
}
