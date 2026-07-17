import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import Button from '@/core/ui/Button'
import { confirmAction } from '@/core/services/confirm'
import { notify } from '@/core/services/notify'
import { uaAdminApi } from './api'
import { credentialKey, deriveStatus, formatStamp } from './helpers'
import StatusPill from './StatusPill'
import SetPasswordModal from './SetPasswordModal'

const FIELD =
  'h-8 flex-1 rounded-lg border border-input bg-background px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring'

type Tab = 'sessions' | 'audit'

interface Props {
  employeeId: string
  /** Refresh the counts + the current grid list after a grid-visible change. */
  onChanged: () => void
}

export default function UserDetailPane({ employeeId, onChanged }: Props) {
  const { t } = useTranslation('ua-admin')
  const qc = useQueryClient()
  const [tab, setTab] = useState<Tab>('sessions')
  const [phone, setPhone] = useState('')
  const [pwdOpen, setPwdOpen] = useState(false)
  const [acting, setActing] = useState(false)

  const statusQuery = useQuery({
    queryKey: ['ua-admin', 'status', employeeId],
    queryFn: () => uaAdminApi.status(employeeId),
  })
  const status = statusQuery.data

  // Keep the phone field in sync with the loaded record (new selection or refetch).
  useEffect(() => {
    setPhone(status?.phone ?? '')
  }, [status?.phone, employeeId])

  // Loaded on selection (not gated on the tab) so the live-session COUNT can sit
  // beside TOTP in the detail — "one look answers why can't they log in" (story 9).
  const sessions = useQuery({
    queryKey: ['ua-admin', 'sessions', employeeId],
    queryFn: () => uaAdminApi.sessions(employeeId),
    enabled: !!status?.found,
  })
  const audit = useQuery({
    queryKey: ['ua-admin', 'audit', employeeId],
    queryFn: () => uaAdminApi.audit(employeeId),
    enabled: !!status?.found && tab === 'audit',
  })

  const name = status?.displayName || employeeId

  async function refresh() {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ['ua-admin', 'status', employeeId] }),
      qc.invalidateQueries({ queryKey: ['ua-admin', 'sessions', employeeId] }),
      qc.invalidateQueries({ queryKey: ['ua-admin', 'audit', employeeId] }),
    ])
    onChanged()
  }

  async function run(action: () => Promise<unknown>, toastTitle: string, toastDetail?: string) {
    setActing(true)
    try {
      await action()
      notify.success(toastTitle, toastDetail)
      await refresh()
    } catch (err) {
      notify.apiError(t('toast.failed'), err)
    } finally {
      setActing(false)
    }
  }

  async function savePhone() {
    if (!status) return
    await run(
      () =>
        uaAdminApi.upsert({
          employeeId,
          displayName: status.displayName,
          phone: phone.trim(),
          isActive: status.isActive, // never flips active — the server ignores a stale true anyway
        }),
      t('toast.saved'),
      t('toast.savedDetail', { name }),
    )
  }

  async function toggleActive() {
    if (!status) return
    const active = status.isActive
    const ok = await confirmAction(
      active ? t('confirm.disableBody', { name }) : t('confirm.reenableBody', { name }),
      active ? t('confirm.disableTitle') : t('confirm.reenableTitle'),
    )
    if (!ok) return
    await run(
      () => (active ? uaAdminApi.deactivate(employeeId) : uaAdminApi.reactivate(employeeId)),
      active ? t('toast.disabled') : t('toast.reenabled'),
    )
  }

  async function clearTotp() {
    const ok = await confirmAction(t('confirm.clearTotpBody', { name }), t('confirm.clearTotpTitle'))
    if (!ok) return
    await run(() => uaAdminApi.clearTotp(employeeId), t('toast.totpCleared'))
  }

  async function revoke(sessionId: string) {
    const ok = await confirmAction(t('confirm.revokeBody'), t('confirm.revokeTitle'))
    if (!ok) return
    await run(() => uaAdminApi.revokeSession(sessionId), t('toast.sessionRevoked'))
  }

  if (statusQuery.isPending) {
    return (
      <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground" role="status">
        <Loader2 className="h-4 w-4 animate-spin" />
        {t('detail.loading')}
      </div>
    )
  }
  if (!status || !status.found) {
    return <div className="p-6 text-sm text-muted-foreground">{t('detail.notFound')}</div>
  }

  // A loaded status implies a Ua identity row exists, so isSeeded is true here
  // (not-seeded people have no row and answer found=false above).
  const derived = deriveStatus({ ...status, isSeeded: true })
  const disabledText = status.disabledAt
    ? t('detail.disabledBy', { at: formatStamp(status.disabledAt), by: status.disabledBy || t('detail.none') })
    : t('detail.none')

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <div className="text-base font-semibold tracking-tight text-balance">
          {name} <span className="font-normal text-muted-foreground">({employeeId})</span>
        </div>
        <StatusPill status={derived} />
      </div>

      <dl className="grid grid-cols-[110px_1fr] gap-x-3 gap-y-1.5 text-sm">
        <dt className="text-muted-foreground">{t('detail.mobile')}</dt>
        <dd className="flex gap-2">
          <input className={FIELD} value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" />
          <Button variant="secondary" onClick={savePhone} disabled={acting || phone.trim() === status.phone.trim()}>
            {t('detail.save')}
          </Button>
        </dd>

        <dt className="text-muted-foreground">{t('detail.credential')}</dt>
        <dd>{t(`credential.${credentialKey(status.credentialState)}`)}</dd>

        <dt className="text-muted-foreground">{t('detail.totp')}</dt>
        <dd>{status.isTotpEnrolled ? t('detail.totpEnrolled', { id: employeeId }) : t('detail.totpNotEnrolled')}</dd>

        <dt className="text-muted-foreground">{t('detail.liveSessions')}</dt>
        <dd className="tabular-nums">{sessions.data?.length ?? t('detail.none')}</dd>

        <dt className="text-muted-foreground">{t('detail.createdUpdated')}</dt>
        <dd className="tabular-nums">
          {formatStamp(status.createdAt)} / {formatStamp(status.updatedAt)}
        </dd>

        <dt className="text-muted-foreground">{t('detail.disabled')}</dt>
        <dd className="tabular-nums">{disabledText}</dd>

        <dt className="text-muted-foreground">{t('detail.lastLogin')}</dt>
        <dd className="tabular-nums">{formatStamp(status.lastLoginAt) ?? t('grid.never')}</dd>
      </dl>

      <div className="flex flex-wrap gap-2">
        <Button variant={status.isActive ? 'danger' : 'secondary'} onClick={toggleActive} disabled={acting}>
          {status.isActive ? t('actions.disable') : t('actions.reenable')}
        </Button>
        <Button variant="secondary" onClick={() => setPwdOpen(true)} disabled={acting}>
          {t('actions.setPassword')}
        </Button>
        <Button variant="danger" onClick={clearTotp} disabled={acting}>
          {t('actions.clearTotp')}
        </Button>
      </div>

      <div className="flex gap-1 border-b border-border" role="tablist" aria-label={t('tabs.ariaLabel')}>
        {(['sessions', 'audit'] as Tab[]).map((id) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={
              'border-b-2 px-3 py-1.5 text-sm ' +
              (tab === id
                ? 'border-primary font-semibold text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground')
            }
          >
            {t(`tabs.${id}`)}
          </button>
        ))}
      </div>

      {tab === 'sessions' && (
        <div className="flex flex-col gap-1.5 text-sm">
          {sessions.isPending ? (
            <span className="text-muted-foreground">{t('sessions.loading')}</span>
          ) : !sessions.data || sessions.data.length === 0 ? (
            <span className="text-muted-foreground">{t('sessions.none')}</span>
          ) : (
            sessions.data.map((s) => (
              <div
                key={s.sessionId}
                className="flex items-center justify-between gap-2 rounded-lg border border-border/60 bg-muted/40 px-2.5 py-1.5"
              >
                <span className="min-w-0 truncate">
                  <b>{t(`channel.${s.channel}`, { defaultValue: s.channel })}</b> · {t('sessions.started')}{' '}
                  <span className="tabular-nums">{formatStamp(s.createdTime)}</span> · {t('sessions.lastSeen')}{' '}
                  <span className="tabular-nums">{formatStamp(s.lastSeenTime)}</span>{' '}
                  <span className="tabular-nums text-muted-foreground">{s.ipAddress}</span>
                </span>
                <button
                  className="shrink-0 rounded-full text-xs font-medium text-red-700 hover:underline dark:text-red-400"
                  onClick={() => revoke(s.sessionId)}
                  disabled={acting}
                >
                  {t('sessions.revoke')}
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'audit' && (
        <div className="flex flex-col gap-1.5 text-sm">
          {audit.isPending ? (
            <span className="text-muted-foreground">{t('audit.loading')}</span>
          ) : !audit.data || audit.data.entries.length === 0 ? (
            <span className="text-muted-foreground">{t('audit.none')}</span>
          ) : (
            <>
              {audit.data.entries.map((a) => (
                <div key={a.actionId} className="rounded-lg border border-border/60 bg-muted/40 px-2.5 py-1.5">
                  <span className="tabular-nums text-muted-foreground">{formatStamp(a.actionTime)}</span> ·{' '}
                  <b>{t(`audit.actions.${a.action}`, { defaultValue: a.action })}</b>
                  {a.actor ? (
                    <>
                      {' '}
                      {t('audit.by')} <span className="tabular-nums">{a.actor}</span>
                    </>
                  ) : null}
                  {a.action === 'ADMIN_SESSION_REVOKE' && a.targetId ? (
                    <span className="text-muted-foreground"> — {t('audit.session', { id: a.targetId })}</span>
                  ) : null}
                </div>
              ))}
              <span className="text-xs text-muted-foreground">{t('audit.legend')}</span>
            </>
          )}
        </div>
      )}

      <p className="text-xs text-muted-foreground">{t('detail.supportNote')}</p>

      <SetPasswordModal employeeId={employeeId} open={pwdOpen} onClose={() => setPwdOpen(false)} onDone={refresh} />
    </div>
  )
}
