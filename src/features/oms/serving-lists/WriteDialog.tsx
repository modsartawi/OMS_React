import type { ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'

import Button, { type ButtonVariant } from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Ltr from '@/core/ui/Ltr'
import Modal from '@/core/ui/Modal'
import { formatCount } from '@/core/util/bidi'
import { SERVING_LISTS_KEY, SERVING_LIST_CHANGES_KEY, SERVING_LIST_MEMBERS_KEY } from './api'
import { NOTE_MAX } from './name-form'
import type { WriteRefusal } from './write-refusal'

/**
 * The shell every serving-list write dialog shares (oms ticket 570): the body, the optional note (at most 500,
 * the door clamps it), the refusal by code with the server's "English / Arabic" text as the fallback, and the
 * Cancel / confirm footer. The dialog stays open on a refusal so the note is not lost.
 */
export default function WriteDialog({
  hook,
  title,
  confirmLabel,
  confirmVariant = 'primary',
  ready,
  busy,
  refusal,
  note,
  onNote,
  onConfirm,
  onClose,
  children,
}: {
  /** `data-write-dialog` value, for the drive. */
  hook: string
  title: string
  confirmLabel: string
  confirmVariant?: ButtonVariant
  ready: boolean
  busy: boolean
  refusal: WriteRefusal | null
  note: string
  onNote: (v: string) => void
  onConfirm: () => void
  onClose: () => void
  children?: ReactNode
}) {
  const { t } = useTranslation('serving-lists')
  const go = ready && !busy && refusal?.kind !== 'notGranted'
  return (
    <Modal
      open
      onClose={() => !busy && onClose()}
      title={title}
      width="34rem"
      footer={
        <>
          <Button variant="text" onClick={onClose} disabled={busy} data-write-cancel="">
            {t('writes.cancel')}
          </Button>
          <Button variant={confirmVariant} disabled={!go} onClick={() => go && onConfirm()} data-write-confirm="">
            {busy && <Loader2 className="h-3 w-3 animate-spin" aria-hidden />}
            {busy ? t('writes.saving') : confirmLabel}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3" data-write-dialog={hook}>
        {children}

        <NoteField label={t('writes.note')} value={note} onChange={onNote} disabled={busy} hook="write-note" />

        <RefusalBanner refusal={refusal} />
      </div>
    </Modal>
  )
}

/**
 * A write's optional note (every serving-list write takes one): free text in either script, at most `NOTE_MAX`
 * (the door clamps it), with its count. Shared by `WriteDialog` and the add-stores dialog (569). `hook` names
 * the textarea's `data-*` attribute, for the drives.
 */
export function NoteField({
  label,
  value,
  onChange,
  disabled,
  hook,
  rows = 3,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  disabled: boolean
  hook: string
  rows?: number
}) {
  return (
    <label className="flex flex-col gap-1 text-xs font-medium">
      <span className="flex items-baseline justify-between gap-2">
        {label}
        <span className="font-mono font-normal text-muted-foreground tabular-nums">
          <Ltr>{formatCount(value.length, NOTE_MAX)}</Ltr>
        </span>
      </span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        dir="auto"
        maxLength={NOTE_MAX}
        disabled={disabled}
        className="rounded-md border border-border/60 bg-background px-2 py-1.5 text-sm font-normal text-foreground outline-none focus:border-primary/60 disabled:opacity-60"
        {...{ [`data-${hook}`]: '' }}
      />
    </label>
  )
}

function RefusalBanner({ refusal }: { refusal: WriteRefusal | null }) {
  const { t } = useTranslation('serving-lists')
  if (!refusal) return null
  if (refusal.kind === 'notGranted') {
    return (
      <ErrorBanner className="p-2" title={t('writes.notGrantedTitle')} message={t('writes.notGranted')}>
        <span data-write-refusal="notGranted" />
      </ErrorBanner>
    )
  }
  if (refusal.kind === 'failed') {
    return (
      <ErrorBanner className="p-2" title={t('writes.refusedTitle')} message={refusal.message || t('writes.failed')}>
        <span data-write-refusal="failed" />
      </ErrorBanner>
    )
  }
  // Our words for a known code, the server's text otherwise (ErrorBanner isolates it with <bdi>).
  return (
    <ErrorBanner className="p-2" title={t('writes.refusedTitle')} message={refusal.labelKey ? t(refusal.labelKey) : refusal.message || t('writes.failed')}>
      {refusal.stale && (
        <span className="me-2 text-xs" data-write-refreshed="">
          {t('writes.refreshed')}
        </span>
      )}
      <span className="font-mono text-xs" data-write-refusal={refusal.code}>
        <Ltr>{refusal.code}</Ltr>
      </span>
    </ErrorBanner>
  )
}

/** After a write (or a stale refusal): re-read Lists, and this list's Members and Changes. */
export function useRefreshList() {
  const qc = useQueryClient()
  return (servingListId: string) => {
    void qc.invalidateQueries({ queryKey: SERVING_LISTS_KEY })
    void qc.invalidateQueries({ queryKey: [...SERVING_LIST_MEMBERS_KEY, servingListId] })
    void qc.invalidateQueries({ queryKey: [...SERVING_LIST_CHANGES_KEY, servingListId] })
  }
}
