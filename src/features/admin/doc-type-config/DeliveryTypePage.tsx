import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'
import { ArrowLeft, Copy, Loader2, Lock, Pencil } from 'lucide-react'

import { apiErrorCode, apiErrorMessage } from '@/core/api'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Ltr from '@/core/ui/Ltr'
import ScreenGate from '@/core/ui/ScreenGate'
import { formatPair } from '@/core/util/bidi'
import { canEditDocTypeConfig, canViewDocTypeConfig, docTypeConfigAccessQuery } from './api'
import { DELIVERY_FIELD_GROUPS, isDeliveryLocked } from './delivery-type-form'
import type { DeliveryTypeSettings } from './delivery-type-types'
import { DELIVERY_TYPE_ERRORS, courierAssignmentsQuery, deliveryTypeHistoryQuery, deliveryTypeQuery } from './delivery-types-api'
import DeliveryTypeDialog from './DeliveryTypeDialog'
import DeliveryTypeValueText from './DeliveryTypeValueText'
import DocumentTypeTabs from './DocumentTypeTabs'

/**
 * One delivery document type — `/admin/delivery-types/:deliveryType` (BackOffice spec 3148 stories 33-37, ticket
 * 3154): every setting grouped (identity, callouts), its courier assignments (read-only — a copy carries them), and
 * the History tab (3152) with its own door. Edit and Copy are shown only with the configuration grant; code and
 * category are marked locked.
 */
export default function DeliveryTypePage() {
  const { t } = useTranslation('doc-type-config')
  const { deliveryType = '' } = useParams()
  return (
    <ScreenGate
      query={docTypeConfigAccessQuery()}
      can={canViewDocTypeConfig}
      ns="doc-type-config"
      title={t('deliveryTypes.title')}
      subtitle={t('deliveryTypes.subtitle')}
    >
      <Link to="/admin/delivery-types" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground" data-delivery-back="">
        <ArrowLeft className="h-3.5 w-3.5 rtl:rotate-180" aria-hidden />
        {t('deliveryTypes.back')}
      </Link>
      <DeliveryType code={deliveryType} />
    </ScreenGate>
  )
}

function DeliveryType({ code }: { code: string }) {
  const { t } = useTranslation('doc-type-config')
  const detail = useQuery(deliveryTypeQuery(code))
  const access = useQuery(docTypeConfigAccessQuery())
  const canEdit = canEditDocTypeConfig(access.data)
  const [dialog, setDialog] = useState<'edit' | 'copy' | null>(null)

  if (detail.isError) {
    const notFound = apiErrorCode(detail.error) === DELIVERY_TYPE_ERRORS.unknownDeliveryType
    return (
      <ErrorBanner
        className="p-3"
        title={notFound ? t('deliveryTypes.notFoundTitle') : undefined}
        message={apiErrorMessage(detail.error, t('deliveryTypes.detailFailed'))}
      />
    )
  }
  if (!detail.data) {
    return (
      <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground" role="status">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        {t('deliveryTypes.detailLoading')}
      </div>
    )
  }

  const settings = detail.data
  return (
    <div className="flex min-w-0 flex-col gap-4" data-delivery-type={settings.documentType}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold" data-delivery-type-heading="">
          <Ltr>{formatPair(settings.documentType, settings.description)}</Ltr>
        </h2>
        {canEdit && (
          <div className="flex items-center gap-2">
            <Button variant="outlined" onClick={() => setDialog('copy')} data-delivery-type-copy="">
              <Copy className="h-3.5 w-3.5" aria-hidden />
              {t('detail.copy')}
            </Button>
            <Button variant="outlined" onClick={() => setDialog('edit')} data-delivery-type-edit="">
              <Pencil className="h-3.5 w-3.5" aria-hidden />
              {t('detail.edit')}
            </Button>
          </div>
        )}
      </div>
      <DocumentTypeTabs
        code={settings.documentType}
        historyQuery={deliveryTypeHistoryQuery(settings.documentType)}
        settings={
          <div className="flex min-w-0 flex-col gap-4">
            <SettingsGroups settings={settings} />
            <CourierAssignments code={settings.documentType} />
          </div>
        }
      />
      {canEdit && <DeliveryTypeDialog mode="edit" open={dialog === 'edit'} loaded={settings} onClose={() => setDialog(null)} />}
      {canEdit && <DeliveryTypeDialog mode="copy" open={dialog === 'copy'} loaded={settings} onClose={() => setDialog(null)} />}
    </div>
  )
}

function SettingsGroups({ settings }: { settings: DeliveryTypeSettings }) {
  const { t } = useTranslation('doc-type-config')
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {DELIVERY_FIELD_GROUPS.map(({ group, fields }) => (
        <section key={group} className="rounded-lg border border-border/60 bg-card p-3" data-delivery-type-group={group}>
          <h3 className="mb-2 text-sm font-semibold">{t(`deliveryTypes.groups.${group}`)}</h3>
          <dl className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1.5 text-sm">
            {fields.map((def) => (
              <div key={def.field} className="contents" data-delivery-type-field={def.field}>
                <dt className="flex items-center gap-1 text-muted-foreground">
                  {t(`fields.${def.field}`)}
                  {isDeliveryLocked(def.field) && <Lock className="h-3 w-3" aria-label={t('detail.locked')} data-locked="" />}
                </dt>
                <dd className="text-end">
                  <DeliveryTypeValueText def={def} value={settings[def.field]} />
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </div>
  )
}

function CourierAssignments({ code }: { code: string }) {
  const { t } = useTranslation('doc-type-config')
  const rows = useQuery(courierAssignmentsQuery(code))
  return (
    <section className="rounded-lg border border-border/60 bg-card p-3" data-courier-assignments="">
      <h3 className="text-sm font-semibold">{t('deliveryTypes.couriers.title')}</h3>
      <p className="mb-2 text-xs text-muted-foreground">{t('deliveryTypes.couriers.hint')}</p>
      {rows.isError ? (
        <ErrorBanner className="p-2" message={apiErrorMessage(rows.error, t('deliveryTypes.couriers.failed'))} />
      ) : !rows.data ? (
        <p className="text-xs text-muted-foreground" role="status">
          {t('deliveryTypes.couriers.loading')}
        </p>
      ) : rows.data.length === 0 ? (
        <p className="text-xs text-muted-foreground" data-courier-empty="">
          {t('deliveryTypes.couriers.empty')}
        </p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-muted-foreground">
              <th className="py-1 text-start font-medium">{t('fields.deliveringPlant')}</th>
              <th className="py-1 text-start font-medium">{t('fields.courierCode')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.data.map((r) => (
              <tr key={r.deliveringPlant} className="border-t border-border/60" data-courier-row={r.deliveringPlant}>
                <td className="py-1 pe-3">
                  {r.deliveringPlant === '' ? (
                    <span className="text-muted-foreground">{t('deliveryTypes.couriers.everyPlant')}</span>
                  ) : (
                    <Ltr>{r.deliveringPlant}</Ltr>
                  )}
                </td>
                <td className="py-1">
                  <Ltr>{r.courierCode}</Ltr>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}
