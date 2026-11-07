import { useMemo, useState } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { Info } from 'lucide-react'
import i18n from '@/core/i18n'
import Input from '@/core/ui/Input'
import Ltr from '@/core/ui/Ltr'
import ScreenGate from '@/core/ui/ScreenGate'
import { analyticsAccessQuery, canViewAnalytics } from './access'
import { ANALYTICS_CATALOG_KEY, analyticsApi } from './api'
import { searchCatalog } from './catalog-search'
import { buildCatalogTree, type CatalogNode } from './catalog-tree'
import CatalogDetail from './CatalogDetail'
import CatalogTree from './CatalogTree'
import Refused from './Refused'

/**
 * The Catalog leaf at `/analytics/catalog` (ticket 841, BackOffice spec 3437 §G): `GET Analytics/Catalog` as a tree
 * on the start side — areas, then Measures / Dimensions / Marts, then each mart's source tables — and the picked
 * node's detail beside it. A search over names in both languages opens the matches. Metadata only: nothing here
 * queries figures.
 */
export default function AnalyticsCatalogPage() {
  const { t } = useTranslation('boards')
  return (
    <ScreenGate query={analyticsAccessQuery()} can={canViewAnalytics} ns="boards" title={t('pages.catalog.title')} subtitle={t('pages.catalog.subtitle')}>
      <CatalogBody />
    </ScreenGate>
  )
}

function CatalogBody() {
  const { t } = useTranslation('boards')
  const lang = i18n.language
  const catalog = useQuery({ queryKey: ANALYTICS_CATALOG_KEY, queryFn: () => analyticsApi.catalog(), staleTime: 60_000, retry: false })
  const tree = useMemo(() => (catalog.data ? buildCatalogTree(catalog.data) : null), [catalog.data])
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState<Set<string>>(() => new Set())
  const [picked, setPicked] = useState<string | null>(null)
  const found = useMemo(() => (tree ? searchCatalog(tree, search) : null), [tree, search])

  if (catalog.isPending)
    return (
      <p className="text-sm text-muted-foreground" data-catalog-loading>
        {t('catalog.loading')}
      </p>
    )
  if (catalog.isError || !tree || !found) return <Refused err={catalog.error} fallbackKey="catalog.loadFailed" />

  const onSearch = (value: string) => {
    setSearch(value)
    // The search opens each match's ancestors; they stay open (and closable) after the search is cleared.
    const opens = searchCatalog(tree, value).open
    if (opens.size) setOpen((prev) => new Set([...prev, ...opens]))
  }
  const toggle = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  const select = (n: CatalogNode) => {
    setPicked(n.id)
    if (n.children.length && !open.has(n.id)) toggle(n.id)
  }
  const node = (picked && tree.byId.get(picked)) || tree.roots[0] || null

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3" data-analytics-catalog data-catalog-lineage={tree.lineageAvailable ? 'available' : 'unavailable'}>
      <div className="flex flex-wrap items-center gap-3">
        <Input
          type="search"
          value={search}
          placeholder={t('catalog.searchPlaceholder')}
          aria-label={t('catalog.searchLabel')}
          onChange={(e) => onSearch(e.target.value)}
          wrapperClassName="w-full max-w-md"
          data-catalog-search
        />
        {tree.lineageAvailable && tree.imageVersion && (
          <span className="text-xs text-muted-foreground" data-catalog-image-version>
            <Trans t={t} i18nKey="catalog.imageVersion" components={{ v: <Ltr /> }} values={{ version: tree.imageVersion }} />
          </span>
        )}
      </div>
      {!tree.lineageAvailable && (
        <p className="flex items-start gap-2 rounded-lg border border-border/60 bg-muted/40 p-3 text-sm text-muted-foreground" role="note" data-catalog-lineage-unavailable>
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            <span className="font-medium text-foreground">{t('catalog.lineageNote')}</span> {t('catalog.lineageHint')}
          </span>
        </p>
      )}
      {tree.roots.length === 0 ? (
        <p className="text-sm text-muted-foreground" data-catalog-empty>
          {t('catalog.empty')}
        </p>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-4 md:flex-row">
          <nav className="max-h-[70vh] overflow-y-auto rounded-lg border border-border/60 bg-card p-2 md:w-80 md:shrink-0" aria-label={t('catalog.treeLabel')}>
            {found.shown && found.matches.size === 0 ? (
              <p className="px-2 py-1 text-sm text-muted-foreground" data-catalog-no-match>
                {t('catalog.noMatch')}
              </p>
            ) : (
              <CatalogTree
                nodes={tree.roots}
                isOpen={(id) => open.has(id)}
                shown={found.shown}
                matches={found.matches}
                selected={node?.id ?? null}
                onToggle={toggle}
                onSelect={select}
                lang={lang}
              />
            )}
          </nav>
          <section className="min-w-0 flex-1 rounded-lg border border-border/60 bg-card p-4" aria-live="polite">
            <CatalogDetail node={node} />
          </section>
        </div>
      )}
    </div>
  )
}
