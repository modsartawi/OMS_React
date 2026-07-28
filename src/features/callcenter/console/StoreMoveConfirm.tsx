/**
 * What a plant rebind moves, previewed (ticket 167).
 *
 * This is a **body**, not a mechanism: the modal, the buttons, the re-issue
 * notice and the blocked-commit rule are `ConfirmSheet`'s, which
 * [169](.issues/169-below-availability-accepted.md) mounts unchanged with a body
 * of its own. All that lives here is what a *store change* has to show before
 * anything moves — which is exactly the ticket's list: line-by-line price
 * movement, promotions whose value moves, the delivery fee, availability
 * re-freeze, and any line that would no longer price.
 *
 * 🚩 **A preview that already names an unpriceable line offers no commit.**
 * `unpriceableLines[]` rides the preview *and* the refusal by contract (§5.1),
 * so the refusal is knowable here — and the rebind is atomic, so there is no
 * "move the rest" to offer either.
 *
 * It draws no money it was not handed: every figure is the engine's own, and the
 * only derivation is `toGross − fromGross`, which is arithmetic on two of them.
 */
import { useTranslation } from 'react-i18next'
import { formatMoney } from '@/core/util/number-format'
import ConfirmSheet, { type PreviewReissue } from './ConfirmSheet'
import { NOTE } from './console-notes'
import type { StoreMovePreview } from './store-move'

export type { PreviewReissue }

