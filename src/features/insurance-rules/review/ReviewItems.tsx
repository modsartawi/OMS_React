import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { RuleId } from '@/core/insurance-rules/badges'
import { DriftSignalWords } from '@/core/insurance-rules/DriftBadges'
import { DRIFT_BADGES_KEY } from '@/core/insurance-rules/registry-api'
import { saysIn } from '@/core/rules/sentence'
import { notify } from '@/core/services/notify'
import Button from '@/core/ui/Button'
import Field from '@/core/ui/Field'
import Ltr from '@/core/ui/Ltr'
import Modal from '@/core/ui/Modal'
import StatusBadge from '@/core/ui/StatusBadge'
import Textarea from '@/core/ui/Textarea'
import type { Severity } from '@/core/ui/severity'
import { formatPair } from '@/core/util/bidi'
import { formatDateTime } from '@/core/util/date-format'
import { REVIEW_KEY, reviewApi } from './api'
import { REVIEW_KINDS, type MessageRef, type MonitorSeverity, type ReviewCleared, type ReviewRow } from './model'

// The Review list's non-decision rows (spec 3271; oms ticket 702): what each kind says, its clearing and its dialog.
// A new kind (703, 708) adds a case to `ItemDetail`; the row, the dialog and the clearing are the same for all.

const SEVERITY_SEV: Record<MonitorSeverity, Severity> = { info: 'go', action: 'warn' }

/** A row's kind in words. A kind the screen has never heard of says so and shows its code: never a raw key. */
export function KindWord({ kind }: { kind: string }) {
  const { t } = useTranslation('insurance-review')
  if ((REVIEW_KINDS as readonly string[]).includes(kind)) return <>{t(`kind.${kind}`)}</>
  return (
    <>
      {t('item.otherKind')}
      {kind && (
        <span className="ms-1 font-mono text-[12px]" data-unknown-kind={kind}>
          <Ltr>{kind}</Ltr>
        </span>
      )}
    </>
  )
}

/** The message's `(source, id)`, one isolate: a pair led by a machine value. */
function Message({ message, label = 'item.message' }: { message: MessageRef | null; label?: 'item.message' | 'item.sample' }) {
  const { t } = useTranslation('insurance-review')
  if (!message) return null
  return (
    <span className="text-xs text-muted-foreground" data-item-message="">
      {t(label)}{' '}
      <span className="font-mono text-[12px]">
        <Ltr>{formatPair(message.source, message.id)}</Ltr>
      </span>
    </span>
  )
}

/** What an item says, by its shape. */
export function ItemDetail({ row }: { row: ReviewRow }) {
  const { t, i18n } = useTranslation('insurance-review')
  const d = row.detail
  if (d.shape === 'decision') return null
  const rule = row.ruleId ? <RuleId id={row.ruleId} /> : null
  if (d.shape === 'notEvaluated') {
    return (
      <div className="flex flex-wrap items-center gap-2" data-item-detail="" data-reads="failure">
        <StatusBadge sev="bad">{t('item.failed')}</StatusBadge>
        {rule}
        <span data-item-failure={d.failure ?? 'unstated'}>{t(`item.failure.${d.failure ?? 'unstated'}`)}</span>
        <Message message={d.message} />
      </div>
    )
  }
  if (d.shape === 'drift') {
    return (
      <div className="flex flex-wrap items-center gap-2" data-item-detail="" data-reads="drift">
        {d.payer && (
          <span className="font-mono text-[12px]" data-item-payer="">
            <Ltr>{d.payer}</Ltr>
          </span>
        )}
        <span data-item-signal={d.signal.type}>
          <DriftSignalWords signal={d.signal} />
        </span>
        <Message message={d.sample} label="item.sample" />
        <span className="text-xs text-muted-foreground" data-item-still-running="">
          {t('item.stillRunning')}
        </span>
      </div>
    )
  }
  const text = saysIn(d.text, i18n.language)
  return (
    <div className="flex flex-wrap items-center gap-2" data-item-detail="" data-reads={d.shape === 'monitor' ? 'fire' : 'generic'}>
      {d.shape === 'monitor' && d.severity && (
        <span data-item-severity={d.severity}>
          <StatusBadge sev={SEVERITY_SEV[d.severity]}>{t(`item.severity.${d.severity}`)}</StatusBadge>
        </span>
      )}
      {rule}
      {text && <bdi data-item-text="">{text}</bdi>}
      <Message message={d.message} />
    </div>
  )
}

/** The Review column of an item: cleared with its note and who, or still open. */
export function ItemClearing({ cleared }: { cleared: ReviewCleared | null }) {
  const { t } = useTranslation('insurance-review')
  if (!cleared) return <StatusBadge sev="mute">{t('item.notCleared')}</StatusBadge>
  return (
    <>
      <StatusBadge sev="ok">{t('item.cleared')}</StatusBadge>
      <div className="mt-1 text-xs text-muted-foreground">
        <bdi className="block" data-clear-note="">
          {cleared.note}
        </bdi>
        <span data-cleared-by="">
          {t('mark.by')} <Ltr>{cleared.by}</Ltr> <Ltr>{formatDateTime(cleared.at)}</Ltr>
        </span>
      </div>
    </>
  )
}

/** Open one item: what it says, and clear it with a note. A cleared item opens to read, and clears no further. */
export function ItemDialog({ row, onClose }: { row: ReviewRow; onClose: () => void }) {
  const { t } = useTranslation('insurance-review')
  const qc = useQueryClient()
  const [note, setNote] = useState('')
  const [tried, setTried] = useState(false)
  const needsNote = !note.trim()
  const clear = useMutation({
    mutationFn: () => reviewApi.clear(row.id, note.trim()),
    onSuccess: () => {
      notify.success(t('item.clearedToast'))
      void qc.invalidateQueries({ queryKey: REVIEW_KEY })
      void qc.invalidateQueries({ queryKey: DRIFT_BADGES_KEY })
      onClose()
    },
    onError: (err) => notify.apiError(t('item.clearFailed'), err, t('item.clearFailed')),
  })
  return (
    <Modal
      open
      onClose={onClose}
      title={t('item.dialogTitle')}
      footer={
        <>
          <Button variant="text" onClick={onClose}>
            {t('mark.cancel')}
          </Button>
          {!row.cleared && (
            <Button
              variant="primary"
              disabled={clear.isPending}
              data-item-clear=""
              onClick={() => {
                setTried(true)
                if (!needsNote) clear.mutate()
              }}
            >
              {t('item.clear')}
            </Button>
          )}
        </>
      }
    >
      <div className="flex flex-col gap-3 text-sm" data-item-dialog={row.id}>
        <p className="text-xs text-muted-foreground">
          <KindWord kind={row.kind} /> <Ltr>{formatDateTime(row.at)}</Ltr>
        </p>
        <ItemDetail row={row} />
        {row.cleared ? (
          <div data-item-dialog-cleared="">
            <ItemClearing cleared={row.cleared} />
          </div>
        ) : (
          <Field
            label={t('item.clearNote')}
            error={
              tried && needsNote ? (
                <span role="alert" data-clear-problem="">
                  {t('item.clearNoteRequired')}
                </span>
              ) : undefined
            }
          >
            <Textarea className="h-20" dir="auto" value={note} onChange={(e) => setNote(e.target.value)} data-clear-note-input="" />
          </Field>
        )}
      </div>
    </Modal>
  )
}
