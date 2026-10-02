import { Outlet } from 'react-router'
import Rail from './Rail'
import TopBar from './TopBar'

// The Ops Console shell (spec 380 F10–F12): the navy rail on the inline-start side
// (ticket 385), and beside it the 44px top bar over the screen (ticket 386). The account
// and the build stamp live in the user menu at the rail foot, so there is no footer row.
export default function AppShell() {
  return (
    <div className="flex min-h-screen">
      <Rail />

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />

        <main className="min-w-0 flex-1 p-4">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
