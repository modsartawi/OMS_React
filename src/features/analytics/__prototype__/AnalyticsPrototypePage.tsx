/* PROTOTYPE — throwaway. Wayfinder ticket 747 (map 741): "Do users explore inside oms-react or
 * inside the BI tool?" — the owner's ask: inside the OMS, one login, looks native.
 *
 * Route: /prototype/analytics?variant=board|explore|ask&scenario=en|ar
 *
 * Metabase (open source, local, port 3000) rendered through the official React SDK INSIDE the real
 * AppShell, themed from the DMSCO tokens. ⚠ Auth here is Metabase's documented LOCALHOST
 * EVALUATION MODE (an API key, admin group) — legal without a licence on localhost only. The
 * production shape it stands in for: SIS.Api signs a JWT for the oms-react user (JWT SSO, Pro).
 * Data is SYNTHETIC SQLite (C:\Playground\mb-proto\demo-analytics.db), never the replica.
 * Copy is literal (throwaway branch); raw fetch in ./ask is a prototype exception to api-envelope.
 */
import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import {
  CollectionBrowser,
  defineMetabaseAuthConfig,
  defineMetabaseTheme,
  InteractiveDashboard,
  InteractiveQuestion,
  MetabaseProvider,
} from '@metabase/embedding-sdk-react'
import { Activity, BarChart3, Compass, LayoutDashboard, LayoutGrid, Layers, Plus, SlidersHorizontal, Sparkles } from 'lucide-react'
import Button from '@/core/ui/Button'
import PrototypeSwitcher from '@/core/ui/PrototypeSwitcher'
import AskVariant from './AskVariant'
import LinkedBoardVariant from './LinkedBoardVariant'
import NativeVariant from './NativeVariant'
import RechartsBoardVariant from './RechartsBoardVariant'
import SupersetVariant from './SupersetVariant'

const env = import.meta.env
const authConfig = defineMetabaseAuthConfig({ metabaseInstanceUrl: env.VITE_MB_URL, apiKey: env.VITE_MB_API_KEY })
const DASHBOARD_ID = Number(env.VITE_MB_DASHBOARD_ID)
const COLLECTION_ID = Number(env.VITE_MB_COLLECTION_ID)

const VARIANTS = [
  { key: 'board', name: 'HQ board — the executive dashboard, drill-through (embedded Metabase)' },
  { key: 'explore', name: 'Explorer — browse, build, save, re-run views (embedded Metabase)' },
  { key: 'ask', name: 'Ask — a question becomes a saved view (embedded Metabase)' },
  { key: 'native', name: 'Build (native) — our own builder + charts over the free OSS engine' },
  { key: 'linked', name: 'Linked board (native) — cross-filtered panels, click a store to focus all' },
  { key: 'superset', name: 'Superset board — embedded Apache Superset, free embedding (754)' },
  { key: 'recharts', name: 'Recharts board (native) — every panel a stock Recharts 3 chart, no hand-drawn components' },
]
const SCENARIOS = [
  { key: 'en', label: 'English, LTR', proves: 'the DMSCO theme carries into every chart, table and menu' },
  { key: 'ar', label: 'Arabic, RTL', proves: "Metabase's own Arabic UI inside our shell — is it good enough for HQ?" },
]

/** Reads the live DMSCO tokens so the embed follows the app's light/dark theme. */
function useDmscoTheme() {
  return useMemo(() => {
    const css = getComputedStyle(document.documentElement)
    const v = (n: string) => css.getPropertyValue(n).trim()
    return defineMetabaseTheme({
      fontFamily: 'Roboto',
      fontSize: '13px',
      colors: {
        brand: v('--primary'),
        'brand-hover': v('--primary-050'),
        'brand-hover-light': v('--primary-050'),
        'text-primary': v('--foreground'),
        'text-secondary': v('--muted-foreground'),
        'text-tertiary': v('--ink-3'),
        background: v('--card'),
        'background-secondary': v('--card-2'),
        'background-hover': v('--accent'),
        'background-disabled': v('--muted'),
        border: v('--border'),
        filter: v('--post'),
        summarize: v('--success'),
        positive: v('--success'),
        negative: v('--danger'),
        shadow: 'rgb(16 24 40 / 0.12)',
        charts: [v('--primary'), v('--gold'), v('--success'), v('--post'), v('--prescription'), v('--attention'), v('--danger'), v('--ink-3')],
      },
      components: {
        dashboard: { backgroundColor: v('--background'), card: { backgroundColor: v('--card'), border: `1px solid ${v('--border')}` } },
        question: { backgroundColor: v('--card'), toolbar: { backgroundColor: v('--card') } },
        table: { cell: { fontSize: '12.5px', textColor: v('--foreground'), backgroundColor: v('--card') } },
        popover: { zIndex: 60 },
      },
    })
  }, [])
}

