import { useQuery } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import { ListOrdered } from 'lucide-react'

import { Loading } from '@/core/insurance-rules/parts'
import Button from '@/core/ui/Button'
import Field from '@/core/ui/Field'
import Ltr from '@/core/ui/Ltr'
import Select from '@/core/ui/Select'
import { useUrlQuery } from '@/core/ui/use-url-query'
import { fsi } from '@/core/util/bidi'
import { formatFigure } from '@/core/util/number-format'
import { entriesQuery, IDF_ENTRIES_KEY, versionsQuery } from './api'
import { entriesVersionId, masterItemsFromParams, masterItemsToParams, pickVersion } from './items'
import ItemsTable from './ItemsTable'
import { versionRows } from './versions'
import { idfMasterFilesApi } from './api' // 644
import DownloadButton from './DownloadButton' // 644
import { masterExportFileName } from './download' // 644

/** Where the version id sits in an entries query key (`[...IDF_ENTRIES_KEY, masterId, versionId, params]`). */
const VERSION_AT = IDF_ENTRIES_KEY.length + 1

/**
 * A master's **Items** (BackOffice spec 3185, door 3187; oms ticket 643), on the master's page under its header: the
 * live version's ranking, or any old version's picked from the Versions list (the same query, so one read feeds
 * both), clearly marked as not live. The address is the state: `?version` (absent = live), `?q`, `?idf`, `?page`.
 * A master never published has no items to show and says so.
 *
 * ⚠️ The master page's address is this section's (`useUrlQuery` writes the whole query string): a later section
 * that needs its own key extends `IdfMasterItemsQuery` rather than writing beside it.
 */
export default function ItemsSection({ masterId, liveVersionId }: { masterId: string; liveVersionId: string | null }) {
  const { t } = useTranslation('insurance-idf')
  const { query, update } = useUrlQuery(masterItemsFromParams, masterItemsToParams)
  const versions = useQuery(versionsQuery(masterId))
  const rows = versionRows(versions.data, liveVersionId)
  const versionId = entriesVersionId(query, liveVersionId)
  const shown = rows.find((v) => v.versionId === versionId)
  const notLive = versionId !== null && (shown ? !shown.live : versionId !== liveVersionId)
  const entries = useQuery({
    ...entriesQuery(masterId, versionId ?? '', query),
    enabled: versionId !== null,
    // A next page of the same version keeps the rows on screen; another version never shows the old one's.
    placeholderData: (prev, prevQuery) => (prevQuery?.queryKey[VERSION_AT] === versionId ? prev : undefined),
  })

  return (
    <div className="flex max-w-5xl flex-col gap-3 rounded-md border border-border/60 bg-card p-3" data-idf-items-section="" data-version-shown={versionId ?? ''}>
      <div className="flex items-center gap-2 text-sm font-medium">
        <ListOrdered className="h-4 w-4 text-muted-foreground" aria-hidden />
        {t('items.title')}
      </div>
      <p className="text-xs text-muted-foreground">{t('items.lede')}</p>
      {versionId === null ? (
        <p className="py-3 text-center text-sm text-muted-foreground" data-idf-items-no-live="">
          {t('items.noLive')}
        </p>
      ) : (
        <>
          <div className="flex flex-wrap items-end gap-3">
            {versions.data ? (
              <Field label={t('items.version')}>
                <Select value={versionId} data-idf-items-version="" onChange={(e) => update((q) => pickVersion(q, e.target.value, liveVersionId))}>
                  {rows.map((v) => (
                    <option key={v.versionId} value={v.versionId}>
                      {t(v.live ? 'items.versionOptionLive' : 'items.versionOption', { n: fsi(formatFigure(v.number)) })}
                    </option>
                  ))}
                  {/* An address naming a version the history does not hold still shows it as chosen. */}
                  {!shown && <option value={versionId}>{fsi(versionId)}</option>}
                </Select>
              </Field>
            ) : (
              !versions.isError && <Loading text={t('versions.loading')} />
            )}
            {notLive && liveVersionId && (
              <Button variant="secondary" data-idf-items-show-live="" onClick={() => update((q) => pickVersion(q, liveVersionId, liveVersionId))}>
                {t('items.showLive')}
              </Button>
            )}
            {/* 644 · Export the version on show */}
            <div className="ms-auto">
              <DownloadButton
                fetch={() => idfMasterFilesApi.export(masterId, versionId)}
                fallbackName={masterExportFileName(masterId, { versionId, number: shown?.number })}
                label={t('download.export')}
                failedLabel={t('download.exportFailed')}
                hook="data-idf-master-export"
              />
            </div>
          </div>
          {notLive && (
            <p className="rounded-md border border-attention-border bg-attention-050 p-2 text-sm text-attention-800" role="status" data-idf-items-not-live={versionId}>
              <Trans t={t} i18nKey="items.notLive" values={{ n: shown ? formatFigure(shown.number) : versionId }} components={{ v: <Ltr /> }} />
            </p>
          )}
          <ItemsTable
            page={entries.data}
            error={entries.isError ? entries.error : null}
            query={query}
            onQuery={(change) => update((q) => ({ ...q, ...change(q) }))}
            busy={entries.isFetching}
          />
        </>
      )}
    </div>
  )
}
