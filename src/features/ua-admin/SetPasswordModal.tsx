import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import Modal from '@/core/ui/Modal'
import Button from '@/core/ui/Button'
import { notify } from '@/core/services/notify'
import { uaAdminApi } from './api'
import { generateTempPassword } from './helpers'

interface Props {
  employeeId: string
  open: boolean
  onClose: () => void
  onDone: () => void
}

/**
 * Set a one-time temporary password. The value is generated CLIENT-side (the
 * server never echoes one — contract §4) and shown exactly once: the admin reads
 * it to the user, who must change it at first login. A fresh value is minted each
 * time the dialog opens (and via Regenerate) so a cancelled dialog never leaks a
 * password that was actually set.
 */
export default function SetPasswordModal({ employeeId, open, onClose, onDone }: Props) {
  const { t } = useTranslation('ua-admin')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit() {
    setBusy(true)
    try {
      await uaAdminApi.setPassword(employeeId, password)
      notify.success(t('toast.passwordSet'))
      onDone()
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
      title={t('password.title')}
      width="26rem"
      // A new password every time the dialog opens.
      onShow={() => setPassword(generateTempPassword())}
      footer={
        <>
          <Button variant="text" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button variant="secondary" onClick={() => setPassword(generateTempPassword())} disabled={busy}>
            {t('password.regenerate')}
          </Button>
          <Button variant="primary" onClick={submit} disabled={busy || password === ''}>
            {t('password.confirm')}
          </Button>
        </>
      }
    >
      <p className="mb-3 text-sm">{t('password.body')}</p>
      <div className="select-all rounded-md border border-dashed border-border bg-muted/60 px-3 py-2 text-center font-mono text-base font-bold tracking-wider">
        {password || t('password.generating')}
      </div>
    </Modal>
  )
}