export default function StoreMoveConfirm({
  preview,
  reissue,
  busy,
  error,
  onConfirm,
  onCancel,
}: {
  /** `null` closes the sheet — the preview IS the open state. */
  preview: StoreMovePreview | null
  reissue: PreviewReissue | null
  busy: boolean
  /** A failed commit that was not the atomic refusal — the refusal is a banner
   *  over the basket, not a line in a dialog the agent is about to close. */
  error: string | null
  onConfirm: () => void
  onCancel: () => void
}) {
  const { t } = useTranslation('callcenter')
  const toStore = preview ? storeLabel(preview.toPlant, preview.toPlantName) : ''
  const fromStore = preview ? storeLabel(preview.fromPlant, preview.fromPlantName) : ''

  return (
    <ConfirmSheet
      open={preview !== null}
      marker="storeChange"
      title={t('rebind.title', { store: toStore })}
      reissue={reissue}
      busy={busy}
      error={error}
      // Named, not "Cancel": the agent is choosing to stay where they are, and
      // the store they stay on is the thing they are choosing.
      keepLabel={fromStore ? t('rebind.keep', { store: fromStore }) : t('rebind.keepPlain')}
      confirmLabel={t('rebind.confirm')}
      busyLabel={t('rebind.moving')}
      blocked={
        preview && preview.unpriceableLines.length > 0 ? (
          <div data-cc-rebind-unpriceable>
            <p className="font-medium">{t('rebind.wouldRefuse', { store: toStore })}</p>
            <ul className="mt-1 space-y-0.5">
              {preview.unpriceableLines.map((line) => (
                <li key={line.lineId} data-cc-rebind-unpriceable-line={line.lineId}>
                  {/* Server-supplied, passed through as data. */}
                  {line.description ?? line.itemNumber ?? line.lineId}
                  {line.itemNumber && line.description ? ` · ${line.itemNumber}` : ''}
                </li>
              ))}
            </ul>
            <p className="mt-1">{t('rebind.voidThenRetry')}</p>
          </div>
        ) : undefined
      }
      onConfirm={onConfirm}
      onCancel={onCancel}
    >
      {preview && (
        <>
          <p className="text-muted-foreground">
            <span data-cc-rebind-from>{fromStore || t('rebind.unnamedStore')}</span>
            <span aria-hidden className="mx-1.5">
              →
            </span>
            <span className="font-medium text-foreground" data-cc-rebind-to>
              {toStore || t('rebind.unnamedStore')}
            </span>
          </p>

          {preview.lineDiffs.length > 0 ? (
            <>
              <table className="w-full text-sm">
                <caption className="pb-1 text-start text-[11px] uppercase tracking-wide text-muted-foreground">
                  {t('rebind.pricesCaption')}
                </caption>
                <thead>
                  <tr className="border-b border-divider text-[11px] uppercase tracking-wide text-muted-foreground">
                    <th className="py-1 text-start font-medium">{t('rebind.colLine')}</th>
                    <th className="py-1 text-end font-medium">{t('rebind.colNow')}</th>
                    <th className="py-1 text-end font-medium">{t('rebind.colAfter')}</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.lineDiffs.map((line) => (
                    <tr key={line.lineId} className="border-b border-divider" data-cc-rebind-line={line.lineId}>
                      <td className="py-1.5">
                        {/* Server-supplied, passed through as data. */}
                        {line.description ?? line.itemNumber ?? line.lineId}
                      </td>
                      <td data-numeric className="py-1.5 text-end text-muted-foreground line-through">
                        {formatMoney(line.fromGross)}
                      </td>
                      <td
                        data-numeric
                        data-cc-rebind-after={line.lineId}
                        className={`py-1.5 text-end font-medium ${
                          line.delta < 0 ? 'text-success-800' : line.delta > 0 ? 'text-danger-800' : ''
                        }`}
                      >
                        {formatMoney(line.toGross)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {preview.moneyStandsStill && (
                // Worth saying plainly: the agent is reading a table of identical
                // numbers and would otherwise hunt for the change.
                <p className="text-xs text-muted-foreground" data-cc-rebind-money-still>
                  {t('rebind.moneyStandsStill')}
                </p>
              )}
            </>
          ) : (
            <p className="text-xs text-muted-foreground" data-cc-rebind-no-lines>
              {t('rebind.noLineMovement')}
            </p>
          )}

          {/* 🚩 The fee is recomputed at the new plant (§2.2) and is money on the
              caller's total like any other, so a sheet that skipped it would be
              showing the agent an incomplete diff to commit. */}
          {preview.deliveryFee && preview.deliveryFee.fromAmount !== preview.deliveryFee.toAmount && (
            <p className={NOTE.attention} data-cc-rebind-fee>
              {t('rebind.deliveryFeeMoved', {
                from: formatMoney(preview.deliveryFee.fromAmount),
                to: formatMoney(preview.deliveryFee.toAmount),
              })}
            </p>
          )}

          {/* Keyed on position for the same reason as the basket's promotions:
              a blank `offerId` is a real wire answer (859). */}
          {preview.promotionsMoved.map((promo, index) => (
            <p
              key={`${promo.offerId}-${index}`}
              className={NOTE.attention}
              data-cc-rebind-promo={promo.offerId}
            >
              {t('rebind.promotionMoved', {
                // Server-supplied where there is one; the offer id is the only
                // thing the console can name it by when there is not.
                promotion: promo.description ?? promo.offerId,
                from: formatMoney(promo.fromAmount),
                to: formatMoney(promo.toAmount),
              })}
            </p>
          ))}

          {preview.atpReFreeze.map((atp) => (
            <p
              key={atp.lineId}
              className={atp.belowAfter ? NOTE.danger : NOTE.quiet}
              data-cc-rebind-atp={atp.lineId}
            >
              {t(atp.belowAfter ? 'rebind.atpBelow' : 'rebind.atpReFrozen', {
                line: lineOf(preview, atp.lineId),
                from: atp.fromQty ?? t('rebind.qtyUnknown'),
                to: atp.toQty ?? t('rebind.qtyUnknown'),
              })}
            </p>
          ))}
        </>
      )}
    </ConfirmSheet>
  )
}

/** `1204 · Riyadh — Al Yasmin`, or whichever half the server sent. */
function storeLabel(code: string | null, name: string | null): string {
  return [code, name].filter(Boolean).join(' · ')
}

/** The line's own description where the diff carried one, so an availability
 *  note names the same thing the price table does rather than an opaque id. */
function lineOf(preview: StoreMovePreview, lineId: string): string {
  const diff = preview.lineDiffs.find((line) => line.lineId === lineId)
  return diff?.description ?? diff?.itemNumber ?? lineId
}
