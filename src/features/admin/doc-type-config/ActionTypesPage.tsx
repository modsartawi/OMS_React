import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router'
import { Check, Loader2, Minus, Pencil } from 'lucide-react'

import { apiErrorMessage } from '@/core/api'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Field from '@/core/ui/Field'
import Ltr from '@/core/ui/Ltr'
import ScreenGate from '@/core/ui/ScreenGate'
import Select from '@/core/ui/Select'
import { canEditDocTypeConfig, canViewDocTypeConfig, docTypeConfigAccessQuery } from './api'
import { affectedTypesView } from './action-type-edit'
import { ACTION_TYPE_OPTIONS, type ActionTypeCategory, type ActionTypeSettings } from './action-type-types'
import { actionTypeCategoriesQuery, actionTypeCategoryHistoryQuery, actionTypeCategoryQuery } from './action-types-api'
import { ACTION_TYPES_TABS, actionTypesParams, actionTypesViewFromParams, type ActionTypesTab } from './action-types-view'
import AffectedTypesList from './AffectedTypesList'
import EditActionTypeDialog from './EditActionTypeDialog'
import HistoryTab from './HistoryTab'
import TabStrip from './TabStrip'

/**
 * Action types — `/admin/action-types?category=O` (BackOffice spec 3148 stories 38-40, 43; ticket 3155). One document
 * category at a time: each action type's description and five options, and EVERY document type and delivery type in the
 * category — an action type is read by (code, the acting document's category), so an edit reaches them all. Edit
 * (granted only) changes the description and the options; code and category are locked; there is no create. A History
 * tab shows the category's action-type changes. Behind the existing OMS access, like the rest of the area.
 */
export default function ActionTypesPage() {
  const { t } = useTranslation('doc-type-config')
  return (
    <ScreenGate
      query={docTypeConfigAccessQuery()}
      can={canViewDocTypeConfig}
      ns="doc-type-config"
      title={t('actionTypes.title')}
      subtitle={t('actionTypes.subtitle')}
    >
      <ActionTypes />
    </ScreenGate>
  )
}

function ActionTypes() {
  const { t } = useTranslation('doc-type-config')
  const [params, setParams] = useSearchParams()
  const view = actionTypesViewFromParams(params)
  const categories = useQuery(actionTypeCategoriesQuery())
  const go = (category: string, tab: ActionTypesTab) => setParams(actionTypesParams({ category, tab }), { replace: true })

  if (categories.isError) return <ErrorBanner className="p-3" message={apiErrorMessage(categories.error, t('actionTypes.failed'))} />
  if (!categories.data) return <Loading text={t('actionTypes.loading')} />

  return (
    <div className="flex min-w-0 flex-col gap-3" data-action-types="">
      <Field label={t('actionTypes.category')} className="w-fit">
        <Select
          value={view.category}
          onChange={(e) => go(e.target.value, view.tab)}
          data-action-types-category=""
        >
          <option value="">{t('actionTypes.pickCategory')}</option>
          {categories.data.map((c) => (
            <option key={c} value={c}>
              {t(`actionTypes.categories.${c}`, { defaultValue: c })}
            </option>
          ))}
        </Select>
      </Field>
      {view.category === '' ? (
        <p className="rounded-md border border-border/60 py-6 text-center text-sm text-muted-foreground" data-action-types-pick="">
          {t('actionTypes.pickHint')}
        </p>
      ) : (
        <>
          <TabStrip
            tabs={ACTION_TYPES_TABS}
            open={view.tab}
            onSelect={(tab) => go(view.category, tab)}
            idPrefix="action-types"
            label={t('actionTypes.tabs.label')}
            tabLabel={(tab) => t(`actionTypes.tabs.${tab}`)}
          >
            {view.tab === 'history' ? (
              <HistoryTab query={actionTypeCategoryHistoryQuery(view.category)} />
            ) : (
              <Category code={view.category} />
            )}
          </TabStrip>
        </>
      )}
    </div>
  )
}

function Category({ code }: { code: string }) {
  const { t } = useTranslation('doc-type-config')
  const category = useQuery(actionTypeCategoryQuery(code))
  if (category.isError) return <ErrorBanner className="p-3" message={apiErrorMessage(category.error, t('actionTypes.failed'))} />
  if (!category.data) return <Loading text={t('actionTypes.loading')} />
  return <CategoryBody data={category.data} />
}

function CategoryBody({ data }: { data: ActionTypeCategory }) {
  const { t } = useTranslation('doc-type-config')
  const access = useQuery(docTypeConfigAccessQuery())
  const canEdit = canEditDocTypeConfig(access.data)
  // The dialog holds the CODE; it gets the live row from the re-read category, so a stale refusal's re-read reaches it.
  const [editing, setEditing] = useState<ActionTypeSettings | null>(null)
  const editingRow = editing && (data.actionTypes.find((a) => a.actionType === editing.actionType) ?? editing)

  return (
    <div className="flex min-w-0 flex-col gap-3" data-action-type-category={data.category}>
      <AffectedTypesList view={affectedTypesView(data.affectedTypes)} where="page" />
      {data.actionTypes.length === 0 ? (
        <p className="rounded-md border border-border/60 py-6 text-center text-sm text-muted-foreground" data-action-types-empty="">
          {t('actionTypes.empty')}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-md border border-border/60">
          <table className="w-full text-sm" data-action-types-table="">
            <thead className="bg-muted/40 text-xs text-muted-foreground">
              <tr>
                <th className="px-2 py-1.5 text-start font-medium">{t('fields.actionType')}</th>
                <th className="px-2 py-1.5 text-start font-medium">{t('fields.description')}</th>
                {ACTION_TYPE_OPTIONS.map((o) => (
                  <th key={o} className="px-2 py-1.5 text-center font-medium">
                    {t(`fields.${o}`)}
                  </th>
                ))}
                {canEdit && <th className="px-2 py-1.5" />}
              </tr>
            </thead>
            <tbody>
              {data.actionTypes.map((a) => (
                <tr key={a.actionType} className="border-t border-border/60" data-action-type={a.actionType}>
                  <td className="px-2 py-1 font-mono">
                    <Ltr>{a.actionType}</Ltr>
                  </td>
                  <td className="px-2 py-1">
                    <bdi>{a.description}</bdi>
                  </td>
                  {ACTION_TYPE_OPTIONS.map((o) => (
                    <td key={o} className="px-2 py-1 text-center" data-option={o} data-on={a[o] ? 'true' : 'false'}>
                      {a[o] ? (
                        <Check className="inline h-4 w-4 text-success-800" aria-label={t('value.yes')} />
                      ) : (
                        <Minus className="inline h-4 w-4 text-muted-foreground" aria-label={t('value.no')} />
                      )}
                    </td>
                  ))}
                  {canEdit && (
                    <td className="px-2 py-1 text-end">
                      <Button variant="text" onClick={() => setEditing(a)} data-action-type-edit={a.actionType}>
                        <Pencil className="h-3.5 w-3.5" aria-hidden />
                        {t('detail.edit')}
                      </Button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {canEdit && editingRow && (
        <EditActionTypeDialog open loaded={editingRow} affectedTypes={data.affectedTypes} onClose={() => setEditing(null)} />
      )}
    </div>
  )
}

function Loading({ text }: { text: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground" role="status">
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
      {text}
    </div>
  )
}
