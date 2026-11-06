import { useId, useState, type ReactNode } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'

import { apiErrorCode, apiErrorMessage } from '@/core/api'
import type { LiveSlot, SlotPool } from '@/core/models/release-queue'
import { notify } from '@/core/services/notify'
import Button, { type ButtonVariant } from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Field from '@/core/ui/Field'
import Input from '@/core/ui/Input'
import Ltr from '@/core/ui/Ltr'
import Modal from '@/core/ui/Modal'
import { formatPair, formatRange, fsi } from '@/core/util/bidi'
import { formatDateTime } from '@/core/util/date-format'
import { formatFigure } from '@/core/util/number-format'
import { invalidateManagedReads, releaseQueueApi } from './api'
import { MAX_POOL_SIZE, poolChangeKind, poolReading, poolSizeDraft, progressPercent, type PoolChange, type PoolChangeKind } from './helpers'

/**
 * The release download queue's Manage controls (ticket 792, BackOffice 3402) — drawn only for `PosRelease.Queue.Manage`
 * (`showsControls`). Nothing is sent without a confirm on the app modal: resizing (0 = **Paused**, worded on its own)
 * and freeing one live slot (the confirm names the till). Every answer re-reads the pool, the slots, the queue, the
 * history, the convergence and the audit, so the page shows HQ's state, never one guessed here.
 */

/** The refusals 3402's doors answer with a code (400 envelopes); their own sentence is shown, this adds what to do. */
const REFUSAL_HINT: Record<string, string> = {
  'POSREL-SLOT-001': 'manage.refusal.outOfRange',
  'POSREL-SLOT-002': 'manage.refusal.noUser',
  'POSREL-SLOT-003': 'manage.refusal.busy',
}

/** The shared confirm: a sentence or two, Cancel, and the action; a refusal stays in the dialog with its code. */
function ConfirmDialog({
  title,
  confirmLabel,
  confirmVariant,
  busy,
  error,
  onConfirm,
  onClose,
  testId,
  children,
}: {
  title: string
  confirmLabel: string
  confirmVariant: ButtonVariant
  busy: boolean
  error: unknown
  onConfirm: () => void
  onClose: () => void
  testId: string
  children: ReactNode
}) {
  const { t } = useTranslation('release-queue')
  const code = error ? apiErrorCode(error) : null
  const hint = code ? REFUSAL_HINT[code] : undefined
  return (
    <Modal
      open
      title={title}
      onClose={() => !busy && onClose()}
      footer={
        <>
          <Button variant="text" onClick={onClose} disabled={busy} data-confirm-cancel="">
            {t('manage.cancel')}
          </Button>
          <Button variant={confirmVariant} onClick={() => !busy && onConfirm()} disabled={busy} data-confirm-ok="">
            {busy && <Loader2 className="h-3 w-3 animate-spin" aria-hidden />}
            {busy ? t('manage.sending') : confirmLabel}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3 text-sm" data-confirm={testId}>
        {children}
        {error != null && (
          <ErrorBanner className="p-2" title={t('manage.failed')} message={apiErrorMessage(error, t('manage.failedHint'))}>
            {hint && (
              <span className="me-2 text-xs" data-confirm-error-hint="">
                {t(hint)}
              </span>
            )}
            {code && (
              <span className="font-mono text-xs" data-confirm-error={code}>
                <Ltr>{code}</Ltr>
              </span>
            )}
          </ErrorBanner>
        )}
      </div>
    </Modal>
  )
}

/** A pool size in a sentence: the word Paused for 0, else the grouped figure (isolated by the caller). */
function useSizeWord() {
  const { t } = useTranslation('release-queue')
  return (size: number) => {
    const r = poolReading(size)
    return r.paused ? t('manage.pool.pausedWord') : formatFigure(r.size)
  }
}

/** The isolate a size takes in a sentence: a figure is a machine value (`Ltr`), the word Paused free text (`<bdi>`). */
const sizeSlot = (size: number) => (size === 0 ? <bdi /> : <Ltr />)

const CONFIRM_VARIANT: Record<Exclude<PoolChangeKind, 'same'>, ButtonVariant> = {
  pause: 'danger',
  resume: 'primary',
  resize: 'primary',
}

/** The pool-size box and its Apply button, in the pool strip. */
export function PoolEditor({ pool }: { pool: SlotPool }) {
  const { t } = useTranslation('release-queue')
  // null = not editing: the box shows HQ's size, and follows it as it re-reads.
  const [draft, setDraft] = useState<string | null>(null)
  // The change as it stood when Apply was pressed: the confirm words THIS change, even if the polled pool moves under it.
  const [confirming, setConfirming] = useState<PoolChangeAsked | null>(null)
  const id = useId()
  const text = draft ?? String(pool.poolSize)
  const size = poolSizeDraft(text)
  const kind = size === null ? null : poolChangeKind(pool.poolSize, size)
  const invalid = size === null
  const ask = () => {
    if (size !== null && kind !== null && kind !== 'same') setConfirming({ from: pool.poolSize, to: size, kind })
  }

  return (
    <div className="flex flex-wrap items-end gap-2" data-pool-editor="">
      <Field
        id={id}
        label={t('manage.pool.label')}
        hint={invalid ? undefined : t('manage.pool.hint')}
        error={invalid ? t('manage.pool.invalid', { max: fsi(formatFigure(MAX_POOL_SIZE)) }) : undefined}
      >
        <Input
          className="w-20 font-mono tabular-nums"
          dir="ltr"
          inputMode="numeric"
          value={text}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && ask()}
          data-pool-size-input=""
        />
      </Field>
      <Button
        variant={kind === 'pause' ? 'danger-outlined' : 'secondary'}
        disabled={size === null || kind === 'same'}
        onClick={ask}
        data-pool-apply={kind ?? 'invalid'}
      >
        {t(`manage.pool.apply.${kind === 'pause' || kind === 'resume' ? kind : 'resize'}`)}
      </Button>
      {draft !== null && (
        <Button variant="text" onClick={() => setDraft(null)} data-pool-reset="">
          {t('manage.pool.reset')}
        </Button>
      )}
      {confirming !== null && (
        <PoolSizeDialog
          pool={pool}
          asked={confirming}
          onClose={() => setConfirming(null)}
          onDone={() => {
            setConfirming(null)
            setDraft(null)
          }}
        />
      )}
    </div>
  )
}

