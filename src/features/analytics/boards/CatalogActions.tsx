import { lazy, Suspense, useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { Plus, Sparkles, Table2 } from 'lucide-react'
import { useCopilotPanel } from '@/core/copilot-panel'
import i18n from '@/core/i18n'
import type { AnalyticsCatalogArea } from '@/core/models/analytics'
import { saysIn } from '@/core/rules/sentence'
import Button from '@/core/ui/Button'
import { buttonClass } from '@/core/ui/control-classes'
import { fsi } from '@/core/util/bidi'
import { analyticsAccessQuery } from './access'
import { catalogAuthorActions, newViewFrom } from './catalog-actions'

// The grid (AG Grid) loads only when a preview opens.
const CatalogPreview = lazy(() => import('./CatalogPreview'))

/**
 * An area or measure node's actions (ticket 843, BackOffice spec 3437 §G, stories 35–38 and 49–51): Preview for any
 * viewer, and for an author "New view from this" (the builder, pre-filled) and "Ask about this area" (the copilot
 * panel with the question in its box, unsent — agent ruling 4). A runner sees Preview only.
 *
 * Returns the header buttons (`actions`) and what Preview opens under the facts (`below`). The preview belongs to
 * the node it was opened on: picking another node closes it.
 */
export function useCatalogActions(area: AnalyticsCatalogArea, measure?: string): { actions: ReactNode; below: ReactNode } {
  const { t } = useTranslation('boards')
  const probe = useQuery(analyticsAccessQuery()).data
  const available = useCopilotPanel((s) => s.available)
  const prefill = useCopilotPanel((s) => s.prefill)
  const node = `${area.key}/${measure ?? ''}`
  const [openOn, setOpenOn] = useState<string | null>(null)
  const open = openOn === node
  const offer = catalogAuthorActions(probe, available)
  const view = newViewFrom(area, { measure })

  const actions = (
    <>
      <Button variant={open ? 'secondary' : 'outlined'} aria-pressed={open} onClick={() => setOpenOn(open ? null : node)} data-catalog-action="preview">
        <Table2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
        {t('catalog.actions.preview')}
      </Button>
      {offer.newView && (
        <Link to={view.to} state={view.state} className={buttonClass('outlined')} data-catalog-action="new-view">
          <Plus className="h-3.5 w-3.5 shrink-0" aria-hidden />
          {t('catalog.actions.newView')}
        </Link>
      )}
      {offer.ask && (
        <Button
          variant="outlined"
          onClick={() => prefill(t('catalog.actions.askQuestion', { area: fsi(saysIn(area.label, i18n.language) || area.key) }))}
          data-catalog-action="ask"
        >
          <Sparkles className="h-3.5 w-3.5 shrink-0" aria-hidden />
          {t('catalog.actions.ask')}
        </Button>
      )}
    </>
  )
  const below = open ? (
    <Suspense fallback={<p className="text-sm text-muted-foreground">{t('catalog.preview.loading')}</p>}>
      <CatalogPreview key={node} area={area} measure={measure} />
    </Suspense>
  ) : null
  return { actions, below }
}
