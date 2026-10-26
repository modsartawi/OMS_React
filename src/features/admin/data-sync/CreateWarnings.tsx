import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate } from 'react-router'
import type { GeneralErrorResponse } from '@/core/api'
import Ltr from '@/core/ui/Ltr'
import { createWarningStore, createWarningsFromState } from './apply-helpers'
import { codeWord } from './code-words'

/**
 * An Apply create's per-store warnings (`DATASYNC_STORE_BUSY` / `DATASYNC_STORE_WPF_HOSTED`): the
 * store (read out of the text, wire §9.3), the screen's words for the code (else the door's text),
 * and the code. Drawn in the Apply outcome and on the campaign page.
 */
export function CreateWarningList({ warnings }: { warnings: readonly GeneralErrorResponse[] }) {
  const { t } = useTranslation('data-sync')
  return (
    <ul className="mt-1 flex flex-col gap-1">
      {warnings.map((w, i) => {
        const store = createWarningStore(w)
        const warningWords = codeWord(t, 'apply.outcome.warning', w.errorCode)
        return (
          <li key={i} data-apply-warning={w.errorCode} data-store={store ?? ''}>
            {store ? (
              <span className="font-mono">
                <Ltr>{store}</Ltr>
              </span>
            ) : (
              t('apply.outcome.someStore')
            )}{' '}
            {warningWords ?? <bdi>{w.errorMessage}</bdi>}{' '}
            <span className="font-mono text-muted-foreground">
              <Ltr>{w.errorCode}</Ltr>
            </span>
          </li>
        )
      })}
    </ul>
  )
}

/**
 * The campaign page's notice of the create's warnings, when the page was opened from the Apply
 * outcome (they arrive in router state — review fix, 2026-10-24). DataSync keeps no copy of them,
 * so they do not survive a reload; the notice says so. A browser keeps `history.state` across a
 * reload, so the notice takes them once and clears the entry's state (same address, replaced).
 */
export function CreateWarningsNotice() {
  const { t } = useTranslation('data-sync')
  const location = useLocation()
  const navigate = useNavigate()
  const [warnings] = useState(() => createWarningsFromState(location.state))
  const carried = createWarningsFromState(location.state).length > 0
  useEffect(() => {
    if (carried) navigate({ pathname: location.pathname, search: location.search }, { replace: true, state: null })
  }, [carried, navigate, location.pathname, location.search])
  if (warnings.length === 0) return null
  return (
    <div
      className="rounded-md border border-attention-border bg-attention-050 px-3 py-2 text-xs"
      role="status"
      data-campaign-create-warnings={warnings.length}
    >
      <p className="font-medium">{t('campaign.createWarnings.title')}</p>
      <CreateWarningList warnings={warnings} />
      <p className="mt-1 text-muted-foreground">{t('campaign.createWarnings.note')}</p>
    </div>
  )
}
