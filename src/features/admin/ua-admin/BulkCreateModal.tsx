import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import { apiErrorMessage } from '@/core/api'
import Modal from '@/core/ui/Modal'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import StatusBadge from '@/core/ui/StatusBadge'
import type { Severity } from '@/core/ui/severity'
import { notify } from '@/core/services/notify'
import { downloadCsv } from '@/core/util/download-file'
import { uaAdminApi } from './api'
import {
  buildResultsCsv,
  readBulkFile,
  resultsFileName,
  tally,
  type BulkOutcome,
  type BulkRow,
} from './bulk-create'

interface Props {
  open: boolean
  onClose: () => void
  /** Something was written — the page refreshes its lists and counts. */
  onChanged: () => void
}

/**
 * pick → checking → preview → running → done. Everything that can refuse a row
 * refuses it in the PREVIEW (validation, role catalog, existing id); the run only
 * meets what the server alone can say.
 */
type Phase = 'pick' | 'checking' | 'preview' | 'running' | 'done'

const OUTCOME_SEV: Record<BulkOutcome, Severity> = {
  ready: 'go',
  blocked: 'bad',
  exists: 'mute',
  created: 'ok',
  roleFailed: 'warn',
  failed: 'bad',
}

const CELL = 'border-b border-border px-2 py-1 align-top'

/**
 * Bulk create External identities from a CSV (CONTEXT.md). Rows go one at a time
 * — upsert the identity, then assign its role — and the run carries on past a
 * failure: there is no batch door to roll back, so the honest shape is a per-row
 * result and a file of them.
 */
