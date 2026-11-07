import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import Modal from '@/core/ui/Modal'
import Button from '@/core/ui/Button'
import ChecklistPicker, { type ChecklistOption, type ChecklistPickerLabels } from '@/core/ui/ChecklistPicker'
import BatchSummary from '@/core/ui/BatchSummary'
import { useBatchRun } from '@/core/ui/use-batch-run'
import { fsi } from '@/core/util/bidi'
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
  // Assigned roles leave the picks (and, after the re-read, the list); refused ones stay ticked.
  const batch = useBatchRun<string>({
    open,
    write: (role) => authzAdminApi.assignRole(employeeId, role),
    onPicks: setPicks,
    onDone: onAssigned,
  })

  useEffect(() => {
    if (open) {
      setQuery('')
      setPicks([])
    }
  }, [open])

  const assignable = access.assignableRoles

  // Full scope → the whole catalog; a delegated list → only those catalog rows. Held roles are
  // dropped by the picker's `exclude`, so a role assigned in this batch leaves the list on re-read.
  // A role's kind is its tag: a protected system role in the attention colour, a composite in primary.
  const choices = useMemo<ChecklistOption[]>(() => {
    const rows = isFullScope(assignable) ? catalog : catalog.filter((r) => inScope(r.roleName, assignable))
    return rows.map((r) => {
      const kind = roleKind(r)
      const option: ChecklistOption = {
        value: r.roleName,
        label: r.roleName,
        description: r.description || undefined,
        machine: true,
      }
      if (kind !== 'single') {
        option.tag = t(`kind.${kind}`)
        option.tagTone = kind === 'system' ? 'attention' : 'primary'
      }
      return option
    })
  }, [catalog, assignable, t])

  const labels: ChecklistPickerLabels = {
    list: t('assign.list'),
    search: t('assign.search'),
    selectAllShown: t('assign.selectAllShown'),
    clear: t('assign.clear'),
    picked: (count) => t('assign.picked', { count, n: fsi(String(count)) }),
    empty: t('assign.empty'),
    noMatch: t('assign.noMatch'),
  }

  const { progress, running, result } = batch
  const count = picks.length
  return (
    <Modal
      open={open}
      onClose={onClose}
      dismissable={!running}
      title={t('assign.title')}
      width="36rem"
      footer={
        <>
          <Button variant="text" onClick={onClose} disabled={running}>
            {t('common.done')}
          </Button>
          <Button
            variant="primary"
            onClick={() => void batch.run(picks)}
            disabled={count === 0 || running}
            data-testid="assign-role-submit"
          >
            {progress
              ? t('assign.assigning', { done: fsi(String(progress.completed)), total: fsi(String(progress.total)) })
              : t('assign.assignN', { count, n: fsi(String(count)) })}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">{t('assign.body')}</p>
        {result && (
          <BatchSummary
            result={result}
            summary={(done, refused) =>
              t('assign.summary', {
                assigned: t('assign.summaryAssigned', { count: done, n: fsi(String(done)) }),
                refused: t('assign.summaryRefused', { count: refused, n: fsi(String(refused)) }),
              })
            }
            refusal={{ fallback: t('toast.failed'), denied: t('common.denied') }}
            data-testid="assign-role-summary"
          />
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
