import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Minus, Plus, Trash2 } from 'lucide-react'
import Button from '@/core/ui/Button'
import IconButton from '@/core/ui/IconButton'
import Ltr from '@/core/ui/Ltr'
import { formatMoneyOfUnknownCurrency } from '@/core/money'
import type { SessionLine, SessionState } from '@/core/models/callcenter'
import KeyedCodeField, { type KeyedCode } from './KeyedCodeField'
import RefusalBanner from './RefusalBanner'
import ScannerView from './ScannerView'
import { ITEM_FORMATS, type ScanRead } from './scanner'
import type { ShownRefusal } from './refusal'

/**
 * The basket (spec 4063 stories 13-22): scan with the camera, type a code, change a quantity, remove a line, submit.
 * Every figure is the server's (the session state, priced at the pharmacy as its till would); the phone never sums a
 * line or a total. A refusal is shown in the server's words, over the basket it refused from.
 */
export default function BasketScreen({
  state,
  busy,
  refusal,
  belowStock,
  customerSlot,
  onScan,
  onKeyed,
  onQty,
  onRemove,
  onSubmit,
  onAbandon,
  onAddAnyway,
  onDontAdd,
}: {
  state: SessionState
  busy: boolean
  refusal: ShownRefusal | null
  /** An add waiting on "below the pharmacy's stock, add anyway?" (the session's pending confirmation). */
  belowStock: boolean
  /** The customer step's seam (oms 917). */
  customerSlot: ReactNode
  onScan: (read: ScanRead) => void
  onKeyed: (code: KeyedCode) => void
  onQty: (line: SessionLine, qty: number) => void
  onRemove: (line: SessionLine) => void
  onSubmit: () => void
  onAbandon: () => void
  onAddAnyway: () => void
  onDontAdd: () => void
}) {
  const { t } = useTranslation('mini-pos-phone')
  const header = state.header

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="text-muted-foreground">{t('basket.pharmacy')}</span>
        <span className="font-medium">
          <Ltr>{header.plant}</Ltr> <bdi>{header.plantName}</bdi>
        </span>
      </div>

      {customerSlot}

      <ScannerView formats={ITEM_FORMATS} onRead={onScan} paused={busy || belowStock} />
      <KeyedCodeField label={t('basket.codeLabel')} action={t('basket.add')} disabled={busy || belowStock} onCode={onKeyed} />

      {belowStock && (
        <div role="alertdialog" className="flex flex-col gap-2 rounded-lg border border-attention-border bg-attention-050 p-3 text-sm">
          <p>{t('basket.belowStock')}</p>
          <div className="flex gap-2">
            <Button className="h-10 flex-1 justify-center" disabled={busy} onClick={onAddAnyway}>
              {t('basket.addAnyway')}
            </Button>
            <Button variant="outlined" className="h-10 flex-1 justify-center" disabled={busy} onClick={onDontAdd}>
              {t('basket.dontAdd')}
            </Button>
          </div>
        </div>
      )}

      {refusal && <RefusalBanner refusal={refusal} />}

      {state.lines.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">{t('basket.empty')}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border rounded-lg border border-border bg-card">
          {state.lines.map((line) => (
            <li key={line.lineId} data-line={line.itemNumber} className="flex flex-col gap-2 p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <bdi className="block font-medium">{line.description}</bdi>
                  <span className="text-xs text-muted-foreground">
                    <Ltr>{line.itemNumber}</Ltr>
                  </span>
                </div>
                <span className="font-mono font-semibold">
                  <Ltr>{formatMoneyOfUnknownCurrency(line.lineTotal.gross)}</Ltr>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <IconButton
                  label={t('basket.decrease')}
                  variant="outlined"
                  className="size-10"
                  disabled={busy || line.qty <= 1}
                  onClick={() => onQty(line, line.qty - 1)}
                >
                  <Minus className="size-4" aria-hidden />
                </IconButton>
                <span className="min-w-8 text-center font-mono" title={t('basket.qty')}>
                  <Ltr>{line.qty}</Ltr>
                </span>
                <IconButton label={t('basket.increase')} variant="outlined" className="size-10" disabled={busy} onClick={() => onQty(line, line.qty + 1)}>
                  <Plus className="size-4" aria-hidden />
                </IconButton>
                <span className="ms-auto text-xs text-muted-foreground">
                  <Ltr>{formatMoneyOfUnknownCurrency(line.unitPrice.gross)}</Ltr>
                </span>
                <IconButton label={t('basket.remove')} variant="danger" className="size-10" disabled={busy} onClick={() => onRemove(line)}>
                  <Trash2 className="size-4" aria-hidden />
                </IconButton>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-baseline justify-between text-base">
        <span className="font-medium">{t('basket.total')}</span>
        <span className="font-mono text-xl font-bold">
          <Ltr>{formatMoneyOfUnknownCurrency(state.totals.payable)}</Ltr>
        </span>
      </div>

      <Button
        className="h-12 w-full text-base justify-center"
        disabled={busy || belowStock || state.lines.length === 0 || !state.capabilities.canSubmit}
        onClick={onSubmit}
      >
        {busy ? t('app.working') : t('basket.submit')}
      </Button>
      <Button variant="text" className="h-10 w-full justify-center" disabled={busy} onClick={onAbandon}>
        {t('basket.abandon')}
      </Button>
    </div>
  )
}
