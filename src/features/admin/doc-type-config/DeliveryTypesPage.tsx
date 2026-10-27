import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { Loader2 } from 'lucide-react'

import { apiErrorMessage } from '@/core/api'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Ltr from '@/core/ui/Ltr'
import ScreenGate from '@/core/ui/ScreenGate'
import { canViewDocTypeConfig, docTypeConfigAccessQuery } from './api'
import { deliveryTypesQuery } from './delivery-types-api'

/**
 * Delivery document types — `/admin/delivery-types` (BackOffice spec 3148 story 33, ticket 3154). Every delivery type
 * with its code, description, category and whether it competes; a code opens the type
 * (`/admin/delivery-types/:deliveryType`). Behind the existing OMS access, like the rest of the area.
 */
export default function DeliveryTypesPage() {
  const { t } = useTranslation('doc-type-config')
  return (
    <ScreenGate
      query={docTypeConfigAccessQuery()}
      can={canViewDocTypeConfig}
      ns="doc-type-config"
      title={t('deliveryTypes.title')}
      subtitle={t('deliveryTypes.subtitle')}
    >
      <DeliveryTypes />
    </ScreenGate>
  )
}

function DeliveryTypes() {
  const { t } = useTranslation('doc-type-config')
  const types = useQuery(deliveryTypesQuery())

  if (types.isError) return <ErrorBanner className="p-3" message={apiErrorMessage(types.error, t('deliveryTypes.failed'))} />
  if (!types.data) {
    return (
      <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground" role="status">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        {t('deliveryTypes.loading')}
      </div>
    )
  }
  if (types.data.length === 0) {
    return (
      <p className="rounded-md border border-border/60 py-6 text-center text-sm text-muted-foreground" data-delivery-types-empty="">
        {t('deliveryTypes.empty')}
      </p>
    )
  }

  return (
    <div className="overflow-x-auto rounded-md border border-border/60" data-delivery-types="">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-muted text-xs text-muted-foreground">
            <th className="px-3 py-2 text-start font-medium">{t('deliveryTypes.columns.documentType')}</th>
            <th className="px-3 py-2 text-start font-medium">{t('deliveryTypes.columns.description')}</th>
            <th className="px-3 py-2 text-start font-medium">{t('deliveryTypes.columns.documentCategory')}</th>
            <th className="px-3 py-2 text-start font-medium">{t('deliveryTypes.columns.isCompeted')}</th>
          </tr>
        </thead>
        <tbody>
          {types.data.map((row) => (
            <tr key={row.documentType} className="border-t border-border/60" data-delivery-type-row={row.documentType}>
              <td className="px-3 py-1.5">
                <Link
                  to={`/admin/delivery-types/${encodeURIComponent(row.documentType)}`}
                  className="font-mono text-primary hover:underline"
                  data-delivery-type-link={row.documentType}
                >
                  <Ltr>{row.documentType}</Ltr>
                </Link>
              </td>
              <td className="px-3 py-1.5">
                <bdi>{row.description}</bdi>
              </td>
              <td className="px-3 py-1.5">{t(`deliveryTypes.categories.${row.documentCategory}`, { defaultValue: row.documentCategory })}</td>
              <td className="px-3 py-1.5">{t(row.isCompeted ? 'value.yes' : 'value.no')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
