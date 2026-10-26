import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Lock } from 'lucide-react'
import { apiErrorMessage } from '@/core/api'
import Modal from '@/core/ui/Modal'
import Button from '@/core/ui/Button'
import Field from '@/core/ui/Field'
import Input from '@/core/ui/Input'
import ErrorBanner from '@/core/ui/ErrorBanner'
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
 *
 * A refused save renders inside the dialog, which stays open (spec 380 F18).
 */
export default function EditRoleModal({ open, onClose, roleName, isProtected, description, onSaved }: Props) {
  const { t } = useTranslation('authz-admin')
  const [value, setValue] = useState(description)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)

  useEffect(() => {
    if (open) {
      setValue(description)
      setBusy(false)
      setError(null)
    }
  }, [open, description])

  async function save() {
    setBusy(true)
    setError(null)
    try {
      await authzAdminApi.editRoleDescription(roleName, value.trim())
      notify.success(t('editRole.saved'))
      onSaved()
    } catch (err) {
      setError(err)
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
        <Field
          label={t('newRole.name')}
          hint={
            <span className="flex items-start gap-1.5">
              <Lock className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
              {t('editRole.nameLock')}
            </span>
          }
        >
          <Input value={roleName} disabled />
        </Field>

        <Field label={t('newRole.description')}>
          <Input value={value} onChange={(e) => setValue(e.target.value)} autoFocus />
        </Field>

        {isProtected && (
          <p className="rounded-lg border border-attention-border bg-attention-050 p-2.5 text-xs text-attention-800">
            {t('editRole.protectedNote')}
          </p>
        )}

        {error !== null && (
          <ErrorBanner
            title={t('toast.failed')}
            message={apiErrorMessage(error, t('toast.failed'))}
            className="p-2.5"
          />
        )}
      </div>
    </Modal>
  )
}
