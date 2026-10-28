import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { ListOrdered } from 'lucide-react'

import Chip from '@/core/ui/Chip'
import Ltr from '@/core/ui/Ltr'
import { useUrlQuery } from '@/core/ui/use-url-query'
import { formatFigure } from '@/core/util/number-format'
import { generalItemsQuery } from './api'
import { generalFromParams, generalToParams, IDF_GENERAL_TABS, switchGeneralTab, type IdfGeneralQuery } from './general'
import ItemsTable from './ItemsTable' // 643's table, shared
// 648 · imports (GeneralItemDialog, the Clear modal)
// 649 · imports (GeneralUpload)
import ChangeLog from './ChangeLog' // 650
// 651 · imports (the download buttons)

/** The general master's tier in the resolution order (insurer at a store list → insurer → store → general). */
const GENERAL_TIER = 4

/**
 * Insurance rules ▸ IDF masters ▸ General — `/insurance-rules/idf/general` (BackOffice spec 3185, door 3191; oms
 * ticket 647). The general master (tier 4) has no versions, thresholds or uploads-to-publish: the page names its
 * tier, says the WPF IDF screens still write it unchecked, and lists its items with 643's `ItemsTable` (item,
 * description, IDF group, priority; search, group filter, paging).
 *
 * The address is `general.ts`'s: `?tab` (Items, the default, leaves it out) and the tab on show's own keys — Items
 * `?q&idf&page`. 650's Change log tab keeps its keys in the same address under `?tab=changes`.
 *
 * 🧭 Slots for the tickets that build on this page — each writes only in its own:
 *   648 · Set item (the action row) + a row's Edit / Clear (`ItemsTable`'s `actions`, in `GeneralItems`)
 *   649 · Upload (its block under the action row)
 *   650 · Change log tab (`IDF_GENERAL_TABS` in `general.ts`, its panel below the tabs)
 *   651 · Export / Template (the action row)
 *
 * 🚩 UNGATED until 654 (`canEditGeneral`): a bare 403 on the items is "You do not have access".
 */
export default function GeneralPage() {
  const { t } = useTranslation('insurance-idf')
  const { query, update } = useUrlQuery(generalFromParams, generalToParams)
  return (
    <section className="flex h-full w-full flex-col gap-4" data-idf-general-page="">
      <Link to="/insurance-rules/idf/masters" className="text-xs text-muted-foreground hover:text-foreground" data-idf-back="">
        {t('upload.back')}
      </Link>
      <header className="flex max-w-3xl flex-col gap-1" data-idf-general="">
        <h1 className="text-lg font-semibold tracking-tight">{t('general.title')}</h1>
        <p className="text-sm" data-idf-general-tier="">
          <Trans t={t} i18nKey="general.tier" values={{ n: formatFigure(GENERAL_TIER) }} components={{ v: <Ltr /> }} />
        </p>
        <p className="rounded-md border border-attention-border bg-attention-050 p-2 text-sm text-attention-800" data-idf-general-help="">
          {t('general.help')}
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-2" data-idf-general-actions="">
        {/* 648 · Set item */}
        {/* 651 · Export / Template */}
      </div>

      {/* 649 · Upload */}

      <div className="flex gap-1" role="tablist" aria-label={t('general.tabs.label')} data-idf-general-tabs="">
        {IDF_GENERAL_TABS.map((id) => (
          <Chip key={id} variant="tab" on={query.tab === id} data-tab={id} onClick={() => update((q) => switchGeneralTab(q, id))}>
            {t(`general.tabs.${id}`)}
          </Chip>
        ))}
      </div>

      {query.tab === 'items' && <GeneralItems query={query} update={update} />}
      {/* 650 · Change log tab */}
      {query.tab === 'changes' && <ChangeLog query={query.changes} onQuery={(change) => update((q) => ({ ...q, changes: change(q.changes) }))} />}
    </section>
  )
}

/** The Items tab: the general master's items, a page at a time, through 643's table. */
function GeneralItems({ query, update }: { query: IdfGeneralQuery; update: (change: (q: IdfGeneralQuery) => IdfGeneralQuery) => void }) {
  const { t } = useTranslation('insurance-idf')
  const items = useQuery({ ...generalItemsQuery(query.items), placeholderData: keepPreviousData })
  return (
    <div className="flex max-w-5xl flex-col gap-3 rounded-md border border-border/60 bg-card p-3" role="tabpanel" data-idf-general-items="">
      <div className="flex items-center gap-2 text-sm font-medium">
        <ListOrdered className="h-4 w-4 text-muted-foreground" aria-hidden />
        {t('general.tabs.items')}
      </div>
      <p className="text-xs text-muted-foreground">{t('general.itemsLede')}</p>
      {/* 648 · Edit / Clear on each row: pass `actions={(row) => …}` to ItemsTable below */}
      <ItemsTable
        page={items.data}
        error={items.isError ? items.error : null}
        query={query.items}
        onQuery={(change) => update((q) => ({ ...q, items: change(q.items) }))}
        busy={items.isFetching}
        empty={t('general.empty')}
      />
    </div>
  )
}
