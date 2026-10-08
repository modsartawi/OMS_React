import { useMemo, useState } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { Ban, Check, Loader2, Power, RotateCcw, Undo2, X } from 'lucide-react'
import { apiErrorMessage } from '@/core/api'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Ltr from '@/core/ui/Ltr'
import Modal from '@/core/ui/Modal'
import { notify } from '@/core/services/notify'
import type { CouponDetails, CouponInstance, CouponTemplate, CouponTransaction, EarlierUpload } from '@/core/models/coupons'
import { couponsApi } from './api'
import { couponHistorySections, formatStamp } from './helpers'

// Shared coupon detail view (ticket 521) — an Instance summary, a read-only Template
// pane, and the redemption ledger ("where redeemed": Time / Store / Type / Reference /
// OK). `mode` tiers the actions: `admin` gets Deactivate/Reactivate + row-Refund +
// Reset; `support` gets read + Reactivate only (the 518 support gate allows reactivate
// and details, denies refund/reset/deactivate). Built here so the 523 Support screen
// reuses it. Every mutation re-reads via `onChanged`. A failed mutation is said inside
// its modal, which stays open (spec 380 F18: a toast under an open `showModal()` paints
// beneath its backdrop).
//
// Spec 2463 (ticket 439): under the current coupon, one read-only section per earlier upload that
// an admin deleted, with the ledger it carried. A deleted code (`isDeleted`) has no current coupon,
// so it shows only those sections: no instance or template card, and no actions. The sections come
// from `couponHistorySections`, exactly as the server grouped them.
type Mode = 'admin' | 'support'

type ActiveModal = 'instance' | 'refund' | 'reset' | null

interface Props {
  details: CouponDetails
  mode: Mode
  /** Re-read the coupon after a successful mutation (counts/state change). */
  onChanged: () => void | Promise<void>
}

export default function CouponDetailPane({ details, mode, onChanged }: Props) {
  const { t } = useTranslation('coupons')
  const sections = couponHistorySections(details)
  return (
    <div className="flex flex-col gap-4">
      {details.isDeleted && (
        <p className="rounded-lg border border-dashed border-border/60 bg-muted/20 p-4 text-sm text-muted-foreground">
          {t('inquiry.deletedNotice')}
        </p>
      )}
      {sections.map((section, i) =>
        section.kind === 'current' ? (
          details.instance && details.template ? (
            <CurrentCoupon
              key="current"
              instance={details.instance}
              template={details.template}
              transactions={section.transactions}
              mode={mode}
              onChanged={onChanged}
            />
          ) : (
            // Off-contract (the server nulls these only when `isDeleted`): keep the ledger rather than drop it.
            <LedgerTable key="current" transactions={section.transactions} />
          )
        ) : (
          <EarlierUploadSection key={`earlier-${i}`} upload={section.upload} />
        ),
      )}
    </div>
  )
}

interface CurrentProps {
  instance: CouponInstance
  template: CouponTemplate
  transactions: CouponTransaction[]
  mode: Mode
  onChanged: () => void | Promise<void>
}

