import { lazy, Suspense, useEffect } from 'react'
import { useLocation } from 'react-router'
import { usePageHelp } from '@/core/help/page-help'

// Lazy: a session that never presses "?" never loads the help's Markdown renderer.
const HelpDrawer = lazy(() => import('@/features/help/HelpDrawer'))

/**
 * The shell's mount of the page help drawer (oms 952, BackOffice spec 4182 §D; decision 8): open while
 * `@/core/help/page-help` says so — the "?" in an analytics page's header opens it — and closed when the route changes.
 */
export default function PageHelpDrawer() {
  const open = usePageHelp((s) => s.open)
  const close = usePageHelp((s) => s.close)
  const { pathname } = useLocation()
  useEffect(() => close(), [pathname, close])
  if (!open) return null
  return (
    <Suspense fallback={null}>
      <HelpDrawer />
    </Suspense>
  )
}