/** A resize as asked at Apply: from the size the page showed then, to the box's size; never `same`. */
interface PoolChangeAsked {
  from: number
  to: number
  kind: Exclude<PoolChangeKind, 'same'>
}

/**
 * The resize confirm: a pause says what stops, a resume what restarts, a resize from what to what. Worded from the
 * change asked at Apply; if the polled pool has moved since (another manager), it says so instead of quietly becoming a
 * different action or vanishing — the manager decides with the live size in front of them.
 */
function PoolSizeDialog({ pool, asked, onClose, onDone }: { pool: SlotPool; asked: PoolChangeAsked; onClose: () => void; onDone: () => void }) {
  const { t } = useTranslation('release-queue')
  const qc = useQueryClient()
  const sizeWord = useSizeWord()
  const { from, to, kind } = asked
  const now = pool.poolSize
  const send = useMutation({
    mutationFn: () => releaseQueueApi.setPoolSize(to),
    onSuccess: (answer) => {
      const size = fsi(sizeWord(answer.newPoolSize))
      if (!answer.changed) notify.info(t('manage.pool.done.same', { size }))
      else notify.success(t(`manage.pool.done.${poolChangeKind(answer.oldPoolSize, answer.newPoolSize)}`, { size }))
      invalidateManagedReads(qc)
      onDone()
    },
  })
  const v = { from: sizeWord(from), to: sizeWord(to), size: fsi(formatFigure(to)) }
  return (
    <ConfirmDialog
      testId={`pool-${kind}`}
      title={t(`manage.pool.confirm.${kind}Title`, { size: v.size })}
      confirmLabel={t(`manage.pool.apply.${kind}`)}
      confirmVariant={CONFIRM_VARIANT[kind]}
      busy={send.isPending}
      error={send.error}
      onConfirm={() => send.mutate()}
      onClose={onClose}
    >
      <p data-confirm-change="">
        <Trans t={t} i18nKey="manage.pool.confirm.change" values={{ from: v.from, to: v.to }} components={{ from: sizeSlot(from), to: sizeSlot(to) }} />
      </p>
      {now !== from && (
        <p className="rounded-md bg-attention-050 px-3 py-2 text-attention-800" role="alert" data-confirm-moved={now}>
          <Trans
            t={t}
            i18nKey={now === to ? 'manage.pool.confirm.movedToSame' : 'manage.pool.confirm.moved'}
            values={{ now: sizeWord(now), to: sizeWord(to) }}
            components={{ now: sizeSlot(now), to: sizeSlot(to) }}
          />
        </p>
      )}
      <p className={kind === 'pause' ? 'rounded-md bg-danger-050 px-3 py-2 text-danger-800' : 'text-muted-foreground'} data-confirm-note={kind}>
        {t(`manage.pool.confirm.${kind}Note`)}
      </p>
      {kind !== 'resume' && pool.activeSlots > 0 && (
        <p className="text-xs text-muted-foreground" data-confirm-active={pool.activeSlots}>
          <Trans t={t} i18nKey="manage.pool.confirm.active" values={{ n: formatFigure(pool.activeSlots) }} components={{ n: <Ltr /> }} />
        </p>
      )}
    </ConfirmDialog>
  )
}

