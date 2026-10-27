import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'
import { ArrowLeft, Loader2, Lock, Pencil } from 'lucide-react'

import { apiErrorCode, apiErrorMessage } from '@/core/api'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Ltr from '@/core/ui/Ltr'
import ScreenGate from '@/core/ui/ScreenGate'
import { formatPair } from '@/core/util/bidi'
import {
  DOC_TYPE_CONFIG_ERRORS,
  canEditDocTypeConfig,
  canViewDocTypeConfig,
  docTypeConfigAccessQuery,
  documentTypeQuery,
} from './api'
import DocumentTypeTabs from './DocumentTypeTabs'
import EditDocumentTypeDialog from './EditDocumentTypeDialog'
import FieldValueText from './FieldValueText'
import { FIELD_GROUPS, isLocked } from './fields'
import type { DocumentTypeSettings } from './types'

/**
 * One document type — `/admin/doc-types/:documentType` (BackOffice spec 3148 stories 7, 9-10, ticket 3149): every
 * setting, grouped (identity, customer, credit customer, pricing, delivery, billing, picking, notifications,
 * controls). Edit — shown only with the configuration grant — opens the edit dialog. Code, category and engine are
 * marked locked.
 */
export default function DocumentTypePage() {
  const { t } = useTranslation('doc-type-config')
  const { documentType = '' } = useParams()
  return (
    <ScreenGate query={docTypeConfigAccessQuery()} can={canViewDocTypeConfig} ns="doc-type-config" title={t('title')} subtitle={t('subtitle')}>
      <Link to="/admin/doc-types" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground" data-doc-type-back="">
        <ArrowLeft className="h-3.5 w-3.5 rtl:rotate-180" aria-hidden />
        {t('detail.back')}
      </Link>
      <DocumentType code={documentType} />
    </ScreenGate>
  )
}

function DocumentType({ code }: { code: string }) {
  const { t } = useTranslation('doc-type-config')
  const detail = useQuery(documentTypeQuery(code))
  const access = useQuery(docTypeConfigAccessQuery())
  const canEdit = canEditDocTypeConfig(access.data)
  const [editing, setEditing] = useState(false)

  if (detail.isError) {
    const notFound = apiErrorCode(detail.error) === DOC_TYPE_CONFIG_ERRORS.unknownDocumentType
    return (
      <ErrorBanner
        className="p-3"
        title={notFound ? t('detail.notFoundTitle') : undefined}
        message={apiErrorMessage(detail.error, t('detail.failed'))}
      />
    )
  }
  if (!detail.data) {
    return (
      <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground" role="status">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        {t('detail.loading')}
      </div>
    )
  }

  const settings = detail.data
  return (
    <div className="flex min-w-0 flex-col gap-4" data-doc-type={settings.documentType}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold" data-doc-type-heading="">
          <Ltr>{formatPair(settings.documentType, settings.description)}</Ltr>
        </h2>
        {canEdit && (
          <Button variant="outlined" onClick={() => setEditing(true)} data-doc-type-edit="">
            <Pencil className="h-3.5 w-3.5" aria-hidden />
            {t('detail.edit')}
          </Button>
        )}
      </div>
      <DocumentTypeTabs code={settings.documentType} settings={<SettingsGroups settings={settings} />} />
      {canEdit && <EditDocumentTypeDialog open={editing} loaded={settings} onClose={() => setEditing(false)} />}
    </div>
  )
}

function SettingsGroups({ settings }: { settings: DocumentTypeSettings }) {
  const { t } = useTranslation('doc-type-config')
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {FIELD_GROUPS.map(({ group, fields }) => (
        <section key={group} className="rounded-lg border border-border/60 bg-card p-3" data-doc-type-group={group}>
          <h3 className="mb-2 text-sm font-semibold">{t(`groups.${group}`)}</h3>
          <dl className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1.5 text-sm">
            {fields.map((def) => (
              <div key={def.field} className="contents" data-doc-type-field={def.field}>
                <dt className="flex items-center gap-1 text-muted-foreground">
                  {t(`fields.${def.field}`)}
                  {isLocked(def.field) && <Lock className="h-3 w-3" aria-label={t('detail.locked')} data-locked="" />}
                </dt>
                <dd className="text-end">
                  <FieldValueText def={def} value={settings[def.field]} />
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </div>
  )
}
