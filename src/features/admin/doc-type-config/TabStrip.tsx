import type { ReactNode } from 'react'

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
      <div role="tablist" aria-label={label} className="flex gap-1 border-b border-border/60">
        {tabs.map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            id={`${idPrefix}-tab-${tab}`}
            aria-selected={open === tab}
            aria-controls={panelId}
            onClick={() => tab !== open && onSelect(tab)}
            data-tab={tab}
            className={
              'border-b-2 px-3 py-2 text-sm transition-colors ' +
              (open === tab ? 'border-primary font-semibold text-primary' : 'border-transparent text-muted-foreground hover:text-foreground')
            }
          >
            {tabLabel(tab)}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={panelId} aria-labelledby={`${idPrefix}-tab-${open}`} data-tab-panel={open}>
        {children}
      </div>
    </>
  )
}
