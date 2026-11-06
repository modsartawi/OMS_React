import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import Modal from '@/core/ui/Modal'
import Button from '@/core/ui/Button'
import ChecklistPicker, { type ChecklistOption, type ChecklistPickerLabels } from '@/core/ui/ChecklistPicker'
import BatchSummary from '@/core/ui/BatchSummary'
import { useBatchRun } from '@/core/ui/use-batch-run'
import { fsi } from '@/core/util/bidi'
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
  // Added roles leave the picks (and, after the re-read, the list); refused ones stay ticked.
  const batch = useBatchRun<string>({
    open,
    write: (role) => authzAdminApi.addCompositeMember(compositeName, role),
    onPicks: setPicks,
    onDone: onAdded,
  })

  useEffect(() => {
    if (open) {
      setQuery('')
      setPicks([])
    }
  }, [open])

  const singles = useMemo<ChecklistOption[]>(
    () =>
      catalog
        .filter((r) => !r.isComposite)
        .map((r) => ({ value: r.roleName, label: r.roleName, description: r.description || undefined, machine: true })),
    [catalog],
  )

  const labels: ChecklistPickerLabels = {
    list: t('addMember.list'),
    search: t('addMember.search'),
    selectAllShown: t('addMember.selectAllShown'),
    clear: t('addMember.clear'),
    picked: (count) => t('addMember.picked', { count, n: fsi(String(count)) }),
    empty: t('addMember.empty'),
    noMatch: t('addMember.noMatch'),
  }

  const { progress, running, result } = batch
  const count = picks.length
  return (
    <Modal
      open={open}
      onClose={onClose}
      dismissable={!running}
      title={t('addMember.title', { role: fsi(compositeName) })}
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
            data-testid="add-member-submit"
          >
            {progress
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
          <BatchSummary
            result={result}
            summary={(done, refused) =>
              t('addMember.summary', {
                added: t('addMember.summaryAdded', { count: done, n: fsi(String(done)) }),
                refused: t('addMember.summaryRefused', { count: refused, n: fsi(String(refused)) }),
              })
            }
            refusal={{ fallback: t('toast.failed'), denied: t('common.denied') }}
            data-testid="add-member-summary"
          />
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
