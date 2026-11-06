import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { apiErrorMessage } from '@/core/api'
import Modal from '@/core/ui/Modal'
import Button from '@/core/ui/Button'
import ChecklistPicker, { type ChecklistOption, type ChecklistPickerLabels } from '@/core/ui/ChecklistPicker'
import Ltr from '@/core/ui/Ltr'
import { fsi } from '@/core/util/bidi'
import { refusedItems, runBatch, type BatchResult } from '@/core/util/batch-runner'
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
  /** After a batch that assigned at least one role: re-read the person's roles, effective grants and audit. */
  onAssigned: () => void | Promise<void>
}

/**
 * Assign roles to one person, many at once (spec 805, ticket 809). The picker offers the assignable
 * list from the Access probe (delegation-tiered) minus roles the person already holds: a delegated
 * admin sees only the roles they may assign; a full admin (`["*"]`) sees the whole catalog. The
 * server re-checks the assign entitlement regardless of what the picker showed.
 *
 * **Assign N** writes one `Users/AssignRole` per picked role, in pick order, through the batch runner:
 * a refusal never stops it. The dialog then stays open with "N assigned, M refused"; refused roles
 * stay ticked with the server's message, so pressing the button again retries just those. An expired
 * session ends the batch and is `handle401`'s.
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
  const [query, setQuery] = useState('')
  const [picks, setPicks] = useState<string[]>([])
  const [progress, setProgress] = useState<{ completed: number; total: number } | null>(null)
  const [result, setResult] = useState<BatchResult<string> | null>(null)

  useEffect(() => {
    if (open) {
      setQuery('')
      setPicks([])
      setProgress(null)
      setResult(null)
    }
  }, [open])

  const assignable = access.assignableRoles

  // Full scope → the whole catalog; a delegated list → only those catalog rows. Held roles are
  // dropped by the picker's `exclude`, so a role assigned in this batch leaves the list on re-read.
  const choices = useMemo<ChecklistOption[]>(() => {
    const rows = isFullScope(assignable) ? catalog : catalog.filter((r) => inScope(r.roleName, assignable))
    return rows.map((r) => {
      const kind = roleKind(r)
      return {
        value: r.roleName,
        label: r.roleName,
        description: r.description || undefined,
        machine: true,
        tag: kind === 'single' ? undefined : t(`kind.${kind}`),
      }
    })
  }, [catalog, assignable, t])

  const refusals = useMemo(() => {
    const m = new Map<string, unknown>()
    for (const o of result?.outcomes ?? []) if (o.status === 'refused') m.set(o.item, o.error)
    return m
  }, [result])

  const labels: ChecklistPickerLabels = {
    list: t('assign.list'),
    search: t('assign.search'),
    selectAllShown: t('assign.selectAllShown'),
    clear: t('assign.clear'),
    picked: (count) => t('assign.picked', { count, n: fsi(String(count)) }),
    empty: t('assign.empty'),
    noMatch: t('assign.noMatch'),
  }

  const running = progress !== null

  async function assign() {
    if (picks.length === 0 || running) return
    setResult(null)
    setProgress({ completed: 0, total: picks.length })
    const outcome = await runBatch(
      picks,
      (role) => authzAdminApi.assignRole(employeeId, role),
      (p) => setProgress({ completed: p.completed, total: p.total }),
    )
    setProgress(null)
    // An expired session is handle401's: it is already redirecting to the login.
    if (outcome.stopped) return
    setResult(outcome)
    // Assigned roles leave the picks (and, after the re-read, the list); refused ones stay ticked.
    setPicks(refusedItems(outcome))
    if (outcome.done > 0) await onAssigned()
  }

  const count = picks.length
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('assign.title')}
      width="36rem"
      footer={
        <>
          <Button variant="text" onClick={onClose} disabled={running}>
            {t('common.done')}
          </Button>
          <Button variant="primary" onClick={assign} disabled={count === 0 || running} data-testid="assign-role-submit">
            {running
              ? t('assign.assigning', { done: fsi(String(progress.completed)), total: fsi(String(progress.total)) })
              : t('assign.assignN', { count, n: fsi(String(count)) })}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">{t('assign.body')}</p>
        {result && (
          <div
            role="status"
            className={
              'rounded-lg border p-2.5 text-xs ' +
              (result.refused > 0 ? 'border-danger-border bg-danger-050 text-danger-800' : 'border-border/60 bg-muted/40')
            }
            data-testid="assign-role-summary"
          >
            <p className="font-semibold">
              {t('assign.summary', {
                assigned: t('assign.summaryAssigned', { count: result.done, n: fsi(String(result.done)) }),
                refused: t('assign.summaryRefused', { count: result.refused, n: fsi(String(result.refused)) }),
              })}
            </p>
            {result.refused > 0 && (
              <ul className="mt-1 flex flex-col gap-0.5">
                {[...refusals].map(([role, err]) => (
                  <li key={role} className="flex flex-wrap gap-x-2" data-refused={role}>
                    <span className="font-semibold">
                      <Ltr>{role}</Ltr>
                    </span>
                    <bdi>{apiErrorMessage(err, t('toast.failed'))}</bdi>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        <ChecklistPicker
          options={choices}
          exclude={assigned}
          picks={picks}
          onPicksChange={setPicks}
          query={query}
          onQueryChange={setQuery}
          labels={labels}
          disabled={running}
          data-testid="assign-role-picker"
        />
      </div>
    </Modal>
  )
}
