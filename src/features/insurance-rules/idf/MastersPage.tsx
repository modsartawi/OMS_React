import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import { Link } from 'react-router'

import { apiErrorMessage, isBareDenial } from '@/core/api'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Ltr from '@/core/ui/Ltr'
import { formatFigure } from '@/core/util/number-format'
import Button from '@/core/ui/Button'
import { fsi } from '@/core/util/bidi'
import { ByAt, DeniedCard, Loading, NUM, TD, TH } from '@/core/insurance-rules/parts'
import { mastersQuery, storeListsQuery } from './api'
import { masterRow, type IdfMaster, type IdfMasterRow } from './masters'
import MasterFormDialog from './MasterFormDialog' // 621
import { storeListName } from './store-lists'

/**
 * Insurance rules ▸ IDF masters — `/insurance-rules/idf/masters` (BackOffice spec 3157, door 3161; oms ticket 619).
 * Every IDF priority master: kind (insurer with its customer id, store with its store list, or an insurer master scoped
 * to a store list showing both), the name in the reader's language, "hard above N, reminder above M", and the live
 * version (number, by, at, note) — or that there is none yet.
 *
 * The IDF screens are one feature folder (`features/insurance-rules/idf/`), each leaf in its own page file
 * (`StoreListsPage` 620, `MasterPage` 622/623, `ExceptionsPage` 624, `LookupPage` 625, `EventsPage` 626/627);
 * 621's create / edit opens from this list.
 *
 * 🚩 UNGATED until 628: a bare 403 on the read is "You do not have access".
 */
export default function MastersPage() {
  const { t, i18n } = useTranslation('insurance-idf')
  const masters = useQuery(mastersQuery())
  // 621 · the dialog: `null` closed, `'new'` create, a master edit
  const [editing, setEditing] = useState<IdfMaster | 'new' | null>(null)
  return (
    <section className="flex h-full w-full flex-col gap-4" data-idf-masters-page="">
      <header className="max-w-3xl">
        <h1 className="text-lg font-semibold tracking-tight">{t('masters.title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('masters.lede')}</p>
      </header>
      {/* 621 · the New master action and the row's Edit open here */}
      {masters.data && (
        <div>
          <Button variant="primary" onClick={() => setEditing('new')} data-idf-master-new="">
            {t('masterForm.newAction')}
          </Button>
        </div>
      )}
      {editing && masters.data && (
        <MasterFormDialog master={editing === 'new' ? null : editing} masters={masters.data} onClose={() => setEditing(null)} />
      )}
      {masters.isError && isBareDenial(masters.error) ? (
        <DeniedCard ns="insurance-idf" hook="idf-masters-denied" />
      ) : masters.isError ? (
        <ErrorBanner className="p-3" message={apiErrorMessage(masters.error, t('masters.failed'))} />
      ) : !masters.data ? (
        <Loading text={t('masters.loading')} />
      ) : masters.data.length === 0 ? (
        <p className="rounded-md border border-border/60 py-6 text-center text-sm text-muted-foreground" data-idf-masters-empty="">
          {t('masters.empty')}
        </p>
      ) : (
        <MastersTable masters={masters.data} lang={i18n.language} onEdit={setEditing} />
      )}
    </section>
  )
}

function MastersTable({ masters, lang, onEdit }: { masters: IdfMaster[]; lang: string; onEdit: (m: IdfMaster) => void }) {
  const { t } = useTranslation('insurance-idf')
  const rows: IdfMasterRow[] = masters.map((m) => masterRow(m, lang))
  // 621 · the store list's name where 620's lists know it, else its id
  const lists = useQuery(storeListsQuery())
  const listName = (id: string) => {
    const l = lists.data?.find((x) => x.storeListId === id)
    return l ? storeListName(l, lang) : null
  }
  return (
    <div className="overflow-x-auto rounded-md border border-border/60">
      <table className="w-full text-sm" data-idf-masters="">
        <thead className="bg-muted/50">
          <tr>
            <th className={TH}>{t('masters.columns.name')}</th>
            <th className={TH}>{t('masters.columns.kind')}</th>
            <th className={TH}>{t('masters.columns.payer')}</th>
            <th className={TH}>{t('masters.columns.storeList')}</th>
            <th className={TH}>{t('masters.columns.thresholds')}</th>
            <th className={`${TH} text-end`}>{t('masters.columns.version')}</th>
            <th className={TH}>{t('masters.columns.published')}</th>
            <th className={TH}>{t('masters.columns.note')}</th>
            <th className={TH}>
              <span className="sr-only">{t('masterForm.columnActions')}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.masterId} className="border-t border-border/60" data-master={r.masterId} data-kind={r.kind}>
              <td className={`${TD} font-medium`} data-col="name">
                {/* 622 · the name opens the master's page */}
                <Link to={`/insurance-rules/idf/masters/${encodeURIComponent(r.masterId)}`} className="hover:underline" data-idf-open-master="">
                  <bdi>{r.name}</bdi>
                </Link>
              </td>
              <td className={TD} data-col="kind">
                {t(`masters.kind.${r.kind}`, { defaultValue: r.kind })}
              </td>
              <td className={TD} data-col="payer">
                {r.insurerCustomerId && <Ltr>{r.insurerCustomerId}</Ltr>}
              </td>
              <td className={TD} data-col="storeList">
                {r.storeListId && (listName(r.storeListId) ? <bdi data-store-list-id={r.storeListId}>{listName(r.storeListId)}</bdi> : <Ltr>{r.storeListId}</Ltr>)}
              </td>
              <td className={TD} data-col="thresholds">
                <Trans t={t} i18nKey="masters.thresholds" values={{ hard: formatFigure(r.hard), reminder: formatFigure(r.reminder) }} components={{ v: <Ltr /> }} />
              </td>
              {r.live ? (
                <>
                  <td className={NUM} data-col="version">
                    <Ltr>{formatFigure(r.live.number)}</Ltr>
                  </td>
                  <td className={`${TD} text-xs`} data-col="published">
                    <ByAt by={r.live.by} at={r.live.at} />
                  </td>
                  <td className={`${TD} text-xs`} data-col="note">
                    {r.live.note && <bdi>{r.live.note}</bdi>}
                  </td>
                </>
              ) : (
                <td className={`${TD} text-xs text-muted-foreground`} colSpan={3} data-col="noLive">
                  {t('masters.noLive')}
                </td>
              )}
              <td className={`${TD} text-end`} data-col="actions">
                <Button variant="text" onClick={() => onEdit(masters[i])} aria-label={t('masterForm.editLabel', { name: fsi(r.name) })} data-idf-master-edit={r.masterId}>
                  {t('masterForm.edit')}
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
