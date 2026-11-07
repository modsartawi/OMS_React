import { useMemo, type ReactNode } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router'
import { Trans, useTranslation } from 'react-i18next'
import { ChartColumn, FileText, Folder, FolderInput, Inbox, LayoutDashboard, Plus, RotateCcw, SearchX } from 'lucide-react'
import { itemHref, NEW_BOARD_PATH, NEW_REPORT_PATH, NEW_VIEW_PATH } from '@/core/analytics-routes'
import { formatClock, formatDay } from '@/core/charts/format'
import i18n from '@/core/i18n'
import type { AnalyticsFolder, AnalyticsItem, AnalyticsLabel, AnalyticsModel } from '@/core/models/analytics'
import { useSession } from '@/core/session'
import Button from '@/core/ui/Button'
import { buttonClass } from '@/core/ui/control-classes'
import { useUrlQuery } from '@/core/ui/use-url-query'
import { localToday } from '@/core/util/date-window'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Input from '@/core/ui/Input'
import Ltr from '@/core/ui/Ltr'
import ScreenGate from '@/core/ui/ScreenGate'
import { formatPair, fsi } from '@/core/util/bidi'
import { useDebounced } from '@/core/util/use-debounced'
import { saysIn } from '@/core/rules/sentence'
import { analyticsAccessQuery, canAuthorAnalytics, canCurateAnalytics, canViewAnalytics } from './access'
import AnalyticsStatus from './AnalyticsStatus'
import AskBox from './AskBox'
import { ANALYTICS_MODEL_KEY, analyticsApi, analyticsItemsKey } from './api'
import { newViewLink } from './editor'
import { LIBRARY_DRAG_TYPE, libraryItems, libraryItemsQuery, type LibraryChoice, type LibraryFolder } from './library'
import { libraryPagePath, pageNarrows, pageQuery, pageShows, type LibraryPage } from './library-pages'
import LibraryChips from './LibraryChips'
import LibraryMenu from './LibraryMenu'
import LibraryRail from './LibraryRail'
import PinToggle from './PinToggle'
import { useFileItem, useLibraryFolders, useRestoreItem } from './use-library'
import AudienceChip from './AudienceChip'
import TierBadge from './TierBadge'
import { analyticsRefusal, dimensionOf, measureOf, refusalWords } from './wire'

/**
 * 839 (BackOffice spec 3437 §G): ONE library component behind every library leaf of the Analytics menu — Home
 * `/analytics`, My boards / views / reports, Shared with me, Certified and Recently deleted. Its `page` says which
 * (`./library-pages`): the route fixes who / kind / folder, the URL query carries only what the route leaves open,
 * and the chips and folder rail the route fixes are not shown. Home is still the whole library until 840 gives it
 * recent / pinned / newest certified; an old `?who=…&kind=…` link is redirected before this renders (the router's
 * loader, `libraryRedirect`). 840: Home is its own page (`./AnalyticsHomePage`); the whole library — the ask box,
 * every New, the status card — is All my items at `/analytics/library` (`page="library"`), linked from Home. Every
 * row has a pin toggle (`./PinToggle`).
 *
 * The analytics home at `/analytics` (spec 766 §F, user stories 3–6; ticket 770) — the menu leaf's
 * destination, behind `canViewAnalytics` like every analytics page.
 *
 * 837 (BackOffice 3432): a library. A folder rail at the start side (All items · Unfiled · my folders · New folder ·
 * Recently deleted, `./LibraryRail`), chips for who / kind / changed (`./LibraryChips`) and the title search all
 * narrow at once, client-side (`./library`), and the Items door is asked with the same params. The choice lives in
 * the URL. The list is ONE list, newest change first (the tier groups gave way to the who chips); each row keeps
 * its tier badge, owner and last change, drags onto a folder to file it, and has a "Move to folder" menu. Recently
 * deleted lists my deleted items with Restore. Before 3432 the folders door is a 404: the rail shows a note and
 * the chips and search still work. An item opens `/analytics/board/:id` or `/analytics/view/:id` by its kind.
 *
 * The toolbar row above the list (`data-analytics-home-header`) is the page's header slot: 782's ask box
 * joins the search there. Below it, curators see the analytics status card (785, `./AnalyticsStatus`).
 */
export default function AnalyticsLibraryPage({ page = 'library' }: { page?: Exclude<LibraryPage, 'home' | 'catalog'> }) {
  const { t } = useTranslation('boards')
  const title = t(`pages.${page}.title`)
  const subtitle = t(`pages.${page}.subtitle`)
  return (
    <ScreenGate query={analyticsAccessQuery()} can={canViewAnalytics} ns="boards" title={title} subtitle={subtitle}>
      <HomeBody page={page} />
    </ScreenGate>
  )
}

