import { Outlet } from 'react-router'
import Rail from './Rail'
import TopBar from './TopBar'
import { useRailMode } from './rail-mode'

// The Ops Console shell (spec 380 F10–F13): the navy rail on the inline-start side
// (ticket 385), and beside it the 44px top bar over the screen (ticket 386). The account
// and the build stamp live in the user menu at the rail foot, so there is no footer row.
// The width band (ticket 387) decides the rail's shape: pinned at ≥1280px, overlaid at
// 640–1279px, and below 640px no rail at all — the top bar's hamburger opens a drawer.
export default function AppShell() {
  const mode = useRailMode()
  return (
    <div className="flex min-h-screen">
      {mode !== 'drawer' && <Rail mode={mode} />}

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar withDrawer={mode === 'drawer'} />

        <main className="min-w-0 flex-1 p-4">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