/** The current coupon: instance + template cards, its actions, and its own ledger. */
function CurrentCoupon({ instance, template, transactions, mode, onChanged }: CurrentProps) {
  const { t } = useTranslation('coupons')
  const isAdmin = mode === 'admin'

  const [selectedTxnId, setSelectedTxnId] = useState<string | null>(null)
  const [modal, setModal] = useState<ActiveModal>(null)
  const [reason, setReason] = useState('')
  const [retype, setRetype] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)

  // A Refund row keyed on the reversed txn marks that redemption reversed — so a
  // successful Redeem that hasn't been reversed is the one refundable row.
  const refundedIds = useMemo(
    () =>
      new Set(
        transactions
          .filter((x) => x.redemptionType === 'Refund' && x.isSuccessful)
          .map((x) => x.refTransactionId),
      ),
    [transactions],
  )
  const isRefundable = (x: CouponTransaction) =>
    x.redemptionType === 'Redeem' && x.isSuccessful && !refundedIds.has(x.transactionId)

  function openModal(which: ActiveModal) {
    setReason('')
    setRetype('')
    setError(null)
    setModal(which)
  }
  function closeModal() {
    if (!busy) setModal(null)
  }

  // The instance toggle: disabled → Reactivate (re-enable), enabled → Deactivate (kill).
  const toggleAction: 'reactivate' | 'deactivate' = instance.isDisabled ? 'reactivate' : 'deactivate'
  // Support can reactivate a disabled instance, but never deactivate.
  const canToggle = isAdmin || (mode === 'support' && instance.isDisabled)

  // Only one of the three modals is ever open, so the one failure is drawn in whichever it is.
  const failureBanner =
    error === null ? null : (
      <ErrorBanner
        title={t('inquiry.actionFailed')}
        message={apiErrorMessage(error, t('inquiry.actionFailed'))}
        className="p-2.5"
      />
    )

  async function run(action: () => Promise<unknown>, successKey: string) {
    setBusy(true)
    setError(null)
    try {
      await action()
      notify.success(t(successKey))
      setModal(null)
      setSelectedTxnId(null)
      await onChanged()
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  const confirmInstance = () =>
    run(
      () =>
        toggleAction === 'deactivate'
          ? couponsApi.deactivateInstance(instance.couponCode, reason.trim())
          : couponsApi.reactivateInstance(instance.couponCode, reason.trim()),
      toggleAction === 'deactivate' ? 'inquiry.deactivated' : 'inquiry.reactivated',
    )

  const confirmRefund = () =>
    run(() => couponsApi.refund(selectedTxnId!, reason.trim()), 'inquiry.refunded')

  const resetReady = retype.trim() === instance.couponCode && reason.trim().length > 0
  const confirmReset = () =>
    run(() => couponsApi.reset(instance.couponCode, reason.trim()), 'inquiry.reset')

  return (
    <div className="flex flex-col gap-4">
      {/* Instance summary + Template (read-only), side by side */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <section className="rounded-lg border border-border/60 bg-card p-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold tracking-tight">{t('inquiry.instance.title')}</h2>
            <span
              className={
                'inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ' +
                (instance.isDisabled
                  ? 'bg-danger-050 text-danger-800'
                  : 'bg-success-050 text-success-800')
              }
            >
              {instance.isDisabled ? t('inquiry.instance.disabled') : t('inquiry.instance.active')}
            </span>
          </div>
          <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-sm">
            <Row label={t('inquiry.instance.code')} value={instance.couponCode} mono />
            <Row label={t('inquiry.instance.template')} value={instance.templateId} mono />
            <Row label={t('inquiry.instance.redeemCount')} value={String(instance.redeemCount)} />
            <Row label={t('inquiry.instance.customer')} value={instance.customerId || '—'} />
            <Row label={t('inquiry.instance.created')} value={formatStamp(instance.createdAt)} />
            <Row label={t('inquiry.instance.updated')} value={formatStamp(instance.updatedAt)} />
          </dl>
        </section>

        <section className="rounded-lg border border-border/60 bg-card p-4">
          <h2 className="mb-2 text-sm font-semibold tracking-tight">{t('inquiry.template.title')}</h2>
          <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-sm">
            <Row label={t('templates.fields.materialNumber')} value={template.materialNumber} />
            <Row label={t('templates.fields.description')} value={template.description || '—'} />
            <Row label={t('templates.fields.validFrom')} value={formatStamp(template.validFrom)} />
            <Row label={t('templates.fields.validTo')} value={formatStamp(template.validTo)} />
            <Row label={t('templates.fields.originFilter')} value={template.originFilter || '—'} />
            <Row
              label={t('inquiry.template.limits')}
              value={`${template.maxRedemptionsPerCode} / ${template.maxRedemptionsTotal}`}
            />
          </dl>
        </section>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-2">
        {canToggle && (
          <Button
            variant={toggleAction === 'deactivate' ? 'danger' : 'secondary'}
            onClick={() => openModal('instance')}
          >
            <Power className="h-3.5 w-3.5" />
            {toggleAction === 'deactivate' ? t('inquiry.actions.deactivate') : t('inquiry.actions.reactivate')}
          </Button>
        )}
        {isAdmin && (
          <>
            <Button variant="outlined" onClick={() => openModal('refund')} disabled={selectedTxnId === null}>
              <Undo2 className="h-3.5 w-3.5" />
              {t('inquiry.actions.refund')}
            </Button>
            <Button variant="danger" onClick={() => openModal('reset')}>
              <RotateCcw className="h-3.5 w-3.5" />
              {t('inquiry.actions.reset')}
            </Button>
          </>
        )}
        {isAdmin && (
          <span className="text-xs text-muted-foreground">{t('inquiry.actions.refundHint')}</span>
        )}
      </div>

      {/* Redemption ledger */}
      <div>
        <h2 className="mb-2 text-sm font-semibold tracking-tight">{t('inquiry.ledger.title')}</h2>
        {transactions.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border/60 bg-muted/20 p-6 text-center text-sm text-muted-foreground">
            {t('inquiry.ledger.empty')}
          </p>
        ) : (
          <LedgerTable
            transactions={transactions}
            select={
              isAdmin
                ? { selectedId: selectedTxnId, onSelect: setSelectedTxnId, isSelectable: isRefundable }
                : undefined
            }
          />
        )}
      </div>

      {/* Instance toggle modal (deactivate / reactivate) — simple confirm + reason */}
      <Modal
        open={modal === 'instance'}
        onClose={closeModal}
        title={toggleAction === 'deactivate' ? t('inquiry.deactivateModal.title') : t('inquiry.reactivateModal.title')}
        width="24rem"
        footer={
          <>
            <Button variant="text" onClick={closeModal} disabled={busy}>
              {t('inquiry.modal.cancel')}
            </Button>
            <Button
              variant={toggleAction === 'deactivate' ? 'danger' : 'primary'}
              onClick={() => void confirmInstance()}
              disabled={busy}
            >
              {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {toggleAction === 'deactivate' ? t('inquiry.actions.deactivate') : t('inquiry.actions.reactivate')}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3 text-sm">
          <p>
            {toggleAction === 'deactivate'
              ? t('inquiry.deactivateModal.body', { code: instance.couponCode })
              : t('inquiry.reactivateModal.body', { code: instance.couponCode })}
          </p>
          <ReasonField t={t} value={reason} onChange={setReason} />
          {failureBanner}
        </div>
      </Modal>

      {/* Refund modal — reverse the selected redemption; simple confirm + reason */}
      <Modal
        open={modal === 'refund'}
        onClose={closeModal}
        title={t('inquiry.refundModal.title')}
        width="24rem"
        footer={
          <>
            <Button variant="text" onClick={closeModal} disabled={busy}>
              {t('inquiry.modal.cancel')}
            </Button>
            <Button variant="primary" onClick={() => void confirmRefund()} disabled={busy || selectedTxnId === null}>
              {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {t('inquiry.actions.refund')}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3 text-sm">
          <p>{t('inquiry.refundModal.body')}</p>
          {selectedTxnId && <div className="font-mono text-xs text-muted-foreground">{selectedTxnId}</div>}
          <ReasonField t={t} value={reason} onChange={setReason} />
          {failureBanner}
        </div>
      </Modal>

      {/* Reset modal — erases ALL redemptions; requires retyping the code + a reason */}
      <Modal
        open={modal === 'reset'}
        onClose={closeModal}
        title={t('inquiry.resetModal.title')}
        width="26rem"
        footer={
          <>
            <Button variant="text" onClick={closeModal} disabled={busy}>
              {t('inquiry.modal.cancel')}
            </Button>
            <Button variant="danger" onClick={() => void confirmReset()} disabled={busy || !resetReady}>
              {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {t('inquiry.actions.reset')}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3 text-sm">
          <p className="flex items-start gap-2">
            <Ban className="mt-0.5 h-4 w-4 shrink-0 text-danger" aria-hidden />
            <span>{t('inquiry.resetModal.body', { count: instance.redeemCount })}</span>
          </p>
          <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
            {t('inquiry.resetModal.retype', { code: instance.couponCode })}
            <input
              type="text"
              className={inputCls}
              value={retype}
              autoComplete="off"
              onChange={(e) => setRetype(e.target.value)}
            />
          </label>
          <ReasonField t={t} value={reason} onChange={setReason} required />
          {failureBanner}
        </div>
      </Modal>
    </div>
  )
}

const inputCls =
  'rounded-md border border-input bg-background px-2.5 py-1.5 text-sm font-normal text-foreground outline-none focus:border-primary'

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={mono ? 'font-mono text-xs' : ''}>{value}</dd>
    </>
  )
}

function ReasonField({
  t,
  value,
  onChange,
  required,
}: {
  t: (k: string) => string
  value: string
  onChange: (v: string) => void
  required?: boolean
}) {
  return (
    <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
      {required ? t('inquiry.modal.reasonRequired') : t('inquiry.modal.reason')}
      <input type="text" className={inputCls} value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  )
}

interface LedgerSelect {
  selectedId: string | null
  onSelect: (transactionId: string) => void
  isSelectable: (x: CouponTransaction) => boolean
}

/** The redemption ledger ("where redeemed"). With `select`, a refundable row can be picked. */
function LedgerTable({ transactions, select }: { transactions: CouponTransaction[]; select?: LedgerSelect }) {
  const { t } = useTranslation('coupons')
  return (
    <div className="overflow-x-auto rounded-lg border border-border/60">
      <table className="w-full min-w-[44rem] text-sm">
        <thead>
          <tr className="border-b border-border/60 bg-muted/40 text-start text-xs uppercase tracking-wide text-muted-foreground">
            {select && <th className="w-8 px-3 py-2" />}
            <th className="px-3 py-2 font-medium">{t('inquiry.ledger.col.time')}</th>
            <th className="px-3 py-2 font-medium">{t('inquiry.ledger.col.store')}</th>
            <th className="px-3 py-2 font-medium">{t('inquiry.ledger.col.type')}</th>
            <th className="px-3 py-2 font-medium">{t('inquiry.ledger.col.reference')}</th>
            <th className="px-3 py-2 text-center font-medium">{t('inquiry.ledger.col.ok')}</th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((x) => {
            const selectable = select?.isSelectable(x) ?? false
            return (
              <tr key={x.transactionId} className="border-b border-border/40 last:border-0">
                {select && (
                  <td className="px-3 py-2">
                    <input
                      type="radio"
                      name="txn"
                      className="h-4 w-4 accent-primary disabled:opacity-40"
                      checked={select.selectedId === x.transactionId}
                      disabled={!selectable}
                      title={selectable ? undefined : t('inquiry.ledger.notRefundable')}
                      onChange={() => select.onSelect(x.transactionId)}
                    />
                  </td>
                )}
                <td className="px-3 py-2 text-xs text-muted-foreground">{formatStamp(x.redemptionTime)}</td>
                <td className="px-3 py-2">{x.storeCode || '—'}</td>
                <td className="px-3 py-2">{t(`inquiry.status.${x.redemptionType}`, { defaultValue: x.redemptionType })}</td>
                <td className="px-3 py-2 font-mono text-xs">{x.transactionReference || '—'}</td>
                <td className="px-3 py-2 text-center">
                  {x.isSuccessful ? (
                    <Check className="mx-auto h-4 w-4 text-success" aria-label="ok" />
                  ) : (
                    <X className="mx-auto h-4 w-4 text-danger" aria-label="failed" />
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

/** One deleted upload's coupon of this code: who deleted it, when and why, and its ledger. Read-only. */
function EarlierUploadSection({ upload }: { upload: EarlierUpload }) {
  const { t } = useTranslation('coupons')
  return (
    <section data-testid="earlier-upload" className="rounded-lg border border-border/60 bg-muted/10 p-4">
      <h2 className="text-sm font-semibold tracking-tight">
        <Trans
          t={t}
          i18nKey="inquiry.earlier.title"
          values={{ at: formatStamp(upload.deletedAt), by: upload.deletedBy, reason: upload.reason.trim() || '—' }}
          components={{ at: <Ltr />, by: <Ltr />, reason: <bdi /> }}
        />
      </h2>
      <div className="mt-1 mb-3 flex flex-wrap gap-x-4 text-xs text-muted-foreground">
        <span>
          <Trans t={t} i18nKey="inquiry.earlier.template" values={{ templateId: upload.templateId }} components={{ id: <Ltr /> }} />
        </span>
        <span>
          <Trans
            t={t}
            i18nKey="inquiry.earlier.redemptions"
            count={upload.redeemCount}
            values={{ n: upload.redeemCount.toLocaleString('en-US') }}
            components={{ n: <Ltr /> }}
          />
        </span>
      </div>
      {upload.transactions.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('inquiry.ledger.empty')}</p>
      ) : (
        <LedgerTable transactions={upload.transactions} />
      )}
    </section>
  )
}
