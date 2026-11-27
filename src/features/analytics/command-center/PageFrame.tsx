import type { ReactNode } from 'react'
import { Navigate } from 'react-router'
import { dirOf } from '@/core/command-center-routes'
import { usePermissions } from '@/core/permissions'
import ScreenGate from '@/core/ui/ScreenGate'
import { canOpenCommandCenter, commandCenterNotOffered } from './access'
import LanguageSwitch from './LanguageSwitch'
import { NS, useCcLang, type CcPageLang } from './lang'

/**
 * The frame every command center page stands in (oms 946, 948, 949):
 *
 * - **Absent while the server does not offer it** (ticket 946 "the page is absent when the server does not offer it";
 *   "Nothing is shown until the server switch is on"): with the grant held but `commandCenterOn` off, the page is the
 *   app's own not-found — the catch-all route's redirect home (`app/router.tsx` `path: '*'`), never a sentence.
 * - **Behind the analytics view grant** (`canOpenCommandCenter`, the menu leaf's own predicate), its gate sentences in
 *   the page language (the gate takes the page's translator).
 * - **In the page language** (`?lang=`, decisions §3): its root carries `dir` and `lang`, and the language switch
 *   stands at its end, beside the page's `lead` (the home's status line).
 */
export default function PageFrame({
  titleKey,
  subtitleKey,
  lead,
  children,
}: {
  titleKey: string
  subtitleKey: string
  lead?: (cc: CcPageLang) => ReactNode
  children: (cc: CcPageLang) => ReactNode
}) {
  const cc = useCcLang()
  const permissions = usePermissions()
  const { lang, t, setLang } = cc
  if (commandCenterNotOffered(permissions)) return <Navigate to="/" replace />
  return (
    <div dir={dirOf(lang)} lang={lang} className="h-full" data-cc-page>
      <ScreenGate can={canOpenCommandCenter} ns={NS} t={t} title={t(titleKey)} subtitle={t(subtitleKey)}>
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">{lead?.(cc)}</div>
            <LanguageSwitch lang={lang} onChange={setLang} t={t} />
          </div>
          {children(cc)}
        </div>
      </ScreenGate>
    </div>
  )
}
