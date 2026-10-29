import { useEffect, useMemo, useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'

import Button from '@/core/ui/Button'

import GridPager from '@/core/ui/GridPager'
import Ltr from '@/core/ui/Ltr'
import ScreenGate from '@/core/ui/ScreenGate'
import { clampToLastPageWhenCurrentPageEmpties, showsPager } from '@/core/ui/pager'
import type { SentScript } from '@/core/models/sync-console'
import { canOpenSyncConsole, canRunStoreScripts, scriptsQuery, syncConsoleAccessQuery } from './api'
import { figure } from './helpers'
import { SCRIPTS_PAGE_SIZE } from './scripts-helpers'
import { buildSentScriptColumns } from './scripts-columns'
import ConsoleNav from './ConsoleNav'
import ScriptDetailModal from './ScriptDetailModal'
import SendScriptDialog from './SendScriptDialog'
import TabGrid from './TabGrid'

const scriptId = (s: SentScript) => s.scriptId

/**
 * Store scripts (ticket 663, BackOffice spec 3202 D14) — `/admin/sync/scripts`: every store
 * script sent, newest first, read off `GET ActionSync/Scripts` (a read: `ActionSync.Health.View`),
 * with how many stores have executed it and how many are pending, retrying, exhausted or
 * withdrawn. A title opens the script's detail.
 *
 * Ticket 664: behind `canRunScripts` (`ActionSync.RunStoreScript`), **Send a store script** above
 * the list opens the send dialog; the detail carries Withdraw and Retry. Without it the page is
 * read only — the controls are absent, not disabled.
 */
export default function ScriptsPage() {
  const { t } = useTranslation('sync-console')
  return (
    <ScreenGate
      query={syncConsoleAccessQuery()}
      can={canOpenSyncConsole}
      ns="sync-console"
      title={t('scriptsPage.title')}
      subtitle={t('scriptsPage.subtitle')}
    >
      <Scripts />
    </ScreenGate>
  )
}

function Scripts() {
  const { t } = useTranslation('sync-console')
  const [page, setPage] = useState(1)
  const [opened, setOpened] = useState<SentScript | null>(null)
  const [sending, setSending] = useState(false)
  const access = useQuery(syncConsoleAccessQuery())
  const canSend = canRunStoreScripts(access.data)
  const scripts = useQuery({ ...scriptsQuery(page), placeholderData: keepPreviousData })
  const columns = useMemo(() => buildSentScriptColumns(t, setOpened), [t])
  const shown = scripts.isError ? undefined : scripts.data
  const total = shown?.total ?? 0

  // A new script lands on page 1 and pushes the rest down: an emptied inner page falls back.
  const settled = shown && !scripts.isPlaceholderData ? shown : undefined
  useEffect(() => {
    if (!settled) return
    const last = clampToLastPageWhenCurrentPageEmpties({
      page: settled.page,
      rowCount: settled.items.length,
      totalMatches: settled.total,
      pageSize: SCRIPTS_PAGE_SIZE,
    })
    if (last !== settled.page) setPage((p) => (p === settled.page ? last : p))
  }, [settled])

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <ConsoleNav />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="text-xs text-muted-foreground">{t('scriptsPage.note')}</p>
        {canSend && (
          <Button variant="primary" onClick={() => setSending(true)} data-script-send-open="">
            {t('scriptsPage.send')}
          </Button>
        )}
      </div>

      <section className="flex min-w-0 flex-col gap-2" data-scripts-list="">
        {shown && (
          <span className="text-xs text-muted-foreground" data-scripts-count={total}>
            <Trans t={t} i18nKey="scriptsPage.count" count={total} values={{ n: figure(total) }} components={{ n: <Ltr /> }} />
          </span>
        )}
        <TabGrid
          rows={shown?.items}
          columns={columns}
          rowId={scriptId}
          pending={scripts.isPending}
          error={scripts.error}
          failed={t('scriptsPage.failed')}
          empty={t(page > 1 ? 'scriptsPage.emptyPage' : 'scriptsPage.empty')}
          loading={t('scriptsPage.loading')}
          data="scripts-list"
        />
        {/* Drawn beside an empty or failed inner page too: it is the only way back from one. */}
        {((shown && showsPager(total, SCRIPTS_PAGE_SIZE)) || page > 1) && (
          <div className="overflow-hidden rounded-md border border-border/60">
            <GridPager
              page={page}
              pageSize={SCRIPTS_PAGE_SIZE}
              totalMatches={total}
              busy={scripts.isPlaceholderData}
              onPage={setPage}
            />
          </div>
        )}
      </section>

      <ScriptDetailModal script={opened} onClose={() => setOpened(null)} />
      <SendScriptDialog open={canSend && sending} onClose={() => setSending(false)} />
    </div>
  )
}
