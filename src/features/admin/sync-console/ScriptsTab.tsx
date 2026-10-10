import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import type { StoreScript } from '@/core/models/sync-console'
import { storeScriptsQuery } from './api'
import { buildScriptColumns } from './store-columns'
import TabGrid from './TabGrid'

const scriptId = (s: StoreScript) => s.scriptId

/**
 * The Scripts tab (ticket 446) — read only, by ruling. The script id and its state,
 * never its SQL: the door does not send it, and nothing here could author one.
 */
export default function ScriptsTab({ code }: { code: string }) {
  const { t } = useTranslation('sync-console')
  const scripts = useQuery(storeScriptsQuery(code))
  const columns = useMemo(() => buildScriptColumns(t), [t])
  return (
    <div className="flex flex-col gap-2">
      <TabGrid
        rows={scripts.data?.items}
        columns={columns}
        rowId={scriptId}
        pending={scripts.isPending}
        error={scripts.error}
        failed={t('scripts.loadFailed')}
        empty={t('scripts.empty')}
        loading={t('scripts.loading')}
        data="scripts"
      />
      <p className="text-xs text-muted-foreground">{t('scripts.note')}</p>
    </div>
  )
}
