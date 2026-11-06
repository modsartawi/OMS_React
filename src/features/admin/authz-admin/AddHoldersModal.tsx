import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { apiErrorMessage } from '@/core/api'
import Modal from '@/core/ui/Modal'
import Button from '@/core/ui/Button'
import ChecklistPicker, { type ChecklistOption, type ChecklistPickerLabels } from '@/core/ui/ChecklistPicker'
import { chipsFor, markDisabled, rememberOptions } from '@/core/ui/checklist'
import Ltr from '@/core/ui/Ltr'
import { formatPair, fsi } from '@/core/util/bidi'
import { useDebounced } from '@/core/util/use-debounced'
import { refusedItems, runBatch, type BatchResult } from '@/core/util/batch-runner'
import type { UaEmployeeGridRow } from '@/core/models/ua-user'
import { authzAdminApi } from './api'

interface Props {
  open: boolean
  onClose: () => void
  roleName: string
  /** Employee IDs that hold the role directly: shown greyed "Already holds", never ticked. */
  holders: string[]
  /** After a batch that assigned at least one person: re-read the holders, counts and assigned roles. */
  onAssigned: () => void | Promise<void>
}

/** One person as a picker row: `employeeId · name`, a pair led by a machine value (isolated once, LTR). */
function personOption(row: UaEmployeeGridRow, inactive: string): ChecklistOption {
  const option: ChecklistOption = { value: row.employeeId, label: formatPair(row.employeeId, row.displayName), machine: true }
  if (!row.isActive) option.tag = inactive
  return option
}

/**
 * Give a role to many people at once from the role's side (spec 805, ticket 807). The picker runs in
 * server mode over `AuthzAdminWeb/Employees` (contains-match on ID or name, capped at 50): each term
 * brings a new result set, and the picks — plain employee IDs — survive it as removable chips.
 *
 * **Assign to N** writes one `Users/AssignRole` per picked person, in pick order, through the batch
 * runner: a refusal (delegation scope, protected role) never stops it. The dialog stays open with
 * "N assigned, M refused"; refused people stay ticked with the server's message, so pressing the
 * button again retries just those. A person with no user account yet is fine — the server creates it
 * on the first assign. An expired session ends the batch and is `handle401`'s.
 */
export default function AddHoldersModal({ open, onClose, roleName, holders, onAssigned }: Props) {
  const { t } = useTranslation('authz-admin')
  const [query, setQuery] = useState('')
  const [picks, setPicks] = useState<string[]>([])
  // Every person seen in a result set, so a pick off the current page keeps its name on its chip.
  const [known, setKnown] = useState<Map<string, ChecklistOption>>(() => new Map())
  const [progress, setProgress] = useState<{ completed: number; total: number } | null>(null)
  const [result, setResult] = useState<BatchResult<string> | null>(null)

  useEffect(() => {
    if (open) {
      setQuery('')
      setPicks([])
      setKnown(new Map())
      setProgress(null)
      setResult(null)
    }
  }, [open])

  const term = useDebounced(query.trim(), 300)
  const search = useQuery({
    queryKey: ['authz-admin', 'holder-search', term],
    queryFn: () => authzAdminApi.search(term),
    enabled: open && term !== '',
  })

  const options = useMemo(() => {
    if (term === '' || !search.data) return []
    const rows = search.data.rows.map((r) => personOption(r, t('addHolders.inactive')))
    return markDisabled(rows, holders, t('addHolders.alreadyHolds'))
  }, [term, search.data, holders, t])

  useEffect(() => {
    if (options.length > 0) setKnown((k) => rememberOptions(k, options))
  }, [options])

  const refusals = useMemo(() => {
    const m = new Map<string, unknown>()
    for (const o of result?.outcomes ?? []) if (o.status === 'refused') m.set(o.item, o.error)
    return m
  }, [result])

  const labels: ChecklistPickerLabels = {
    list: t('addHolders.list'),
    search: t('addHolders.search'),
    selectAllShown: t('addHolders.selectAllShown'),
    clear: t('addHolders.clear'),
    picked: (count) => t('addHolders.picked', { count, n: fsi(String(count)) }),
    empty: t('addHolders.empty'),
    noMatch: t('addHolders.noMatch'),
    loading: t('addHolders.loading'),
    failed: t('addHolders.failed'),
    capped: t('addHolders.capped', { cap: fsi(String(search.data?.rowCap ?? 50)) }),
    removeChip: (label) => t('addHolders.removeChip', { person: label }),
  }

  const running = progress !== null
  const searching = term !== '' && search.isFetching
  const nameOf = (id: string) => known.get(id)?.label ?? id

  async function assign() {
    if (picks.length === 0 || running) return
    setResult(null)
    setProgress({ completed: 0, total: picks.length })
    const outcome = await runBatch(
      picks,
      (employeeId) => authzAdminApi.assignRole(employeeId, roleName),
      (p) => setProgress({ completed: p.completed, total: p.total }),
    )
    setProgress(null)
    // An expired session is handle401's: it is already redirecting to the login.
    if (outcome.stopped) return
    setResult(outcome)
    // Assigned people leave the picks (and, after the re-read, show "Already holds"); refused ones stay ticked.
    setPicks(refusedItems(outcome))
    if (outcome.done > 0) await onAssigned()
  }

  const count = picks.length
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('addHolders.title', { role: fsi(roleName) })}
      width="38rem"
      footer={
        <>
          <Button variant="text" onClick={onClose} disabled={running}>
            {t('common.done')}
          </Button>
          <Button variant="primary" onClick={assign} disabled={count === 0 || running} data-testid="add-holders-submit">
            {running
              ? t('addHolders.assigning', { done: fsi(String(progress.completed)), total: fsi(String(progress.total)) })
              : t('addHolders.assignN', { count, n: fsi(String(count)) })}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <p className="rounded-lg border border-primary/30 bg-primary/5 p-2.5 text-xs text-muted-foreground">
          {t('addHolders.intro')}
        </p>
        {result && (
          <div
            role="status"
            className={
              'rounded-lg border p-2.5 text-xs ' +
              (result.refused > 0 ? 'border-danger-border bg-danger-050 text-danger-800' : 'border-border/60 bg-muted/40')
            }
            data-testid="add-holders-summary"
          >
            <p className="font-semibold">
              {t('addHolders.summary', {
                assigned: t('addHolders.summaryAssigned', { count: result.done, n: fsi(String(result.done)) }),
                refused: t('addHolders.summaryRefused', { count: result.refused, n: fsi(String(result.refused)) }),
              })}
            </p>
            {result.refused > 0 && (
              <ul className="mt-1 flex flex-col gap-0.5">
                {[...refusals].map(([id, err]) => (
                  <li key={id} className="flex flex-wrap gap-x-2" data-refused={id}>
                    <span className="font-semibold">
                      <Ltr>{nameOf(id)}</Ltr>
                    </span>
                    <bdi>{apiErrorMessage(err, t('toast.failed'))}</bdi>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        <ChecklistPicker
          mode="server"
          options={options}
          picks={picks}
          onPicksChange={setPicks}
          query={query}
          onQueryChange={setQuery}
          labels={labels}
          chips={chipsFor(picks, known)}
          disabled={running}
          loading={searching}
          failed={term !== '' && search.isError}
          capped={search.data?.isCapped ?? false}
          rowNote={(id) =>
            refusals.has(id) ? (
              <span className="block text-xs text-danger-800">
                <bdi>{apiErrorMessage(refusals.get(id), t('toast.failed'))}</bdi>
              </span>
            ) : null
          }
          data-testid="add-holders-picker"
        />
      </div>
    </Modal>
  )
}
