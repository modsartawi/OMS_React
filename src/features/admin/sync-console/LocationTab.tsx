import type { ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { apiErrorMessage } from '@/core/api'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Ltr from '@/core/ui/Ltr'
import { storeLocationQuery } from './api'
import Loading from './Loading'

/**
 * The Location tab (ticket 446): the store's sync location as the door returns it.
 *
 * 🚩 **No credentials.** The door never sends `userId` or `password` and no field is
 * drawn for them; the Credentials row only says they stay on the server. Edit
 * location joins in 449.
 */
export default function LocationTab({ code }: { code: string }) {
  const { t } = useTranslation('sync-console')
  const location = useQuery(storeLocationQuery(code))

  if (location.isPending) return <Loading label={t('location.loading')} />
  if (location.isError)
    return <ErrorBanner className="p-3" message={apiErrorMessage(location.error, t('location.failed'))} />

  const l = location.data
  return (
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