/** The title an untitled view is shown (and found) by, in both languages: "<measure> by <dimension>". */
function generatedTitle(item: AnalyticsItem, model: AnalyticsModel | undefined): AnalyticsLabel {
  const q = item.definition.query
  const m = measureOf(model, q.measures[0])
  const d = dimensionOf(model, q.dimensions[0])
  if (item.kind !== 'view' || !m || !d) return { en: '', ar: '' }
  const say = (lng: 'en' | 'ar') =>
    i18n.getFixedT(lng, 'boards')('view.generatedTitle', { measure: saysIn(m.label, lng), dimension: saysIn(d.label, lng) })
  return { en: say('en'), ar: say('ar') }
}

const SEARCH_DEBOUNCE_MS = 300

function HomeBody({ page }: { page: LibraryPage }) {
  const { t } = useTranslation('boards')
  const navigate = useNavigate()
  // 837: the library's choice (folder, chips, search) lives in the URL, so a refresh or Back keeps it. 839: what
  // the page's route fixes is laid over it.
  const { fromParams, toParams } = pageQuery(page)
  const { query: choice, update } = useUrlQuery(fromParams, toParams)
  const shows = pageShows(page)
  const narrows = (c: LibraryChoice) => pageNarrows(page, c)
  // 839: Recently deleted is its own leaf — the rail's entry goes there, carrying this page's kind.
  const pickFolder = (f: LibraryFolder) =>
    f === 'deleted' && page !== 'library' ? navigate(`${libraryPagePath('deleted')}?kind=${choice.kind}`) : update((c) => ({ ...c, folder: f }))
  const search = choice.search
  const me = useSession((s) => s.userId) ?? ''
  const today = localToday()
  const library = useLibraryFolders()
  // A folder the server does not have (or no folders at all, before 3432) reads as All items.
  const known = (f: LibraryFolder) => f === 'all' || f === 'none' || f === 'deleted' || library.folders.some((x) => x.id === f)
  const folder: LibraryFolder = library.available ? (known(choice.folder) ? choice.folder : 'all') : library.loading ? choice.folder : 'all'
  const shown: LibraryChoice = useMemo(() => ({ ...choice, folder }), [choice, folder])
  // The server is asked to narrow by the same choice once typing stops; the list on screen narrows at once,
  // client-side, over what came back (and the same if the server ignores the params).
  const asked = libraryItemsQuery({ ...shown, search: useDebounced(search, SEARCH_DEBOUNCE_MS) }, today)
  const items = useQuery({ queryKey: analyticsItemsKey(asked), queryFn: () => analyticsApi.items(asked), placeholderData: keepPreviousData, retry: false })
  const fileItem = useFileItem()
  const restore = useRestoreItem()
  // Only to name untitled views; the list never waits on it.
  const model = useQuery({ queryKey: ANALYTICS_MODEL_KEY, queryFn: () => analyticsApi.model(), staleTime: 5 * 60_000, retry: false })
  // 785: curators see how Cube and the dbt runs are going (the probe is the gate's own cached entry).
  const access = useQuery(analyticsAccessQuery())
  const curator = canCurateAnalytics(access.data)
  // 822: a runner builds nothing — no "New view", "New board" or (828) "New report".
  const author = canAuthorAnalytics(access.data)

  const fallback = useMemo(() => {
    const m = model.data
    return (it: AnalyticsItem) => generatedTitle(it, m)
  }, [model.data])
  // 837: one list, newest change first — the who chips now say what the tier groups used to.
  const list = useMemo(() => libraryItems(items.data ?? [], shown, me, today, fallback), [items.data, shown, me, today, fallback])
  const titleOf = (it: AnalyticsItem) => saysIn(it.title, i18n.language) || saysIn(fallback(it), i18n.language)
  const fileInto = (itemId: string, into: AnalyticsFolder | null) => {
    const item = items.data?.find((x) => x.id === itemId)
    if (!item || (item.folderId ?? null) === (into?.id ?? null)) return
    fileItem.mutate({ item, folderId: into?.id ?? null, folderName: into?.name })
  }

  let body: ReactNode
  if (items.error) {
    const refusal = analyticsRefusal(items.error, t('home.loadFailed'))
    body = <ErrorBanner title={t('home.loadFailed')} message={refusalWords(refusal, t)} />
  } else if (!items.data) {
    body = (
      <div className="text-sm text-muted-foreground" role="status">
        {t('home.loading')}
      </div>
    )
  } else if (page !== 'library' && page !== 'deleted' && folder === 'all' && items.data.length === 0 && !narrows(choice) && !asked.search) {
    body = (
      <div className="rounded-lg border border-border/60 bg-card p-6 text-sm text-muted-foreground" data-analytics-page-empty={page}>
        {t(`pages.${page}.empty`)}
      </div>
    )
  } else if (page === 'library' && folder === 'all' && items.data.length === 0 && !narrows(choice) && !asked.search) {
    body = (
      <div className="rounded-lg border border-border/60 bg-card p-6 text-sm" data-analytics-home-empty>
        <p className="font-medium">{t('home.emptyTitle')}</p>
        <p className="mt-1 text-muted-foreground">{t('home.empty')}</p>
      </div>
    )
  } else if (list.length === 0) {
    const onlySearch = !!search.trim() && !narrows({ ...shown, search: '' })
    const words =
      folder === 'deleted' && !narrows(shown)
        ? t('home.library.deletedEmpty')
        : onlySearch && folder === 'all'
          ? t('home.noMatch', { search: fsi(search.trim()) })
          : !narrows(shown) && folder === 'none'
            ? t('home.library.emptyUnfiled')
            : !narrows(shown) && folder !== 'all' && folder !== 'deleted'
              ? t('home.library.emptyFolder')
              : t('home.library.noMatch')
    body = (
      <p className="flex items-center gap-2 rounded-lg border border-border/60 bg-card p-6 text-sm text-muted-foreground" data-analytics-home-no-match>
        <SearchX className="size-4" aria-hidden />
        {words}
      </p>
    )
  } else if (folder === 'deleted') {
    body = (
      <ul className="flex flex-col divide-y divide-border/60 rounded-lg border border-border/60 bg-card" data-analytics-library-deleted>
        {list.map((it) => (
          <DeletedRow key={it.id} item={it} title={titleOf(it)} pending={restore.isPending && restore.variables === it.id} onRestore={() => restore.mutate(it.id)} />
        ))}
      </ul>
    )
  } else {
    body = (
      <ul className="flex flex-col divide-y divide-border/60 rounded-lg border border-border/60 bg-card" data-analytics-library-list={folder}>
        {list.map((it) => (
          <HomeRow key={it.id} item={it} title={titleOf(it)} folders={library.available ? library.folders : null} onFile={(into) => fileInto(it.id, into)} />
        ))}
      </ul>
    )
  }

  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-start">
      {shows.rail && <LibraryRail folders={library.folders} available={library.available} current={folder} onPick={pickFolder} onDropItem={fileInto} />}
      <div className="flex min-w-0 flex-1 flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3" data-analytics-home-header>
          <Input
            type="search"
            value={search}
            onChange={(e) => {
              const next = e.target.value
              update((c) => ({ ...c, search: next }))
            }}
            placeholder={t('home.searchPlaceholder')}
            aria-label={t('home.searchLabel')}
            wrapperClassName="w-80 max-w-full"
            data-analytics-home-search
          />
          {page === 'library' && <AskBox />}
          {/* 822: a runner builds nothing. 839: Home offers every New; a My page its own kind's. */}
          {author && page !== 'library' && NEW_LINK[page] && (
            <Link to={NEW_LINK[page].to} className={buttonClass('secondary')} data-analytics-new={page}>
              <Plus className="size-4" aria-hidden />
              {t(NEW_LINK[page].labelKey)}
            </Link>
          )}
          {author && page === 'library' && (
            <>
              {/* 775: build a view from the model. */}
              <Link to={newViewLink().to} className={buttonClass('secondary')} data-analytics-new-view>
                <Plus className="size-4" aria-hidden />
                {t('editor.newView')}
              </Link>
              {/* 777: lay out a new board. */}
              <Link to={NEW_BOARD_PATH} className={buttonClass('secondary')} data-analytics-new-board>
                <LayoutDashboard className="size-4" aria-hidden />
                {t('boardEditor.newBoard')}
              </Link>
              {/* 828: design a new report. */}
              <Link to={NEW_REPORT_PATH} className={buttonClass('secondary')} data-analytics-new-report>
                <FileText className="size-4" aria-hidden />
                {t('designer.newReport')}
              </Link>
            </>
          )}
        </div>
        <LibraryChips choice={choice} onChange={update} shows={shows} narrows={narrows} />
        {curator && page === 'library' && <AnalyticsStatus />}
        {folder === 'deleted' && <p className="text-xs text-muted-foreground">{t('home.library.deletedNote')}</p>}
        {body}
      </div>
    </div>
  )
}

