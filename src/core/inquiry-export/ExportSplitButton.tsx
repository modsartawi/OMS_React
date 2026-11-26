import { useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { CalendarRange, ChevronDown, Download } from 'lucide-react'
import Button from '@/core/ui/Button'
import IconButton from '@/core/ui/IconButton'
import { POPOVER } from '@/core/ui/overlay'
import { usePopoverDismiss } from '@/core/ui/use-popover-dismiss'
import { canExportMonth, capabilitiesQuery, type InquiryExportScreen } from './api'
import ExportMonthDialog from './ExportMonthDialog'
import type { ExportMonthSource } from './export-month'

export interface ExportSplitButtonProps {
  /** The server's screen key — also what the capabilities answer lists when this session may export it. */
  screen: InquiryExportScreen
  /** The screen's quick export, exactly as its old Export button took it (label, click, disabled). */
  quick: { label: string; onExport: () => void; disabled: boolean }
  /** What Export month… sends: the grid's visible columns, the applied filters, the range to pre-fill. */
  month: ExportMonthSource
}

/**
 * The inquiry screens' export button (BackOffice spec 4314, ticket 4318): **Quick export** — the screen's own
 * in-browser file, unchanged — and, beside it, a menu holding **Export month…**, which asks the server for an
 * export job.
 *
 * 🚩 Shared by every screen that exports a month (4321–4325 switch it on per screen with their `screen` key and the
 * `month` source). The Export month… half is drawn only when the capabilities answer says the feature is on AND lists
 * this screen (the session holds `<Screen>Export:03`); otherwise the control IS the old Export button, so a screen
 * without the feature looks exactly as before.
 */
export default function ExportSplitButton({ screen, quick, month }: ExportSplitButtonProps) {
  const { t } = useTranslation('inquiry-export')
  const caps = useQuery(capabilitiesQuery())
  const offered = canExportMonth(caps.data, screen)
  const [menuOpen, setMenuOpen] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  usePopoverDismiss(menuOpen, wrapRef, () => setMenuOpen(false))

  const quickButton = (
    <Button variant="outlined" onClick={quick.onExport} disabled={quick.disabled} data-quick-export="">
      <Download className="h-3.5 w-3.5" aria-hidden />
      {quick.label}
    </Button>
  )
  if (!offered) return quickButton

  return (
    <div ref={wrapRef} className="relative inline-flex items-center gap-0.5">
      {quickButton}
      <IconButton
        variant="outlined"
        label={t('split.more')}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen((o) => !o)}
        data-export-month-toggle=""
      >
        <ChevronDown className="size-3.5" aria-hidden />
      </IconButton>
      {menuOpen && (
        <div
          role="menu"
          aria-label={t('split.more')}
          className={'absolute end-0 top-full z-50 mt-1 flex w-56 flex-col p-1 ' + POPOVER}
        >
          <Button
            variant="ghost"
            role="menuitem"
            className="w-full justify-start"
            onClick={() => {
              setMenuOpen(false)
              quick.onExport()
            }}
            disabled={quick.disabled}
            data-quick-export-item=""
          >
            <Download className="h-3.5 w-3.5" aria-hidden />
            {t('split.quick')}
          </Button>
          <Button
            variant="ghost"
            role="menuitem"
            className="w-full justify-start"
            onClick={() => {
              setMenuOpen(false)
              setDialogOpen(true)
            }}
            data-export-month=""
          >
            <CalendarRange className="h-3.5 w-3.5" aria-hidden />
            {t('split.month')}
          </Button>
        </div>
      )}
      {dialogOpen && <ExportMonthDialog screen={screen} source={month} onClose={() => setDialogOpen(false)} />}
    </div>
  )
}
