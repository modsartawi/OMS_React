import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router'
import { Copy, Loader2, Pencil } from 'lucide-react'

import { apiErrorMessage } from '@/core/api'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Ltr from '@/core/ui/Ltr'
import ScreenGate from '@/core/ui/ScreenGate'
import { canEditDocTypeConfig, canViewDocTypeConfig, docTypeConfigAccessQuery } from './api'
import CopyDocumentSourceDialog from './CopyDocumentSourceDialog'
import {
  DOCUMENT_SOURCES_TABS,
  documentSourcesParams,
  documentSourcesViewFromParams,
  sameSource,
  type DocumentSourcesTab,
} from './document-source-edit'
import type { DocumentSourceSettings } from './document-source-types'
import { documentSourceHistoryQuery, documentSourcesQuery } from './document-sources-api'
import EditDocumentSourceDialog from './EditDocumentSourceDialog'
import HistoryTab from './HistoryTab'
import TabStrip from './TabStrip'

/**
 * Document sources — `/admin/document-sources[?source=CINB&tab=history]` (BackOffice spec 3148; ticket 3156). Every
 * source with its description and category (blank, or `C` — the call-centre channels every agent picks from). Picking
 * one shows it with a History tab. Edit (granted only) changes the description and the category; the code is locked and
 * there is no delete. Copy (granted only) creates a new code from the source, warning when the source code carries
 * behaviour tied to the code itself. The agents' own default sources are not maintained here. Behind the existing OMS
 * access, like the rest of the area.
 */
export default function DocumentSourcesPage() {
  const { t } = useTranslation('doc-type-config')
  return (
    <ScreenGate
      query={docTypeConfigAccessQuery()}
      can={canViewDocTypeConfig}
      ns="doc-type-config"
      title={t('documentSources.title')}
      subtitle={t('documentSources.subtitle')}
    >
      <DocumentSources />
    </ScreenGate>
  )
}

function DocumentSources() {
  const { t } = useTranslation('doc-type-config')
  const [params, setParams] = useSearchParams()
  const view = documentSourcesViewFromParams(params)
  const sources = useQuery(documentSourcesQuery())
  const access = useQuery(docTypeConfigAccessQuery())
  const canEdit = canEditDocTypeConfig(access.data)
  // The dialogs hold the source's CODE; the row they get is the live one from the list, so a re-read reaches them.
  const [editing, setEditing] = useState<DocumentSourceSettings | null>(null)
  const [copying, setCopying] = useState<DocumentSourceSettings | null>(null)
  const go = (source: string, tab: DocumentSourcesTab) => setParams(documentSourcesParams({ source, tab }), { replace: true })

  if (sources.isError) return <ErrorBanner className="p-3" message={apiErrorMessage(sources.error, t('documentSources.failed'))} />
  if (!sources.data) return <Loading text={t('documentSources.loading')} />

  // `view.source` is upper-cased; a mixed-case code still selects (the server matches codes case-blind).
  const selected = findSource(sources.data, view.source)
  const editingRow = editing && (findSource(sources.data, editing.documentSource) ?? editing)
  const copyingRow = copying && (findSource(sources.data, copying.documentSource) ?? copying)

  return (
    <div className="flex min-w-0 flex-col gap-3" data-document-sources="">
      <div className="overflow-x-auto rounded-md border border-border/60">
        <table className="w-full text-sm" data-document-sources-table="">
          <thead className="bg-muted/40 text-xs text-muted-foreground">
            <tr>
              <th className="px-2 py-1.5 text-start font-medium">{t('fields.documentSource')}</th>
              <th className="px-2 py-1.5 text-start font-medium">{t('fields.description')}</th>
              <th className="px-2 py-1.5 text-start font-medium">{t('fields.documentSourceCategory')}</th>
              {canEdit && <th className="px-2 py-1.5" />}
            </tr>
          </thead>
          <tbody>
            {sources.data.map((s) => (
              <tr
                key={s.documentSource}
                className={'border-t border-border/60 ' + (sameSource(s.documentSource, view.source) ? 'bg-primary/5' : '')}
                data-document-source={s.documentSource}
              >
                <td className="px-2 py-1 font-mono">
                  <button
                    type="button"
                    className="text-primary hover:underline"
                    onClick={() => go(s.documentSource, sameSource(s.documentSource, view.source) ? view.tab : 'source')}
                    data-document-source-open={s.documentSource}
                  >
                    <Ltr>{s.documentSource}</Ltr>
                  </button>
                </td>
                <td className="px-2 py-1">
                  <bdi>{s.description}</bdi>
                </td>
                <td className="px-2 py-1" data-document-source-category={s.documentSourceCategory}>
                  {t(`documentSources.categories.${s.documentSourceCategory || '_blank'}`, { defaultValue: s.documentSourceCategory })}
                </td>
                {canEdit && (
                  <td className="px-2 py-1 text-end whitespace-nowrap">
                    <Button variant="text" onClick={() => setEditing(s)} data-document-source-edit={s.documentSource}>
                      <Pencil className="h-3.5 w-3.5" aria-hidden />
                      {t('detail.edit')}
                    </Button>
                    <Button variant="text" onClick={() => setCopying(s)} data-document-source-copy={s.documentSource}>
                      <Copy className="h-3.5 w-3.5" aria-hidden />
                      {t('detail.copy')}
                    </Button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {view.source !== '' &&
        (selected === null ? (
          <p className="rounded-md border border-border/60 py-6 text-center text-sm text-muted-foreground" data-document-source-missing="">
            {t('documentSources.notFound')}
          </p>
        ) : (
          <section className="flex min-w-0 flex-col gap-2" data-document-source-detail={selected.documentSource}>
            <TabStrip
              tabs={DOCUMENT_SOURCES_TABS}
              open={view.tab}
              onSelect={(tab) => go(view.source, tab)}
              idPrefix="document-sources"
              label={t('documentSources.tabs.label')}
              tabLabel={(tab) => t(`documentSources.tabs.${tab}`)}
            >
              {view.tab === 'history' ? (
                <HistoryTab query={documentSourceHistoryQuery(selected.documentSource)} />
              ) : (
                <dl className="grid max-w-xl grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
                  <dt className="text-muted-foreground">{t('fields.documentSource')}</dt>
                  <dd className="font-mono">
                    <Ltr>{selected.documentSource}</Ltr>
                  </dd>
                  <dt className="text-muted-foreground">{t('fields.description')}</dt>
                  <dd>
                    <bdi>{selected.description}</bdi>
                  </dd>
                  <dt className="text-muted-foreground">{t('fields.documentSourceCategory')}</dt>
                  <dd>{t(`documentSources.categories.${selected.documentSourceCategory || '_blank'}`, { defaultValue: selected.documentSourceCategory })}</dd>
                </dl>
              )}
            </TabStrip>
          </section>
        ))}

      {canEdit && editingRow && <EditDocumentSourceDialog open loaded={editingRow} onClose={() => setEditing(null)} />}
      {canEdit && copyingRow && (
        <CopyDocumentSourceDialog
          open
          source={copyingRow}
          existingCodes={sources.data.map((s) => s.documentSource)}
          onClose={() => setCopying(null)}
          onCopied={(code) => go(code, 'source')}
        />
      )}
    </div>
  )
}

function findSource(rows: readonly DocumentSourceSettings[], code: string): DocumentSourceSettings | null {
  return rows.find((s) => sameSource(s.documentSource, code)) ?? null
}

function Loading({ text }: { text: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground" role="status">
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
      {text}
    </div>
  )
}
