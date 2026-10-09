import { useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { apiErrorMessage } from '@/core/api'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Ltr from '@/core/ui/Ltr'
import { storeLocationQuery, syncConsoleAccessQuery } from './api'
import EditLocationDialog from './EditLocationDialog'
import Loading from './Loading'

/**
 * The Location tab (ticket 446): the store's sync location as the door returns it.
 *
 * 🚩 **No credentials.** The door never sends `userId` or `password` and no field is
 * drawn for them; the Credentials row only says they stay on the server.
 *
 * With `canOperate`, **Edit location** (449) opens the reason dialog on the
 * description, IP, instance and database; without it the button is absent.
 */
export default function LocationTab({ code }: { code: string }) {
  const { t } = useTranslation('sync-console')
  const location = useQuery(storeLocationQuery(code))
  const access = useQuery(syncConsoleAccessQuery())
  const [editing, setEditing] = useState(false)

  if (location.isPending) return <Loading label={t('location.loading')} />
  if (location.isError)
    return <ErrorBanner className="p-3" message={apiErrorMessage(location.error, t('location.failed'))} />

  const l = location.data
  return (
    <div className="flex flex-col gap-3">
      <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1.5 text-sm" data-location="">
        <Row label={t('location.code')}>
          <Ltr>{l.code}</Ltr>
        </Row>
        <Row label={t('location.description')}>
          <bdi className="font-sans">{l.description}</bdi>
        </Row>
        <Row label={t('location.ip')}>
          <Ltr>{l.ip}</Ltr>
        </Row>
        <Row label={t('location.instance')}>
          <Ltr>{l.instance}</Ltr>
        </Row>
        <Row label={t('location.dbName')}>
          <Ltr>{l.dbName}</Ltr>
        </Row>
        <Row label={t('location.groupId')}>
          <Ltr>{l.groupId}</Ltr>
        </Row>
        <Row label={t('location.father')}>
          <Ltr>{l.father}</Ltr>
        </Row>
        <Row label={t('location.isPosSyncEnabled')}>
          <span className="font-sans">{l.isPosSyncEnabled ? t('location.enabled') : t('location.disabled')}</span>
        </Row>
        <Row label={t('location.credentials')}>
          <span className="font-sans text-muted-foreground">{t('location.credentialsNote')}</span>
        </Row>
      </dl>
      {access.data?.canOperate === true && (
        <div>
          <Button variant="secondary" onClick={() => setEditing(true)} data-edit-location-open="">
            {t('editLocation.open')}
          </Button>
        </div>
      )}
      {editing && <EditLocationDialog location={l} onClose={() => setEditing(false)} />}
    </div>
  )
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-mono break-words">{children}</dd>
    </>
  )
}