export default function AnalyticsPrototypePage() {
  const [params, setParams] = useSearchParams()
  const variant = params.get('variant') ?? 'board'
  const scenario = params.get('scenario') ?? 'en'
  const set = (k: string, v: string) => setParams((p) => (p.set(k, v), p), { replace: true })
  const theme = useDmscoTheme()

  return (
    <div dir={scenario === 'ar' ? 'rtl' : 'ltr'} className="flex min-h-0 flex-1 flex-col gap-3 p-4">
      <MetabaseProvider authConfig={authConfig} theme={theme} locale={scenario}>
        <header className="flex items-center gap-3">
          <BarChart3 className="size-5 text-primary" aria-hidden />
          <div>
            <h1 className="text-base font-semibold">HQ analytics</h1>
            <p className="text-xs text-muted-foreground">Synthetic data · as of today 21:00 · all stores</p>
          </div>
          <nav className="ms-6 flex gap-1">
            {[
              ['board', 'HQ board', LayoutDashboard],
              ['explore', 'Explore', Compass],
              ['ask', 'Ask', Sparkles],
              ['native', 'Build (native)', SlidersHorizontal],
              ['linked', 'Linked board', LayoutGrid],
              ['superset', 'Superset', Layers],
              ['recharts', 'Recharts board', Activity],
            ].map(([k, label, Icon]) => (
              <Button key={k as string} variant={variant === k ? 'primary' : 'secondary'} onClick={() => set('variant', k as string)}>
                <Icon className="size-3.5" aria-hidden />
                {label as string}
              </Button>
            ))}
          </nav>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto">
          {variant === 'board' && <BoardVariant />}
          {variant === 'explore' && <ExploreVariant />}
          {variant === 'ask' && <AskVariant />}
          {variant === 'native' && <NativeVariant />}
          {variant === 'linked' && <LinkedBoardVariant />}
          {variant === 'superset' && <SupersetVariant scenario={scenario} />}
          {variant === 'recharts' && <RechartsBoardVariant rtl={scenario === 'ar'} />}
        </main>
      </MetabaseProvider>

      <PrototypeSwitcher
        variants={VARIANTS}
        variant={variant}
        onVariant={(k) => set('variant', k)}
        scenarios={SCENARIOS}
        scenario={scenario}
        onScenario={(k) => set('scenario', k)}
      />
    </div>
  )
}

function BoardVariant() {
  return (
    <section className="rounded-2xl border border-border bg-card p-2">
      <InteractiveDashboard dashboardId={DASHBOARD_ID} withTitle withDownloads />
    </section>
  )
}

type Picked = { kind: 'question'; id: number | 'new' } | { kind: 'dashboard'; id: number }

function ExploreVariant() {
  const [picked, setPicked] = useState<Picked>({ kind: 'question', id: 'new' })
  return (
    <div className="grid h-full min-h-[70vh] grid-cols-[300px_1fr] gap-3">
      <aside className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-3">
        <Button onClick={() => setPicked({ kind: 'question', id: 'new' })}>
          <Plus className="size-3.5" aria-hidden />
          New view
        </Button>
        <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">HQ analytics — saved views</div>
        <CollectionBrowser
          collectionId={COLLECTION_ID}
          visibleColumns={['type', 'name']}
          pageSize={30}
          onClick={(item) => {
            if (item.model === 'dashboard') setPicked({ kind: 'dashboard', id: Number(item.id) })
            else if (item.model === 'card' || item.model === 'dataset' || item.model === 'metric') setPicked({ kind: 'question', id: Number(item.id) })
          }}
        />
      </aside>
      <section className="min-w-0 rounded-2xl border border-border bg-card p-3">
        {picked.kind === 'dashboard' ? (
          <InteractiveDashboard key={picked.id} dashboardId={picked.id} withTitle withDownloads />
        ) : (
          <InteractiveQuestion key={String(picked.id)} questionId={picked.id} isSaveEnabled targetCollection={COLLECTION_ID} height="72vh" />
        )}
      </section>
    </div>
  )
}
