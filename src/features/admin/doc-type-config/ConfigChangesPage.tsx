import { useState, type FormEvent, type ReactNode } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Download, Loader2 } from 'lucide-react'

import { apiErrorMessage, isBareDenial } from '@/core/api'
import { notify } from '@/core/services/notify'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Field from '@/core/ui/Field'
import GridPager from '@/core/ui/GridPager'
import Input from '@/core/ui/Input'
import Ltr from '@/core/ui/Ltr'
import ScreenGate from '@/core/ui/ScreenGate'
import Select from '@/core/ui/Select'
import { saveBlob } from '@/core/util/download-file'
import { formatFigure } from '@/core/util/number-format'
import { canViewDocTypeConfig, docTypeConfigAccessQuery } from './api'
import { CONFIG_CHANGES_PAGE_SIZE, changeLogApi, configChangesQuery } from './change-log-api'
import { CONFIG_ENTITY_TYPES, type ConfigChangeFilter } from './change-log-types'
import ChangeEntry from './ChangeEntry'
import { EMPTY_CONFIG_CHANGE_FILTER, configChangeRangeValid, isFilteredConfigChanges } from './config-changes-filter'

/**
 * Config changes — `/admin/config-changes` (BackOffice spec 3148 stories 49-53, ticket 3152): every change to the
 * document configuration, newest first, filtered by kind, key, user and a local date range (both days included),
 * paged by the server; Export hands the WHOLE filtered set to Excel (the server builds the workbook). Read-only, on
 * the existing OMS access. The filters are asked when Search is pressed; From after To is refused here.
 */
export default function ConfigChangesPage() {
  const { t } = useTranslation('doc-type-config')
  return (
    <ScreenGate
      query={docTypeConfigAccessQuery()}
      can={canViewDocTypeConfig}
      ns="doc-type-config"
      title={t('changes.title')}
      subtitle={t('changes.subtitle')}
    >
      <ConfigChanges />
    </ScreenGate>
  )
}


function ConfigChanges() {
  const { t } = useTranslation('doc-type-config')
  const [draft, setDraft] = useState<ConfigChangeFilter>(EMPTY_CONFIG_CHANGE_FILTER)
  const [filter, setFilter] = useState<ConfigChangeFilter>(EMPTY_CONFIG_CHANGE_FILTER)
  const [page, setPage] = useState(1)
  const [exporting, setExporting] = useState(false)
  const badRange = !configChangeRangeValid(draft)
  const set = (field: keyof ConfigChangeFilter) => (value: string) => setDraft((d) => ({ ...d, [field]: value }))
  const changes = useQuery({ ...configChangesQuery(filter, page), placeholderData: keepPreviousData })

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (badRange) return
    setFilter(draft)
    setPage(1)
  }

  async function exportXlsx() {
    setExporting(true)
    try {
      const { blob, filename } = await changeLogApi.exportConfigChanges(filter)
      saveBlob(filename ?? `${t('changes.export.fileName')}.xlsx`, blob)
      notify.success(t('changes.export.done'))
    } catch (err) {
      notify.error(t('changes.export.failed'), apiErrorMessage(err, t('changes.export.failedHint')))
    } finally {
      setExporting(false)
    }
  }

  let body: ReactNode
  if (changes.isError) {
    body = (
      <ErrorBanner
        className="p-3"
        message={isBareDenial(changes.error) ? t('history.denied') : apiErrorMessage(changes.error, t('changes.failed'))}
      />
    )
  } else if (!changes.data) {
    body = (
      <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground" role="status">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        {t('changes.loading')}
      </div>
    )
  } else if (changes.data.rows.length === 0) {
    body = (
      <p className="rounded-md border border-border/60 py-6 text-center text-sm text-muted-foreground" data-changes-empty="">
        {isFilteredConfigChanges(filter) ? t('changes.noMatch') : t('changes.empty')}
      </p>
    )
  } else {
    body = (
      <div className="flex min-w-0 flex-col gap-2">
        <p className="text-xs text-muted-foreground" data-changes-total={changes.data.total}>
          {t('changes.total')} <Ltr>{formatFigure(changes.data.total)}</Ltr>
        </p>
        {changes.data.rows.map((row) => (
          <ChangeEntry key={row.changeId} row={row} linkType />
        ))}
        <GridPager
          page={changes.data.page}
          pageSize={CONFIG_CHANGES_PAGE_SIZE}
          totalMatches={changes.data.total}
          busy={changes.isFetching}
          onPage={setPage}
        />
      </div>
    )
  }

  return (
    <div className="flex min-w-0 flex-col gap-3" data-config-changes="">
      <form onSubmit={submit} aria-label={t('changes.filters')} className="flex flex-wrap items-end gap-2" data-changes-filters="">
        <Field label={t('changes.entityType')}>
          <Select value={draft.entityType} onChange={(e) => set('entityType')(e.target.value)} data-filter="entityType">
            <option value="">{t('changes.anyEntityType')}</option>
            {CONFIG_ENTITY_TYPES.map((kind) => (
              <option key={kind} value={kind}>
                {t(`entityTypes.${kind}`)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t('changes.entityKey')}>
          <Input type="search" value={draft.entityKey} onChange={(e) => set('entityKey')(e.target.value)} dir="ltr" wrapperClassName="w-32" className="font-mono" data-filter="entityKey" />
        </Field>
        <Field label={t('changes.user')}>
          <Input type="search" value={draft.user} onChange={(e) => set('user')(e.target.value)} dir="ltr" wrapperClassName="w-36" data-filter="user" />
        </Field>
        <Field label={t('changes.from')}>
          <Input type="date" value={draft.from} max={draft.to || undefined} onChange={(e) => set('from')(e.target.value)} data-filter="from" />
        </Field>
        <Field label={t('changes.to')}>
          <Input type="date" value={draft.to} min={draft.from || undefined} onChange={(e) => set('to')(e.target.value)} data-filter="to" />
        </Field>
        <Button type="submit" disabled={badRange} data-changes-apply="">
          {t('changes.apply')}
        </Button>
        <Button
          variant="text"
          onClick={() => {
            setDraft(EMPTY_CONFIG_CHANGE_FILTER)
            setFilter(EMPTY_CONFIG_CHANGE_FILTER)
            setPage(1)
          }}
          data-changes-clear=""
        >
          {t('changes.clear')}
        </Button>
        <Button
          variant="ghost"
          className="ms-auto"
          disabled={exporting || !changes.data || changes.data.total === 0}
          onClick={() => void exportXlsx()}
          data-changes-export=""
        >
          {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Download className="h-3.5 w-3.5" aria-hidden />}
          {t('changes.export.button')}
        </Button>
        {badRange && (
          <span className="w-full text-xs text-danger-800" role="alert" data-changes-bad-range="">
            {t('changes.badRange')}
          </span>
        )}
      </form>
      {body}
    </div>
  )
}

