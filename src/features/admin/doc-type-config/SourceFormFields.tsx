import { useTranslation } from 'react-i18next'
import { AlertTriangle } from 'lucide-react'

import { fsi } from '@/core/util/bidi'
import { ACTION_DESCRIPTION_MAX, type DescriptionProblem } from './action-type-edit'
import { SOURCE_CATEGORIES } from './document-source-edit'
import type { DocumentSourceEditableField, DocumentSourceSettings } from './document-source-types'

/** The two editable fields of a document source (ticket 3156), shared by the edit and the copy dialog. */
export default function SourceFormFields({
  draft,
  description,
  disabled,
  invalidDescription,
  invalidCategory,
  onChange,
}: {
  draft: DocumentSourceSettings
  description: DescriptionProblem | null
  disabled: boolean
  invalidDescription?: boolean
  invalidCategory?: boolean
  onChange: (field: DocumentSourceEditableField, value: string) => void
}) {
  const { t } = useTranslation('doc-type-config')
  return (
    <>
      <div className="flex flex-col gap-1" data-source-field="description">
        <label className="flex items-center justify-between gap-2 text-sm">
          <span>{t('fields.description')}</span>
          <input
            type="text"
            value={draft.description}
            maxLength={ACTION_DESCRIPTION_MAX}
            disabled={disabled}
            dir="ltr"
            aria-invalid={description !== null || invalidDescription || undefined}
            onChange={(e) => onChange('description', e.target.value)}
            className="w-72 rounded-md border border-border/60 bg-background px-2 py-1 text-sm"
            data-source-description=""
          />
        </label>
        {description && (
          <p role="alert" className="flex items-center gap-1.5 text-xs text-danger-800" data-source-description-problem={description}>
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden />
            {t(`actionTypes.edit.description.${description}`, { max: fsi(String(ACTION_DESCRIPTION_MAX)) })}
          </p>
        )}
      </div>
      <label className="flex items-center justify-between gap-2 text-sm" data-source-field="documentSourceCategory">
        <span>{t('fields.documentSourceCategory')}</span>
        <select
          value={draft.documentSourceCategory}
          disabled={disabled}
          aria-invalid={invalidCategory || undefined}
          onChange={(e) => onChange('documentSourceCategory', e.target.value)}
          className="w-72 rounded-md border border-border/60 bg-background px-2 py-1 text-sm"
          data-source-category=""
        >
          {SOURCE_CATEGORIES.map((c) => (
            <option key={c || '_blank'} value={c}>
              {t(`documentSources.categories.${c || '_blank'}`)}
            </option>
          ))}
        </select>
      </label>
      <p className="text-xs text-muted-foreground">{t('documentSources.categoryHint')}</p>
    </>
  )
}
