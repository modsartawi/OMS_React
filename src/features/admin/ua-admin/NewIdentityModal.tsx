import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { apiErrorMessage } from '@/core/api'
import Modal from '@/core/ui/Modal'
import Button from '@/core/ui/Button'
import Field from '@/core/ui/Field'
import Input from '@/core/ui/Input'
import ErrorBanner from '@/core/ui/ErrorBanner'
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

/**
 * Create a Ua identity only — no credential. An absent credential is exactly what
 * routes the person into SMS self-activation (spec story 25). Deliberately cannot
 * set a password here.
 *
 * A failed create renders inside the dialog, which stays open with the form as typed
 * (spec 380 F18).
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
  const [error, setError] = useState<unknown>(null)

  function reset() {
    setEmployeeId('')
    setDisplayName('')
    setPhone('')
    setEmail('')
    setChannel('sms')
    setChannelChosen(false)
    setError(null)
  }

  async function submit() {
    setBusy(true)
    setError(null)
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
      setError(err)
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
      <Field id="ni-id" label={t('new.employeeId')} className="mb-3">
        <Input className="w-full" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} autoFocus />
      </Field>
      <Field id="ni-name" label={t('new.displayName')} className="mb-3">
        <Input className="w-full" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
      </Field>
      <Field id="ni-phone" label={t('new.phone')} className="mb-3">
        <Input className="w-full" value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" />
      </Field>
      <Field id="ni-email" label={t('new.email')} className="mb-3">
        <Input className="w-full" value={email} onChange={(e) => setEmail(e.target.value)} inputMode="email" />
      </Field>
      <Field id="ni-channel" label={t('delivery.label')} className="mb-1">
        <ChannelSelect
          id="ni-channel"
          className="w-full"
          value={channel}
          onChange={(c) => {
            setChannel(c)
            setChannelChosen(true)
          }}
        />
      </Field>
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
      {error !== null && (
        <ErrorBanner
          title={t('toast.failed')}
          message={apiErrorMessage(error, t('bulk.unexpected'))}
          className="mt-3 p-2.5"
        />
      )}
    </Modal>
  )
}
