import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import Modal from '@/core/ui/Modal'
import Button from '@/core/ui/Button'
import { notify } from '@/core/services/notify'
import type { RoleCatalogEntry } from '@/core/models/authz-admin'
import { authzAdminApi } from './api'

interface Props {
  open: boolean
  onClose: () => void
  compositeName: string
  /** Single roles already members of this composite (excluded from the picker). */
  members: string[]
  catalog: RoleCatalogEntry[]
  onAdded: () => void
}

/**
 * Add a single role as a member of a composite. Only SINGLE roles can be members —
 * composites can't nest (the engine forbids it and the picker only offers singles), so
 * role resolution stays one level deep.
 */
export default function AddMemberModal({ open, onClose, compositeName, members, catalog, onAdded }: Props) {
  const { t } = useTranslation('authz-admin')
  const [busy, setBusy] = useState<string | null>(null)

  useEffect(() => {
    if (open) setBusy(null)
  }, [open])

  const held = useMemo(() => new Set(members), [members])
  // Only single roles, excluding the ones already members.
  const choices = useMemo(
    () => catalog.filter((r) => !r.isComposite && !held.has(r.roleName)),
    [catalog, held],
  )

  async function add(singleRoleName: string) {
    setBusy(singleRoleName)
    try {
      await authzAdminApi.addCompositeMember(compositeName, singleRoleName)
      notify.success(t('addMember.added'), t('addMember.addedDetail', { member: singleRoleName }))
      onAdded()
    } catch (err) {
      // NESTING / unknown-member surface verbatim (belt-and-braces; the picker only offers singles).
      notify.apiError(t('toast.failed'), err)
    } finally {
      setBusy(null)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('addMember.title', { role: compositeName })}
      width="32rem"
      footer={
        <Button variant="text" onClick={onClose}>
          {t('common.done')}
        </Button>
      }
    >
      <div className="flex flex-col gap-3">
        <p className="rounded-lg border border-primary/30 bg-primary/5 p-2.5 text-xs text-muted-foreground">
          {t('addMember.intro')}
        </p>
        {choices.length === 0 ? (
          <p className="rounded-lg border border-border/60 bg-muted/40 p-4 text-sm text-muted-foreground">
            {t('addMember.empty')}
          </p>
        ) : (
          <div className="flex max-h-[18rem] flex-col gap-1.5 overflow-y-auto">
            {choices.map((r) => (
              <div key={r.roleName} className="flex items-center gap-2 rounded-lg border border-border/60 px-3 py-2">
                <span aria-hidden className="text-primary">
                  ◆
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{r.roleName}</span>
                  {r.description ? (
                    <span className="block truncate text-xs text-muted-foreground">{r.description}</span>
                  ) : null}
                </span>
                <Button variant="primary" onClick={() => add(r.roleName)} disabled={busy !== null}>
                  {busy === r.roleName ? t('addMember.adding') : t('addMember.add')}
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  )
}
