/**
 * What taking the link back costs, asked before it is taken (ticket 195).
 *
 * This is a **body**, not a mechanism: the modal, the two buttons, the failure
 * line and which button is the dismissing one are `ConfirmSheet`'s, the same
 * surface the store move (167) and the below-availability acceptance (169) are
 * drawn in. A third confirmation mechanism for the third confirmation would be
 * the defect that pattern exists to prevent.
 *
 * 🚩 **It asks because unlink EMPTIES THE BASKET.** An agent who reads *unlink*
 * as *stop referencing this request* would lose a basket they meant to keep —
 * which is the whole risk of the act, and why the sheet states the cost rather
 * than asking "are you sure?".
 *
 * The three facts are `unlinkCost`'s, and the third one is why they are three:
 * *unlink* and *remove the caller* sit next to each other in the rail, so the
 * sheet says out loud that **the caller stays**. An agent who fears losing the
 * caller they have just attached will not press the one control that fixes a
 * mis-picked request.
 *
 * 🚩 It carries **no `reissue`**: there is no token here. Unlink is one shot on
 * one verb — nothing is previewed, so nothing can go stale under the agent.
 */
import { useTranslation } from 'react-i18next'
import ConfirmSheet from './ConfirmSheet'
import { NOTE } from './console-notes'
import type { UnlinkCost } from './linked-request'

export default function UnlinkConfirm({
  cost,
  busy,
  error,
  onConfirm,
  onCancel,
}: {
  /** `null` closes the sheet — the cost IS the open state. */
  cost: UnlinkCost | null
  busy: boolean
  /** A failed unlink, already turned into agent-facing text by the caller. The
   *  order is untouched by one, so pressing again is a retry of the same act. */
  error: string | null
  onConfirm: () => void
  onCancel: () => void
}) {
  const { t } = useTranslation('callcenter')
  return (
    <ConfirmSheet
      open={cost !== null}
      marker="unlink"
      title={t('request.unlink.title', { documentNo: cost?.documentNo ?? '' })}
      reissue={null}
      busy={busy}
      error={error}
      // Named, not "Cancel": the agent is choosing to keep converting this
      // request, and the request is the thing they are choosing.
      keepLabel={t('request.unlink.keep')}
      confirmLabel={t('request.unlink.confirm')}
      busyLabel={t('request.unlink.working')}
      onConfirm={onConfirm}
      onCancel={onCancel}
    >
      {cost && (
        <div data-cc-unlink-cost={String(cost.lines)}>
          {/* 🚩 The cost, first and in the attention register: this is the fact an
              agent who read *unlink* as *drop the stamp* does not expect. The
              count is the basket's own, so a copy that landed four of six lines
              offers to remove four — and an empty basket says so in its own
              words rather than through a plural with a zero in it, because *the
              0 items* is a sentence nobody writes and every agent notices. */}
          <p className={cost.lines > 0 ? NOTE.attention : 'text-muted-foreground'} data-cc-unlink-lines>
            {cost.lines > 0
              ? t('request.unlink.lines', { count: cost.lines })
              : t('request.unlink.linesNone')}
          </p>
          {/* The order's chosen store stops being chosen, which re-shuts the item
              gate — said before rather than discovered after. 🚩 Silent where
              there was no chosen store to lose (a request that named none), and
              store-less where the projection names none: a blank interpolated
              into the sentence is a gap the agent has to interpret. */}
          {cost.reopensStore && (
            <p className="mt-2 text-muted-foreground" data-cc-unlink-store={cost.storeCode ?? ''}>
              {cost.storeCode
                ? t('request.unlink.storeReopens', { store: cost.storeCode })
                : t('request.unlink.storeReopensPlain')}
            </p>
          )}
          {/* 🚩 And the reassurance that makes the control pressable at all. It is
              unconditional: `keepsCustomer` is a fact of the verb, not a state. */}
          <p className="mt-1 text-muted-foreground" data-cc-unlink-keeps-customer>
            {t('request.unlink.callerStays')}
          </p>
        </div>
      )}
    </ConfirmSheet>
  )
}
