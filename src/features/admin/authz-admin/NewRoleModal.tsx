import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Lock } from 'lucide-react'
import Modal from '@/core/ui/Modal'
import Button from '@/core/ui/Button'
import { notify } from '@/core/services/notify'
import type { RoleCatalogEntry } from '@/core/models/authz-admin'
import { authzAdminApi } from './api'

type Kind = 'single' | 'composite'

interface Props {
  open: boolean
  onClose: () => void
  catalog: RoleCatalogEntry[]
  /** Called with the new role name after a successful create (selects it in the catalog). */
  onCreated: (roleName: string) => void
}

/**
 * Create a single or composite role. The name is entered UPPERCASE and is permanent —
 * the immutable-name note is shown at creation (there is no rename door; renaming is
 * create-new → migrate holders → delete-old). A composite is created empty; members are
 * added from its detail pane afterwards (matching the engine's create-then-add sequence).
 */
export default function NewRoleModal({ open, onClose, catalog, onCreated }: Props) {
  const { t } = useTranslation('authz-admin')
  const [kind, setKind] = useState<Kind>('single')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [busy, setBusy] = useState(false)

  // Reset the form each time the modal opens.
  useEffect(() => {
    if (open) {
      setKind('single')
      setName('')
      setDescription('')
      setBusy(false)
    }
  }, [open])

  const trimmed = name.trim().toUpperCase()
  const duplicate = trimmed.length > 0 && catalog.some((r) => r.roleName.toUpperCase() === trimmed)
  const tooLong = trimmed.length > 50
  const valid = trimmed.length > 0 && !duplicate && !tooLong

  async function create() {
    if (!valid) return
    setBusy(true)
    try {
      if (kind === 'single') await authzAdminApi.createSingleRole(trimmed, description.trim())
      else await authzAdminApi.createCompositeRole(trimmed, description.trim(), [])
      notify.success(t('newRole.created'), t('newRole.createdDetail', { role: trimmed }))
      onCreated(trimmed)
    } catch (err) {
      // DUPLICATE_NAME (race) / validation surface verbatim.
      notify.apiError(t('toast.failed'), err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('newRole.title')}
      width="32rem"
      footer={
        <>
          <Button variant="text" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button variant="primary" onClick={create} disabled={!valid || busy}>
            {busy ? t('newRole.creating') : t('newRole.create')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs font-semibold text-muted-foreground">{t('newRole.kind')}</span>
          <select
            className="rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none"
            value={kind}
            onChange={(e) => setKind(e.target.value as Kind)}
          >
            <option value="single">{t('newRole.kindSingle')}</option>
            <option value="composite">{t('newRole.kindComposite')}</option>
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs font-semibold text-muted-foreground">
            {t('newRole.name')} <span className="text-red-600">•</span>
          </span>
          <input
            className="rounded-lg border border-input bg-background px-3 py-2 text-sm uppercase outline-none"
            placeholder={t('newRole.namePlaceholder')}
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={60}
            autoFocus
          />
          <span className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
            <Lock className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
            {t('newRole.nameLock')}
          </span>
          {duplicate && <span className="text-[11px] text-red-600">{t('newRole.duplicate')}</span>}
          {tooLong && <span className="text-[11px] text-red-600">{t('newRole.tooLong')}</span>}
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs font-semibold text-muted-foreground">{t('newRole.description')}</span>
          <input
            className="rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none"
            placeholder={t('newRole.descriptionPlaceholder')}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>

        {kind === 'composite' && (
          <p className="rounded-lg border border-primary/30 bg-primary/5 p-2.5 text-xs text-muted-foreground">
            {t('newRole.compositeHint')}
          </p>
        )}
      </div>
    </Modal>
  )
}
