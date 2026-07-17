import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import Modal from '@/core/ui/Modal'
import Button from '@/core/ui/Button'
import { notify } from '@/core/services/notify'
import { uaAdminApi } from './api'

interface Props {
  open: boolean
  onClose: () => void
  onCreated: (employeeId: string) => void
}

const FIELD =
  'h-8 w-full rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring'
const LABEL = 'mb-1 block text-xs font-semibold text-muted-foreground'

/**
 * Create a Ua identity only — no credential. An absent credential is exactly what
 * routes the person into SMS self-activation (spec story 25). Deliberately cannot
 * set a password here.
 */
export default function NewIdentityModal({ open, onClose, onCreated }: Props) {
  const { t } = useTranslation('ua-admin')
  const [employeeId, setEmployeeId] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [phone, setPhone] = useState('')
  const [busy, setBusy] = useState(false)

  function reset() {
    setEmployeeId('')
    setDisplayName('')
    setPhone('')
  }

  async function submit() {
    setBusy(true)
    try {
      const id = employeeId.trim()
      await uaAdminApi.upsert({ employeeId: id, displayName: displayName.trim(), phone: phone.trim(), isActive: true })
      notify.success(t('toast.created'), t('toast.createdDetail', { id }))
      onCreated(id)
      onClose()
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
      title={t('new.title')}
      width="26rem"
      onShow={reset}
      footer={
        <>
          <Button variant="text" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button variant="primary" onClick={submit} disabled={busy || employeeId.trim() === ''}>
            {t('new.create')}
          </Button>
        </>
      }
    >
      <p className="mb-3 text-sm text-muted-foreground">{t('new.body')}</p>
      <div className="mb-3">
        <label className={LABEL} htmlFor="ni-id">
          {t('new.employeeId')}
        </label>
        <input id="ni-id" className={FIELD} value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} autoFocus />
      </div>
      <div className="mb-3">
        <label className={LABEL} htmlFor="ni-name">
          {t('new.displayName')}
        </label>
        <input id="ni-name" className={FIELD} value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
      </div>
      <div className="mb-1">
        <label className={LABEL} htmlFor="ni-phone">
          {t('new.phone')}
        </label>
        <input id="ni-phone" className={FIELD} value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" />
      </div>
    </Modal>
  )
}
