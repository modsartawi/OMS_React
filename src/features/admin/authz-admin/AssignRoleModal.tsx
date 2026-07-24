import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import Modal from '@/core/ui/Modal'
import Button from '@/core/ui/Button'
import { notify } from '@/core/services/notify'
import type { AuthzAccessResult, RoleCatalogEntry } from '@/core/models/authz-admin'
import { authzAdminApi } from './api'
import { inScope, isFullScope, roleKind } from './helpers'

interface Props {
  open: boolean
  onClose: () => void
  employeeId: string
  /** Roles the person already holds (excluded from the picker). */
  assigned: string[]
  access: AuthzAccessResult
  catalog: RoleCatalogEntry[]
  /** Called after a successful assign so the caller re-reads roles/audit. */
  onAssigned: () => void
}

/**
 * Assign-role picker — the assignable list from the Access probe (delegation-tiered),
 * minus roles the person already holds. A delegated admin sees only the roles they may
 * assign; a full admin (`["*"]`) sees the whole catalog. The server re-checks the
 * assign entitlement regardless of what the picker showed.
 */
export default function AssignRoleModal({
  open,
  onClose,
  employeeId,
  assigned,
  access,
  catalog,
  onAssigned,
}: Props) {
  const { t } = useTranslation('authz-admin')
  const [busy, setBusy] = useState<string | null>(null)

  const assignable = access.assignableRoles
  const held = useMemo(() => new Set(assigned), [assigned])

  // Full scope → the whole catalog; a delegated list → only those catalog rows.
  // Already-held roles are dropped either way.
  const choices = useMemo(() => {
    const rows = isFullScope(assignable)
      ? catalog
      : catalog.filter((r) => inScope(r.roleName, assignable))
    return rows.filter((r) => !held.has(r.roleName))
  }, [catalog, assignable, held])

  async function assign(roleName: string) {
    setBusy(roleName)
    try {
      await authzAdminApi.assignRole(employeeId, roleName)
      notify.success(t('assign.done'), t('assign.doneDetail', { role: roleName }))
      onAssigned()
      onClose()
    } catch (err) {
      notify.apiError(t('toast.failed'), err)
    } finally {
      setBusy(null)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('assign.title')}
      width="30rem"
      footer={
        <Button variant="text" onClick={onClose}>
          {t('common.cancel')}
        </Button>
      }
    >
      <p className="mb-3 text-sm text-muted-foreground">{t('assign.body')}</p>
      {choices.length === 0 ? (
        <p className="rounded-lg border border-border/60 bg-muted/40 p-4 text-sm text-muted-foreground">
          {t('assign.empty')}
        </p>
      ) : (
        <div className="flex max-h-[16rem] flex-col gap-1.5 overflow-y-auto">
          {choices.map((r) => (
            <div
              key={r.roleName}
              className="flex items-center gap-2 rounded-lg border border-border/60 px-3 py-2 hover:bg-accent"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 text-sm font-semibold">
                  <span className="truncate">{r.roleName}</span>
                  <KindTag kind={roleKind(r)} />
                </div>
                {r.description ? (
                  <div className="truncate text-xs text-muted-foreground">{r.description}</div>
                ) : null}
              </div>
              <Button variant="primary" onClick={() => assign(r.roleName)} disabled={busy !== null}>
                {busy === r.roleName ? t('assign.assigning') : t('assign.assign')}
              </Button>
            </div>
          ))}
        </div>
      )}
    </Modal>
  )
}

function KindTag({ kind }: { kind: 'single' | 'composite' | 'system' }) {
  const { t } = useTranslation('authz-admin')
  if (kind === 'single') return null
  const cls =
    kind === 'system'
      ? 'bg-attention-050 text-attention-800'
      : 'bg-primary/10 text-primary'
  return (
    <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${cls}`}>
      {t(`kind.${kind}`)}
    </span>
  )
}
