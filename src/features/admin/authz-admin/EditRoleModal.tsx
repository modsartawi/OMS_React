import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Lock } from 'lucide-react'
import Modal from '@/core/ui/Modal'
import Button from '@/core/ui/Button'
import { notify } from '@/core/services/notify'
import { authzAdminApi } from './api'

interface Props {
  open: boolean
  onClose: () => void
  roleName: string
  /** Protected roles keep their name locked but their DESCRIPTION editable (story 28). */
  isProtected: boolean
  description: string
  onSaved: () => void
}

/**
 * Edit a role's description — the only mutable field. The name is shown as a locked,
 * disabled input (names are immutable; renaming is create-new → migrate → delete-old).
 * A protected system role can still have its description edited — protection blocks
 * delete and grant-unbind, never the description or assign/revoke.
 */
export default function EditRoleModal({ open, onClose, roleName, isProtected, description, onSaved }: Props) {
  const { t } = useTranslation('authz-admin')
  const [value, setValue] = useState(description)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (open) {
      setValue(description)
      setBusy(false)
    }
  }, [open, description])

  async function save() {
    setBusy(true)
    try {
      await authzAdminApi.editRoleDescription(roleName, value.trim())
      notify.success(t('editRole.saved'))
      onSaved()
    } catch (err) {
      notify.apiError(t('toast.failed'), err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('editRole.title', { role: roleName })}
      width="30rem"
      footer={
        <>
          <Button variant="text" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button variant="primary" onClick={save} disabled={busy}>
            {busy ? t('editRole.saving') : t('editRole.save')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs font-semibold text-muted-foreground">{t('newRole.name')}</span>
          <input
            className="rounded-lg border border-input bg-muted/50 px-3 py-2 text-sm text-muted-foreground outline-none"
            value={roleName}
            disabled
          />
          <span className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
            <Lock className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
            {t('editRole.nameLock')}
          </span>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs font-semibold text-muted-foreground">{t('newRole.description')}</span>
          <input
            className="rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            autoFocus
          />
        </label>

        {isProtected && (
          <p className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-2.5 text-xs text-amber-800 dark:text-amber-200">
            {t('editRole.protectedNote')}
          </p>
        )}
      </div>
    </Modal>
  )
}
