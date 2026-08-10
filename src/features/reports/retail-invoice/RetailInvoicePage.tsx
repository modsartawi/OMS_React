import { useTranslation } from 'react-i18next'
import { FileSearch } from 'lucide-react'
import { canOpenRetailInvoice } from './api'
import ScreenGate from './ScreenGate'

/**
 * Invoices (`/reports/invoice`) — the first screen of the new **Reports** area
 * (ticket 263, spec 261).
 *
 * 263 lands the area, not the screen: the route, the nav group, the `reports`
 * namespace and the gate, so each can be proven on its own before 264 hangs a
 * search toolbar and a grid inside `ScreenGate`'s `children` and 265 hangs a
 * download on a row.
 *
 * 🚩 **It lands empty and fires no query on mount**, deliberately inverting what
 * collection's four screens do. This screen cannot guess a transaction number, so
 * an auto-fired search would be a guaranteed empty grid (spec 261 §"The screen's
 * shape"). The only call it makes is the access probe the gate reads — the same
 * one the nav leaf reads, on the same key, so a visit costs one round trip.
 *
 * ⚠️ The probe hides the menu; it is not the boundary. `Search` and `Download`
 * re-check the grant server-side and refuse with a **bare 403 carrying no body**,
 * which 264 and 265 read on their own calls.
 */
export default function RetailInvoicePage() {
  const { t } = useTranslation('reports')
  return (
    <ScreenGate
      can={canOpenRetailInvoice}
      title={t('invoice.title')}
      subtitle={t('invoice.subtitle')}
    >
      {/* The resting state of the screen, and it stays the resting state after
          264: a transaction number has to be typed before there is anything to
          show, so "nothing yet" is the honest thing to draw on arrival rather
          than an empty grid pretending a search has run. */}
      <div className="mx-auto mt-12 flex max-w-sm flex-col items-center gap-2 text-center">
        <FileSearch className="h-8 w-8 text-muted-foreground" aria-hidden />
        <div className="text-base font-semibold tracking-tight">{t('invoice.landing.title')}</div>
        <p className="text-sm text-muted-foreground">{t('invoice.landing.hint')}</p>
      </div>
    </ScreenGate>
  )
}
