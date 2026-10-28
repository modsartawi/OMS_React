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
import { masterItemsFromParams, masterItemsToParams } from './items'
import { DRAFT_SHOWN, draftPage, itemsShown, pickShown, removedShown } from './draft' // 645
import { DraftMark, DraftRowActions } from './DraftPanel' // 645
import { useDraft } from './useDraft' // 645
import { draftEditable, draftPanelState } from './draft' // 646
import { useSession } from '@/core/session' // 646
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
 * 645: while a draft is open, the items are the DRAFT's by default (`?version` absent), each row marked against the
 * version it was copied from, removed rows listed after the last page, each row with Re-rank / Remove; the picker
 * names the draft first and every version after it (the live one included, by id).
 *
 * ⚠️ The master page's address is this section's (`useUrlQuery` writes the whole query string): a later section
 * that needs its own key extends `IdfMasterItemsQuery` rather than writing beside it.
 */
export default function ItemsSection({ masterId, liveVersionId }: { masterId: string; liveVersionId: string | null }) {
  const { t } = useTranslation('insurance-idf')
  const { query, update } = useUrlQuery(masterItemsFromParams, masterItemsToParams)
  const versions = useQuery(versionsQuery(masterId))
  const rows = versionRows(versions.data, liveVersionId)
  const { draft, diff } = useDraft(masterId) // 645
  const draftOpen = !!draft.data
  const userId = useSession((s) => s.userId) // 646
  const editable = draftEditable(draftPanelState(draft.data, userId)) // 646: only my own draft takes edits
  const showing = itemsShown(query, liveVersionId, draftOpen)
  const versionId = showing?.kind === 'version' ? showing.versionId : null
  const shown = rows.find((v) => v.versionId === versionId)
  const notLive = versionId !== null && (shown ? !shown.live : versionId !== liveVersionId)
  const draftShown = showing?.kind === 'draft' && draft.data ? draftPage(draft.data.rows, query) : undefined
  const entries = useQuery({
    ...entriesQuery(masterId, versionId ?? '', query),
    enabled: versionId !== null,
    // A next page of the same version keeps the rows on screen; another version never shows the old one's.
    placeholderData: (prev, prevQuery) => (prevQuery?.queryKey[VERSION_AT] === versionId ? prev : undefined),
  })

  return (
    <div className="flex max-w-5xl flex-col gap-3 rounded-md border border-border/60 bg-card p-3" data-idf-items-section="" data-version-shown={showing?.kind === 'draft' ? 'draft' : (versionId ?? '')}>
      <div className="flex items-center gap-2 text-sm font-medium">
        <ListOrdered className="h-4 w-4 text-muted-foreground" aria-hidden />
        {t('items.title')}
      </div>
      <p className="text-xs text-muted-foreground">{t('items.lede')}</p>
      {showing === null ? (
        <p className="py-3 text-center text-sm text-muted-foreground" data-idf-items-no-live="">
          {t('items.noLive')}
        </p>
      ) : (
        <>
          <div className="flex flex-wrap items-end gap-3">
            {versions.data ? (
              <Field label={t('items.version')}>
                <Select value={versionId ?? DRAFT_SHOWN} data-idf-items-version="" onChange={(e) => update((q) => pickShown(q, e.target.value, liveVersionId, draftOpen))}>
                  {draftOpen && <option value={DRAFT_SHOWN}>{t('draft.shown')}</option>}
                  {rows.map((v) => (
                    <option key={v.versionId} value={v.versionId}>
                      {t(v.live ? 'items.versionOptionLive' : 'items.versionOption', { n: fsi(formatFigure(v.number)) })}
                    </option>
                  ))}
                  {/* An address naming a version the history does not hold still shows it as chosen. */}
                  {versionId !== null && !shown && <option value={versionId}>{fsi(versionId)}</option>}
                </Select>
              </Field>
            ) : (
              !versions.isError && <Loading text={t('versions.loading')} />
            )}
            {notLive && liveVersionId && (
              <Button variant="secondary" data-idf-items-show-live="" onClick={() => update((q) => pickShown(q, liveVersionId, liveVersionId, draftOpen))}>
                {t('items.showLive')}
              </Button>
            )}
            {/* 644 · Export the version on show (645: none while the draft shows — no door exports a draft) */}
            {versionId !== null && (
              <div className="ms-auto">
                <DownloadButton
                  fetch={() => idfMasterFilesApi.export(masterId, versionId)}
                  fallbackName={masterExportFileName(masterId, { versionId, number: shown?.number })}
                  label={t('download.export')}
                  failedLabel={t('download.exportFailed')}
                  hook="data-idf-master-export"
                />
              </div>
            )}
          </div>
          {notLive && (
            <p className="rounded-md border border-attention-border bg-attention-050 p-2 text-sm text-attention-800" role="status" data-idf-items-not-live={versionId}>
              <Trans t={t} i18nKey="items.notLive" values={{ n: shown ? formatFigure(shown.number) : versionId }} components={{ v: <Ltr /> }} />
            </p>
          )}
          {showing.kind === 'draft' && draftShown ? (
            // 645 · the draft's rows, marked against its base version
            <ItemsTable
              page={draftShown}
              query={query}
              onQuery={(change) => update((q) => ({ ...q, ...change(q) }))}
              busy={draft.isFetching}
              // ItemsTable marks the removed rows through the same callback: a removed item is in no draft row.
              mark={(r) => <DraftMark mark={diff ? (diff.mark(r.itemNumber) ?? 'removed') : null} />}
              actions={editable ? (r) => <DraftRowActions masterId={masterId} row={r} /> : undefined}
              removed={diff ? removedShown(diff.removed, query, draftShown.total) : undefined}
            />
          ) : (
            <ItemsTable
              page={entries.data}
              error={entries.isError ? entries.error : null}
              query={query}
              onQuery={(change) => update((q) => ({ ...q, ...change(q) }))}
              busy={entries.isFetching}
            />
          )}
        </>
      )}
    </div>
  )
}
