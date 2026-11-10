import { Outlet, useLocation, useMatches } from 'react-router'
import Rail from './Rail'
import TopBar from './TopBar'
import { useRailMode } from './rail-mode'
import { fillsContent, hidesShell } from './shell-route'
import { lazy } from 'react'
import { setCopilotTableEmbed, setCopilotViewEmbed } from '@/core/copilot-view-embed'

// A copilot answer draws the views it created inline (CTO demo, spec 766 D): the analytics embed, lazily.
setCopilotViewEmbed(lazy(() => import('@/features/analytics/boards/CopilotViewEmbed')))
// …and the tables it marked to show (ticket 868, spec 3558 D5): the analytics table form, lazily.
setCopilotTableEmbed(lazy(() => import('@/features/analytics/boards/CopilotTableEmbed')))

// The Ops Console shell (spec 380 F10–F13): the navy rail on the inline-start side
// (ticket 385), and beside it the 44px top bar over the screen (ticket 386). The account
// and the build stamp live in the user menu at the rail foot, so there is no footer row.
// The width band (ticket 387) decides the rail's shape: pinned at ≥1280px, overlaid at
// 640–1279px, and below 640px no rail at all — the top bar's hamburger opens a drawer.
//
// A route flagged `fill` (the call center console, ticket 407) takes the content area whole:
// the shell is held to the viewport, the area loses its padding, and the screen's own
// columns scroll inside it rather than the page.
//
// A route flagged `chromeless` hides the shell when the URL sets that param (a board's `?tv=1`, ticket
// 780): the screen alone, still behind the session (the shell sits inside ProtectedLayout).
export default function AppShell() {
  const mode = useRailMode()
  const handles = useMatches().map((m) => m.handle)
  const fill = fillsContent(handles)
  const bare = hidesShell(handles, useLocation().search)
  if (bare) {
    return (
      <main className="min-h-screen min-w-0" data-shell="hidden">
        <Outlet />
      </main>
    )
  }
  return (
    <div className={'flex ' + (fill ? 'h-screen' : 'min-h-screen')}>
      {mode !== 'drawer' && <Rail mode={mode} />}

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar withDrawer={mode === 'drawer'} />

        <main className={fill ? 'flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden' : 'min-w-0 flex-1 p-4'}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}
