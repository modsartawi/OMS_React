import type { ReactNode } from 'react'

import Chip from '@/core/ui/Chip'

/**
 * The area's tabs (spec 3148): a tablist of `tabs` and the ONE open panel. Tab ids are `<idPrefix>-tab-<tab>`, the panel
 * `<idPrefix>-tab-panel`; each tab carries `data-tab`, the panel `data-tab-panel` (the drives read them). Used by the
 * document / delivery type page, the document sources page and the action types page.
 */
export default function TabStrip<T extends string>({
  tabs,
  open,
  onSelect,
  idPrefix,
  label,
  tabLabel,
  children,
}: {
  tabs: readonly T[]
  open: T
  onSelect: (tab: T) => void
  idPrefix: string
  label: string
  tabLabel: (tab: T) => string
  children: ReactNode
}) {
  const panelId = `${idPrefix}-tab-panel`
  return (
    <>
      <div role="tablist" aria-label={label} className="flex gap-1">
        {tabs.map((tab) => (
          <Chip
            key={tab}
            variant="tab"
            on={open === tab}
            id={`${idPrefix}-tab-${tab}`}
            aria-controls={panelId}
            onClick={() => tab !== open && onSelect(tab)}
            data-tab={tab}
          >
            {tabLabel(tab)}
          </Chip>
        ))}
      </div>
      <div role="tabpanel" id={panelId} aria-labelledby={`${idPrefix}-tab-${open}`} data-tab-panel={open}>
        {children}
      </div>
    </>
  )
}
