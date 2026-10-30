import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { RuleId } from '@/core/insurance-rules/badges'
import { TD } from '@/core/insurance-rules/parts'
import { DriftSignalWords } from '@/core/insurance-rules/DriftBadges'
import { labelsDraftPath } from '@/core/insurance-rules/LabelsChangedBadge'
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
import { formatPair, formatRange } from '@/core/util/bidi'
import { formatDateTime } from '@/core/util/date-format'
import { REVIEW_KEY, reviewApi } from './api'
import { REVIEW_KINDS, packageDiffGroups, type MessageRef as MessageSource, type MonitorSeverity, type PackageDiff, type ReviewCleared, type ReviewRow } from './model'

// The Review list's non-decision rows (spec 3271; oms tickets 702, 708): what each kind says, its clearing and its dialog.
// A new kind (703) adds a case to `ItemDetail`; the row, the dialog and the clearing are the same for all.

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
function MessageRef({ message, label = 'item.message' }: { message: MessageSource | null; label?: 'item.message' | 'item.sample' }) {
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
        <MessageRef message={d.message} />
      </div>
    )
  }
  if (d.shape === 'labelsChanged') {
    return (
      <div className="flex flex-wrap items-center gap-2" data-item-detail="" data-reads="labels">
        <span data-item-labels-badge="">
          <StatusBadge sev="warn">{t('kind.labelsChanged')}</StatusBadge>
        </span>
        {d.ruleset && (
          <span className="inline-flex flex-wrap items-baseline gap-x-1.5">
            <bdi data-item-ruleset="">{d.ruleset.name}</bdi>
            <span className="text-xs text-muted-foreground">
              {t('item.labels.version')} <Ltr>{d.ruleset.version}</Ltr>
            </span>
          </span>
        )}
        <Link to={labelsDraftPath(d.draftId)} className="text-primary hover:underline" data-item-draft-link={d.draftId ?? ''}>
          {t(d.draftId ? 'item.labels.openDraft' : 'item.labels.toDrafts')}
        </Link>
      </div>
    )
  }
  if (d.shape === 'uploadDue') {
    return (
      <div className="flex flex-wrap items-center gap-2" data-item-detail="" data-reads="upload">
        <span data-item-due={d.why ?? 'unstated'}>{t(`item.due.${d.why ?? 'unstated'}`)}</span>
        {d.version && (
          <span className="text-xs text-muted-foreground" data-item-due-version="">
            {t('item.due.version')} <Ltr>{d.version}</Ltr>
          </span>
        )}
        {d.code && (
          <span className="font-mono text-[12px]" data-item-due-code="">
            <Ltr>{formatPair(d.code.system, d.code.code)}</Ltr>
          </span>
        )}
        <Link to="/insurance-rules/code-labels" className="text-primary hover:underline" data-item-upload-link="">
          {t('item.due.upload')}
        </Link>
      </div>
    )
  }
  if (d.shape === 'package') {
    const groups = packageDiffGroups(d.diff)
    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1" data-item-detail="" data-reads="package">
        <span>{t('item.package.says')}</span>
        {d.version && (
          <span className="text-xs text-muted-foreground" data-item-package-version="">
            {t('item.package.version')} <Ltr>{d.previousVersion ? formatRange(d.previousVersion, d.version) : d.version}</Ltr>
          </span>
        )}
        {groups.map((g) => (
          <span key={g.group} className="text-xs text-muted-foreground" data-item-package-count={g.group}>
            {t(`item.package.group.${g.group}`)} <Ltr>{g.count}</Ltr>
          </span>
        ))}
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
        <MessageRef message={d.sample} label="item.sample" />
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
      <MessageRef message={d.message} />
    </div>
  )
}

/** A package item's diff: what was added, removed and renamed, by group. Names are machine values, each its own isolate. */
function PackageDiffView({ diff }: { diff: PackageDiff }) {
  const { t } = useTranslation('insurance-review')
  const groups = packageDiffGroups(diff)
  if (groups.length === 0) {
    return (
      <p className="text-muted-foreground" data-package-diff-empty="">
        {t('item.package.empty')}
      </p>
    )
  }
  return (
    <div className="flex flex-col gap-3" data-package-diff="">
      {groups.map((g) => (
        <section key={g.group} className="overflow-x-auto rounded-md border border-border/60" data-package-group={g.group}>
          <h3 className="px-2 py-1.5 text-xs font-semibold">{t(`item.package.group.${g.group}`)}</h3>
          <table className="w-full text-sm">
            <tbody>
              {g.lines.map((l) => (
                <tr key={`${l.change}/${l.name}`} className="border-t border-border/60" data-package-line={l.change}>
                  <td className={`${TD} text-xs whitespace-nowrap`}>{t(`item.package.change.${l.change}`)}</td>
                  <td className={`${TD} font-mono text-xs break-all`} data-package-name="">
                    <Ltr>{l.name}</Ltr>
                  </td>
                  <td className={`${TD} font-mono text-xs break-all`} data-package-renamed-to="">
                    {l.renamedTo && <Ltr>{l.renamedTo}</Ltr>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}
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
      width={row.detail.shape === 'package' ? '48rem' : '30rem'}
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
        {row.detail.shape === 'package' && <PackageDiffView diff={row.detail.diff} />}
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