/** 839: a My page's one New button. */
const NEW_LINK: Partial<Record<LibraryPage, { to: string; labelKey: string }>> = {
  boards: { to: NEW_BOARD_PATH, labelKey: 'boardEditor.newBoard' },
  views: { to: NEW_VIEW_PATH, labelKey: 'editor.newView' },
  reports: { to: NEW_REPORT_PATH, labelKey: 'designer.newReport' },
}

const kindIcon = (kind: AnalyticsItem['kind']) => (kind === 'board' ? LayoutDashboard : kind === 'report' ? FileText : ChartColumn)

/**
 * One library row. 837: with my folders (`folders`, null before 3432) it is draggable onto a rail folder, and its
 * "Move to folder" menu files it without a mouse.
 */
function HomeRow({
  item,
  title,
  folders,
  onFile,
}: {
  item: AnalyticsItem
  title: string
  folders: readonly AnalyticsFolder[] | null
  onFile: (into: AnalyticsFolder | null) => void
}) {
  const { t } = useTranslation('boards')
  const lang = i18n.language
  const KindIcon = kindIcon(item.kind)
  const changed = formatPair(formatDay(item.updatedAt, lang), formatClock(item.updatedAt, lang))
  const at = item.folderId ?? null
  return (
    <li
      data-analytics-item={item.id}
      data-analytics-item-folder={at ?? ''}
      className="flex items-center gap-1 pe-2"
      draggable={!!folders}
      onDragStart={(e) => {
        if (!folders) return
        e.dataTransfer.setData(LIBRARY_DRAG_TYPE, item.id)
        e.dataTransfer.effectAllowed = 'move'
      }}
    >
      <Link
        to={itemHref(item.kind, item.id)}
        draggable={false}
        className="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 hover:bg-muted/50 focus-visible:bg-muted/50"
      >
        <KindIcon className="size-4 shrink-0 text-muted-foreground" aria-label={t(`home.kind.${item.kind}`)} />
        <span className="min-w-0 flex-1 truncate text-sm font-medium" data-analytics-item-title>
          <bdi>{title || t('home.untitled')}</bdi>
        </span>
        <span data-analytics-item-tier={item.tier}>
          <TierBadge tier={item.tier} />
        </span>
        {/* 826: who a Shared item is shared with. */}
        <AudienceChip item={item} />
        <span className="text-xs text-muted-foreground" data-analytics-item-owner>
          <Trans t={t} i18nKey="home.owner" values={{ owner: item.owner }} components={{ owner: <bdi /> }} />
        </span>
        {changed && (
          <span className="text-xs text-muted-foreground" data-analytics-item-changed>
            <Trans t={t} i18nKey="home.changed" values={{ at: changed }} components={{ at: <Ltr /> }} />
          </span>
        )}
      </Link>
      {/* 840: outside the link, so pinning does not open the item. */}
      <PinToggle item={item} title={title} />
      {folders && (
        <LibraryMenu
          label={t('home.library.move.itemLabel', { title: fsi(title || t('home.untitled')) })}
          icon={FolderInput}
          data={`move:${item.id}`}
          items={[
            { key: 'none', label: t('home.library.move.unfiled'), icon: Inbox, current: at === null, onSelect: () => onFile(null) },
            ...folders.map((f) => ({ key: f.id, label: <bdi>{f.name}</bdi>, icon: Folder, current: at === f.id, onSelect: () => onFile(f) })),
          ]}
        />
      )}
    </li>
  )
}