export default function BulkCreateModal({ open, onClose, onChanged }: Props) {
  const { t } = useTranslation('ua-admin')
  const [phase, setPhase] = useState<Phase>('pick')
  const [fileName, setFileName] = useState('')
  const [rows, setRows] = useState<BulkRow[]>([])
  const [error, setError] = useState<{ title?: string; message: string } | null>(null)
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const fileInput = useRef<HTMLInputElement>(null)

  const busy = phase === 'checking' || phase === 'running'

  function reset() {
    setPhase('pick')
    setFileName('')
    setRows([])
    setError(null)
    setProgress({ done: 0, total: 0 })
    if (fileInput.current) fileInput.current.value = ''
  }

  // A run in flight cannot be abandoned by Escape or a backdrop click: the rows
  // it has not reached yet would be neither created nor reported.
  function close() {
    if (busy) return
    onClose()
  }

  /** Mutates a row in place and republishes the array — rows are the run's ledger. */
  function patch(list: BulkRow[], i: number, over: Partial<BulkRow>) {
    list[i] = { ...list[i], ...over }
    setRows([...list])
  }

  async function onFile(file: File | null) {
    reset()
    if (!file) return
    setFileName(file.name)

    let roles
    try {
      roles = await uaAdminApi.roleCatalog()
    } catch (err) {
      setError({ title: t('bulk.rolesFailed'), message: apiErrorMessage(err, t('bulk.unexpected')) })
      return
    }

    const read = readBulkFile(await file.text(), roles)
    if (!read.ok) {
      setError({
        message: t(`bulk.readError.${read.error}`, {
          columns: read.missing.map((c) => t(`bulk.column.${c}`)).join(', '),
        }),
      })
      return
    }

    // The upsert would EDIT an existing person, so every id is asked about
    // before the admin is offered the Create button — one read per row.
    const list = read.rows
    setRows([...list])
    setPhase('checking')
    const toCheck = list.filter((r) => r.outcome === 'ready').length
    let checked = 0
    setProgress({ done: 0, total: toCheck })
    try {
      for (let i = 0; i < list.length; i++) {
        if (list[i].outcome !== 'ready') continue
        const status = await uaAdminApi.status(list[i].employeeId)
        if (status.found) list[i] = { ...list[i], outcome: 'exists' }
        setProgress({ done: ++checked, total: toCheck })
      }
    } catch (err) {
      setError({ title: t('bulk.checkFailed'), message: apiErrorMessage(err, t('bulk.unexpected')) })
      setPhase('pick')
      return
    }
    setRows([...list])
    setPhase('preview')
  }

  async function assign(list: BulkRow[], i: number) {
    try {
      await uaAdminApi.assignRole(list[i].employeeId, list[i].roleName)
      patch(list, i, { outcome: 'created', message: '' })
    } catch (err) {
      patch(list, i, { outcome: 'roleFailed', message: apiErrorMessage(err, t('bulk.unexpected')) })
    }
  }

  async function run() {
    const list = [...rows]
    const targets = list.flatMap((r, i) => (r.outcome === 'ready' ? [i] : []))
    setPhase('running')
    setProgress({ done: 0, total: targets.length })
    let done = 0
    for (const i of targets) {
      const r = list[i]
      try {
        await uaAdminApi.upsert({
          employeeId: r.employeeId,
          displayName: r.displayName,
          // External people have no number on file — email is their only channel,
          // chosen deliberately so the server does not read a blank as sms.
          phone: '',
          email: r.email,
          deliveryChannel: 'email',
          isActive: true,
        })
        if (r.roleName === '') patch(list, i, { outcome: 'created' })
        else await assign(list, i)
      } catch (err) {
        patch(list, i, { outcome: 'failed', message: apiErrorMessage(err, t('bulk.unexpected')) })
      }
      setProgress({ done: ++done, total: targets.length })
    }
    setPhase('done')
    onChanged()
    const n = tally(list)
    notify.success(
      t('bulk.doneToast'),
      t('bulk.doneToastDetail', { created: n.created, problems: n.roleFailed + n.failed }),
    )
  }

  /** Role assignment only — the identity already exists, and re-upserting it is what the skip rule forbids. */
  async function retryRoles() {
    const list = [...rows]
    const targets = list.flatMap((r, i) => (r.outcome === 'roleFailed' ? [i] : []))
    setPhase('running')
    setProgress({ done: 0, total: targets.length })
    let done = 0
    for (const i of targets) {
      await assign(list, i)
      setProgress({ done: ++done, total: targets.length })
    }
    setPhase('done')
    onChanged()
  }

  const n = tally(rows)

  const footer =
    phase === 'preview' ? (
      <>
        <Button variant="text" onClick={reset}>
          {t('bulk.reset')}
        </Button>
        <Button variant="primary" onClick={() => void run()} disabled={n.ready === 0}>
          {t('bulk.create', { count: n.ready })}
        </Button>
      </>
    ) : phase === 'done' ? (
      <>
        {n.roleFailed > 0 && (
          <Button variant="secondary" onClick={() => void retryRoles()}>
            {t('bulk.retryRoles', { count: n.roleFailed })}
          </Button>
        )}
        <Button
          variant="outlined"
          onClick={() => downloadCsv(resultsFileName(new Date()), buildResultsCsv(rows, (key) => t(key)))}
        >
          {t('bulk.download')}
        </Button>
        <Button variant="primary" onClick={close}>
          {t('bulk.close')}
        </Button>
      </>
    ) : (
      <Button variant="text" onClick={close} disabled={busy}>
        {t('common.cancel')}
      </Button>
    )

  return (
    <Modal open={open} onClose={close} title={t('bulk.title')} width="60rem" onShow={reset} footer={footer}>
      {phase === 'pick' && (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-muted-foreground">{t('bulk.intro')}</p>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium">{t('bulk.chooseFile')}</span>
            <input
              ref={fileInput}
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => void onFile(e.target.files?.[0] ?? null)}
              className="rounded-md border border-border bg-card p-2 text-sm file:me-3 file:rounded-full file:border-0 file:bg-muted file:px-3 file:py-1 file:text-xs"
            />
            <span className="text-xs text-muted-foreground">{t('bulk.saveAsHint')}</span>
          </label>
        </div>
      )}

      {error && <ErrorBanner title={error.title} message={error.message} className="mt-3 p-3" />}

      {phase !== 'pick' && (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="text-muted-foreground">{t('bulk.fileName', { name: fileName })}</span>
            <span className="font-medium tabular-nums" role="status">
              {busy ? (
                <span className="inline-flex items-center gap-1.5">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  {phase === 'checking'
                    ? t('bulk.checking', { done: progress.done, total: progress.total })
                    : t('bulk.progress', { done: progress.done, total: progress.total })}
                </span>
              ) : phase === 'preview' ? (
                t('bulk.summary', n)
              ) : (
                t('bulk.resultSummary', n)
              )}
            </span>
          </div>
          <div className="max-h-[55vh] overflow-auto rounded-md border border-border/60">
            <table className="w-full min-w-[720px] border-collapse text-xs">
              <thead className="sticky top-0 bg-card">
                <tr className="text-start text-muted-foreground">
                  <th className={CELL + ' text-start'}>{t('bulk.grid.line')}</th>
                  <th className={CELL + ' text-start'}>{t('bulk.grid.employeeId')}</th>
                  <th className={CELL + ' text-start'}>{t('bulk.grid.name')}</th>
                  <th className={CELL + ' text-start'}>{t('bulk.grid.email')}</th>
                  <th className={CELL + ' text-start'}>{t('bulk.grid.role')}</th>
                  <th className={CELL + ' text-start'}>{t('bulk.grid.result')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.line} data-outcome={r.outcome}>
                    <td className={CELL + ' tabular-nums text-muted-foreground'}>{r.line}</td>
                    <td className={CELL + ' tabular-nums'}>{r.employeeId}</td>
                    <td className={CELL}>{r.displayName}</td>
                    <td className={CELL}>{r.email}</td>
                    <td className={CELL}>
                      {r.roleName || r.roleInput || (
                        <span className="text-attention-800">{t('bulk.grid.noRole')}</span>
                      )}
                    </td>
                    <td className={CELL}>
                      <StatusBadge sev={OUTCOME_SEV[r.outcome]}>{t(`bulk.outcome.${r.outcome}`)}</StatusBadge>
                      {r.issues.length > 0 && (
                        <div className="mt-0.5 text-danger-800">
                          {r.issues.map((k) => t(`bulk.issue.${k}`)).join('; ')}
                        </div>
                      )}
                      {r.message !== '' && <div className="mt-0.5 text-danger-800">{r.message}</div>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Modal>
  )
}
