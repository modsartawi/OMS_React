/**
 * Taking an order for more than the store has, accepted deliberately (ticket 169).
 *
 * Like `StoreMoveConfirm`, this is a **body** and not a mechanism: the modal, the
 * two buttons, the re-issue notice and the failure line are `ConfirmSheet`'s. All
 * that lives here is what a below-availability acceptance has to show — the item,
 * what was asked for, what is actually there, and at which store.
 *
 * 🚩 **It never blocks.** ATP is a soft gate (§5.2): the confirm always succeeds
 * and the order can always be taken, so there is no `blocked` block here and the
 * commit is always offered. The agent's *choice* is the whole point — and the
 * token they send back is what records that they were shown the number.
 *
 * 🚩 **It draws no money and offers no alternative quantity.** What to do about a
 * shortfall (order it anyway, take fewer, look at another store) is the agent's
 * call on a live phone call; a console that proposed a number here would be
 * deciding it for them, in a dialog they have three seconds to read.
 */
import { useTranslation } from 'react-i18next'
import type { BelowAtpAsk } from './below-atp'
import ConfirmSheet, { type PreviewReissue } from './ConfirmSheet'
import { NOTE } from './console-notes'

/**
 * Which act the acceptance is about. 🚩 The **mechanism** is one — the same
 * sheet, the same figures, the same token — but the **words** are the verb's:
 * an agent raising a line that is already in the basket must not be asked
 * whether to *add* it (170). Three classes told apart by words rather than by
 * treatment alone is this console's standing habit.
 */
export type BelowAtpVerb = 'add' | 'raise'

export default function BelowAtpConfirm({
  ask,
  verb = 'add',
  /** The item's own name, where the row the agent added from carried one. Server
   *  text, passed through as data; the item number is what it falls back to. */
  itemName,
  reissue,
  busy,
  error,
  onConfirm,
  onCancel,
}: {
  /** `null` closes the sheet — the ask IS the open state. */
  ask: BelowAtpAsk | null
  verb?: BelowAtpVerb
  itemName?: string
  reissue: PreviewReissue | null
  busy: boolean
  error: string | null
  onConfirm: () => void
  onCancel: () => void
}) {
  const { t } = useTranslation('callcenter')
  const item = itemName || ask?.itemNumber || ''

  return (
    <ConfirmSheet
      open={ask !== null}
      marker="belowAtp"
      title={t(`belowAtp.${verb}.title`, { item })}
      reissue={reissue}
      busy={busy}
      error={error}
      // Named, not "Cancel": declining leaves the basket exactly as it is, and
      // the agent should be able to read which of the two does that.
      keepLabel={t(`belowAtp.${verb}.keep`)}
      confirmLabel={t(`belowAtp.${verb}.confirm`)}
      busyLabel={t(`belowAtp.${verb}.working`)}
      onConfirm={onConfirm}
      onCancel={onCancel}
    >
      {ask && (
        <>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1" data-cc-below-atp-figures>
            <Figure label={t('belowAtp.requested')} value={ask.requested} marker="requested" />
            <Figure label={t('belowAtp.available')} value={ask.available} marker="available" />
          </dl>
          <p className="text-muted-foreground" data-cc-below-atp-where>
            {ask.plant
              ? t('belowAtp.atStore', { item: ask.itemNumber, store: ask.plant })
              : t('belowAtp.atThisStore', { item: ask.itemNumber })}
          </p>
          {/* 🚩 Never a block, and said so plainly: the order CAN be taken. What
              the acceptance costs is that it is recorded as the agent's. */}
          <p className={NOTE.attention} data-cc-below-atp-note>
            {t('belowAtp.recorded')}
          </p>
        </>
      )}
    </ConfirmSheet>
  )
}

/** A quantity, in the tabular register — never the money one: these are counts
 *  of stock, and the sheet draws no price at all. */
function Figure({ label, value, marker }: { label: string; value: number; marker: string }) {
  return (
    <div className="flex items-baseline justify-between border-b border-divider py-1">
      <dt className="text-muted-foreground">{label}</dt>
      <dd data-numeric className="font-medium" data-cc-below-atp={marker}>
        {value}
      </dd>
    </div>
  )
}
