import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { apiErrorMessage } from '@/core/api'
import Modal from '@/core/ui/Modal'
import Button from '@/core/ui/Button'
import ChecklistPicker, { type ChecklistOption, type ChecklistPickerLabels } from '@/core/ui/ChecklistPicker'
import Ltr from '@/core/ui/Ltr'
import { fsi } from '@/core/util/bidi'
import { refusedItems, runBatch, type BatchResult } from '@/core/util/batch-runner'
import type { RoleCatalogEntry } from '@/core/models/authz-admin'
import { authzAdminApi } from './api'

interface Props {
  open: boolean
  onClose: () => void
  compositeName: string
  /** Single roles already members of this composite (excluded from the picker). */
  members: string[]
  catalog: RoleCatalogEntry[]
  /** After a batch that added at least one member: re-read the role, counts and assigned roles. */
  onAdded: () => void | Promise<void>
}

/**
 * Add single roles as members of a composite, many at once (spec 805, ticket 806). Only SINGLE roles
 * can be members — composites can't nest (the engine forbids it and the picker only offers singles),
 * so role resolution stays one level deep.
 *
 * **Add N** writes one `Roles/AddMember` per picked role, in pick order, through the batch runner: a
 * refusal never stops it. The dialog then stays open with "N added, M refused"; refused roles stay
 * ticked with the server's message, so pressing the button again retries just those. An expired
 * session ends the batch and is `handle401`'s.
 */
export default function AddMemberModal({ open, onClose, compositeName, members, catalog, onAdded }: Props) {
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

  const singles = useMemo<ChecklistOption[]>(
    () =>
      catalog
        .filter((r) => !r.isComposite)
        .map((r) => ({ value: r.roleName, label: r.roleName, description: r.description || undefined, machine: true })),
    [catalog],
  )

  const refusals = useMemo(() => {
    const m = new Map<string, unknown>()
    for (const o of result?.outcomes ?? []) if (o.status === 'refused') m.set(o.item, o.error)
    return m
  }, [result])

  const labels: ChecklistPickerLabels = {
    list: t('addMember.list'),
    search: t('addMember.search'),
    selectAllShown: t('addMember.selectAllShown'),
    clear: t('addMember.clear'),
    picked: (count) => t('addMember.picked', { count, n: fsi(String(count)) }),
    empty: t('addMember.empty'),
    noMatch: t('addMember.noMatch'),
  }

  const running = progress !== null

  async function add() {
    if (picks.length === 0 || running) return
    setResult(null)
    setProgress({ completed: 0, total: picks.length })
    const outcome = await runBatch(
      picks,
      (role) => authzAdminApi.addCompositeMember(compositeName, role),
      (p) => setProgress({ completed: p.completed, total: p.total }),
    )
    setProgress(null)
    // An expired session is handle401's: it is already redirecting to the login.
    if (outcome.stopped) return
    setResult(outcome)
    // Added roles leave the picks (and, after the re-read, the list); refused ones stay ticked.
    setPicks(refusedItems(outcome))
    if (outcome.done > 0) await onAdded()
  }

  const count = picks.length
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('addMember.title', { role: fsi(compositeName) })}
      width="36rem"
      footer={
        <>
          <Button variant="text" onClick={onClose} disabled={running}>
            {t('common.done')}
          </Button>
          <Button variant="primary" onClick={add} disabled={count === 0 || running} data-testid="add-member-submit">
            {running
              ? t('addMember.adding', { done: fsi(String(progress.completed)), total: fsi(String(progress.total)) })
              : t('addMember.addN', { count, n: fsi(String(count)) })}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <p className="rounded-lg border border-primary/30 bg-primary/5 p-2.5 text-xs text-muted-foreground">
          {t('addMember.intro')}
        </p>
        {result && (
          <div
            role="status"
            className={
              'rounded-lg border p-2.5 text-xs ' +
              (result.refused > 0 ? 'border-danger-border bg-danger-050 text-danger-800' : 'border-border/60 bg-muted/40')
            }
            data-testid="add-member-summary"
          >
            <p className="font-semibold">
              {t('addMember.summary', {
                added: t('addMember.summaryAdded', { count: result.done, n: fsi(String(result.done)) }),
                refused: t('addMember.summaryRefused', { count: result.refused, n: fsi(String(result.refused)) }),
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
          options={singles}
          exclude={members}
          picks={picks}
          onPicksChange={setPicks}
          query={query}
          onQueryChange={setQuery}
          labels={labels}
          disabled={running}
          data-testid="add-member-picker"
        />
      </div>
    </Modal>
  )
}
