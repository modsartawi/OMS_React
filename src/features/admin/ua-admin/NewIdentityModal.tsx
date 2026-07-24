import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import Modal from '@/core/ui/Modal'
import Button from '@/core/ui/Button'
import { notify } from '@/core/services/notify'
import { uaAdminApi } from './api'
import ChannelSelect from './ChannelSelect'
import ChannelWarning from './ChannelWarning'
import { typedPhoneClass, type DeliveryChannel } from './helpers'

interface Props {
  open: boolean
  onClose: () => void
  onCreated: (employeeId: string) => void
}

const FIELD =
  'h-8 w-full rounded-lg border border-input bg-background px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring'
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
  const [email, setEmail] = useState('')
  // A new identity is SMS — the estate default, and what every person outside the
  // Egypt team stays on. Email is always a deliberate act (spec 718).
  const [channel, setChannel] = useState<DeliveryChannel>('sms')
  // …and because this endpoint is an upsert, the DEFAULT sms and a deliberately
  // chosen sms are different messages: only the chosen one is worth writing over
  // an existing person's channel.
  const [channelChosen, setChannelChosen] = useState(false)
  const [busy, setBusy] = useState(false)

  function reset() {
    setEmployeeId('')
    setDisplayName('')
    setPhone('')
    setEmail('')
    setChannel('sms')
    setChannelChosen(false)
  }

  async function submit() {
    setBusy(true)
    try {
      const id = employeeId.trim()
      const address = email.trim()
      await uaAdminApi.upsert({
        employeeId: id,
        displayName: displayName.trim(),
        phone: phone.trim(),
        // This endpoint is an UPSERT: typing an id that already exists EDITS that
        // person. So an untouched field is OMITTED (= not supplied) rather than
        // sent as ''/'sms' — otherwise "New identity" on an existing id would
        // clear a stored Egypt address and drop them back onto a channel that
        // cannot reach them. A genuinely new row starts on sms server-side, so
        // omitting the default costs nothing.
        ...(address === '' ? {} : { email: address }),
        ...(channelChosen ? { deliveryChannel: channel } : {}),
        isActive: true,
      })
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
      <div className="mb-3">
        <label className={LABEL} htmlFor="ni-phone">
          {t('new.phone')}
        </label>
        <input id="ni-phone" className={FIELD} value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" />
      </div>
      <div className="mb-3">
        <label className={LABEL} htmlFor="ni-email">
          {t('new.email')}
        </label>
        <input
          id="ni-email"
          className={FIELD}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          inputMode="email"
        />
      </div>
      <div className="mb-1">
        <label className={LABEL} htmlFor="ni-channel">
          {t('delivery.label')}
        </label>
        <ChannelSelect
          id="ni-channel"
          className={FIELD}
          value={channel}
          onChange={(c) => {
            setChannel(c)
            setChannelChosen(true)
          }}
        />
      </div>
      {/* Armed by the same condition as the Create button: an empty form is not
          yet a person about to be created unreachable, so it gets no alarm. */}
      {employeeId.trim() === '' ? null : (
        <ChannelWarning
          phoneClass={typedPhoneClass(phone)}
          email={email}
          deliveryChannel={channel}
          className="mt-2 text-xs text-danger-800"
        />
      )}
    </Modal>
  )
}