/** 837: a Recently deleted row — not a link (a deleted item does not open); Restore puts it back (3432 §3). */
function DeletedRow({ item, title, pending, onRestore }: { item: AnalyticsItem; title: string; pending: boolean; onRestore: () => void }) {
  const { t } = useTranslation('boards')
  const lang = i18n.language
  const KindIcon = kindIcon(item.kind)
  const deleted = item.deletedAt ? formatPair(formatDay(item.deletedAt, lang), formatClock(item.deletedAt, lang)) : ''
  const name = title || t('home.untitled')
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3" data-analytics-deleted-item={item.id}>
      <KindIcon className="size-4 shrink-0 text-muted-foreground" aria-label={t(`home.kind.${item.kind}`)} />
      <span className="min-w-0 flex-1 truncate text-sm font-medium">
        <bdi>{name}</bdi>
      </span>
      <TierBadge tier={item.tier} />
      {deleted && (
        <span className="text-xs text-muted-foreground" data-analytics-item-deleted-at>
          <Trans t={t} i18nKey="home.library.deletedAt" values={{ at: deleted }} components={{ at: <Ltr /> }} />
        </span>
      )}
      <Button variant="secondary" disabled={pending} onClick={onRestore} aria-label={t('home.library.restoreLabel', { title: fsi(name) })} data-analytics-restore={item.id}>
        <RotateCcw className="size-3.5" aria-hidden />
        {t('home.library.restore')}
      </Button>
    </li>
  )
}