/** The free confirm: it names the till, its store and what it is downloading. */
export function FreeSlotDialog({ slot, onClose }: { slot: LiveSlot; onClose: () => void }) {
  const { t } = useTranslation('release-queue')
  const qc = useQueryClient()
  const send = useMutation({
    mutationFn: () => releaseQueueApi.freeSlot(slot.leaseId),
    onSuccess: (answer) => {
      const till = fsi(slot.machineCode)
      if (answer.freed) notify.success(t('manage.free.done', { till }))
      else notify.warn(t('manage.free.notLive', { till }), t('manage.free.notLiveHint'))
      invalidateManagedReads(qc)
      onClose()
    },
  })
  return (
    <ConfirmDialog
      testId="free"
      title={t('manage.free.title', { till: fsi(slot.machineCode) })}
      confirmLabel={t('manage.free.confirm')}
      confirmVariant="danger"
      busy={send.isPending}
      error={send.error}
      onConfirm={() => send.mutate()}
      onClose={onClose}
    >
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs">
        <dt className="text-muted-foreground">{t('manage.free.slot')}</dt>
        <dd className="font-mono" data-confirm-till={slot.machineCode}>
          <Ltr>{formatPair(slot.storeCode, slot.machineCode)}</Ltr>
        </dd>
        <dt className="text-muted-foreground">{t('columns.versions')}</dt>
        <dd className="font-mono">
          <Ltr>{formatRange(slot.fromVersion, slot.toVersion)}</Ltr>
        </dd>
        <dt className="text-muted-foreground">{t('columns.progress')}</dt>
        <dd className="font-mono">
          <Ltr>{`${progressPercent(slot.progressPercent)}%`}</Ltr>
        </dd>
      </dl>
      <p className="rounded-md bg-muted px-3 py-2 text-muted-foreground">{t('manage.free.note')}</p>
    </ConfirmDialog>
  )
}

/** Who last changed the pool and when, from the Audit when it holds a resize, else from the pool's own stamp. */
export function LastChange({ pool, change }: { pool: SlotPool; change: PoolChange | null }) {
  const { t } = useTranslation('release-queue')
  const sizeWord = useSizeWord()
  if (change)
    return (
      <span data-pool-changed="" data-pool-changed-from={change.from} data-pool-changed-to={change.to}>
        <Trans
          t={t}
          i18nKey="pool.changedFromTo"
          values={{ v: formatPair(formatDateTime(change.at), change.by), from: sizeWord(change.from), to: sizeWord(change.to) }}
          components={{ v: <Ltr />, from: sizeSlot(change.from), to: sizeSlot(change.to) }}
        />
      </span>
    )
  return (
    <span data-pool-changed="">
      {pool.isDefault ? (
        t('pool.default')
      ) : (
        <Trans t={t} i18nKey="pool.changed" values={{ v: formatPair(formatDateTime(pool.updatedAt), pool.updatedBy) }} components={{ v: <Ltr /> }} />
      )}
    </span>
  )
}
