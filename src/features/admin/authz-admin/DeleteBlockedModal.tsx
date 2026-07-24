import { useTranslation } from 'react-i18next'
import { ShieldAlert } from 'lucide-react'
import Modal from '@/core/ui/Modal'
import Button from '@/core/ui/Button'

interface Counts {
  users: number
  grants: number
  composites: number
}

interface Props {
  open: boolean
  onClose: () => void
  roleName: string
  counts: Counts | null
  /** Deep-links to the offending lists — each jumps to the tab that lets the admin clear it. */
  onGoUsers: () => void
  onGoGrants: () => void
  onGoComposites: () => void
}

/**
 * The delete-blocked-with-counts guardrail (spec / story 25-26). A delete can never
 * silently strip access, so it is hard-blocked until the role is empty: the modal shows
 * the three in-use counts (users hold it / grants bound / composites include it) and
 * deep-links to each offending list. Mirrors the server's 409 IN_USE; the admin must
 * unassign/unbind everything first, each act audited.
 */
export default function DeleteBlockedModal({
  open,
  onClose,
  roleName,
  counts,
  onGoUsers,
  onGoGrants,
  onGoComposites,
}: Props) {
  const { t } = useTranslation('authz-admin')
  const c = counts ?? { users: 0, grants: 0, composites: 0 }

  const tiles: { key: string; n: number; label: string; go: () => void }[] = [
    { key: 'users', n: c.users, label: t('deleteBlocked.users', { count: c.users }), go: onGoUsers },
    { key: 'grants', n: c.grants, label: t('deleteBlocked.grants', { count: c.grants }), go: onGoGrants },
    { key: 'composites', n: c.composites, label: t('deleteBlocked.composites', { count: c.composites }), go: onGoComposites },
  ]

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('deleteBlocked.title')}
      width="30rem"
      footer={
        <Button variant="primary" onClick={onClose}>
          {t('common.ok')}
        </Button>
      }
    >
      <div className="flex flex-col gap-3">
        <div className="flex items-start gap-2 text-sm">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-danger" aria-hidden />
          <span>{t('deleteBlocked.body', { role: roleName })}</span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {tiles.map((tile) => (
            <button
              key={tile.key}
              onClick={tile.go}
              disabled={tile.n === 0}
              className={
                'flex flex-col items-start rounded-lg border p-2.5 text-left transition-colors ' +
                (tile.n > 0
                  ? 'border-border hover:border-primary hover:bg-accent'
                  : 'border-border/40 opacity-50')
              }
            >
              <span className="text-xl font-bold tabular-nums">{tile.n}</span>
              <span className="text-[11px] text-muted-foreground">{tile.label}</span>
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">{t('deleteBlocked.hint')}</p>
      </div>
    </Modal>
  )
}
