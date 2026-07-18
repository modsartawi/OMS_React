import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Check, Save, Trash2 } from 'lucide-react'
import type { GridApi } from 'ag-grid-community'
import type { DeliveryDocumentModel } from '@/core/models/delivery-document'
import { useGridViews } from './grid-views'

const BTN =
  'inline-flex h-7 items-center gap-1.5 rounded-md border border-border px-2 text-xs ' +
  'hover:bg-accent disabled:opacity-50 disabled:hover:bg-transparent'

/**
 * Saved-views control for the results grid (D-5).
 *
 * Captures the current column layout + filters as a named view, switches between
 * views, overwrites the selected one, or deletes it. No rename and no default
 * view — parity with the prototype. Persistence is browser-local.
 */
export default function ViewManager({ gridApi }: { gridApi: GridApi<DeliveryDocumentModel> | null }) {
  const { t } = useTranslation('deliveries')
  const views = useGridViews((s) => s.views)
  const addView = useGridViews((s) => s.add)
  const updateView = useGridViews((s) => s.update)
  const removeView = useGridViews((s) => s.remove)

  const [selectedId, setSelectedId] = useState<string>('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [name, setName] = useState('')

  const selected = views.find((v) => v.id === selectedId)

  /** Selecting a view applies it to the grid immediately. */
  function select(id: string) {
    setSelectedId(id)
    const view = views.find((v) => v.id === id)
    if (!gridApi || !view) return
    gridApi.applyColumnState({ state: view.columnState, applyOrder: true })
    gridApi.setFilterModel(view.filterModel)
  }

  function confirmSave() {
    const trimmed = name.trim()
    if (!gridApi || !trimmed) return
    const view = addView(trimmed, gridApi.getColumnState(), gridApi.getFilterModel())
    setDialogOpen(false)
    setSelectedId(view.id)
    toast.success(t('views.saved.title'), { description: t('views.saved.detail', { name: view.name }) })
  }

  function update() {
    if (!gridApi || !selected) return
    updateView(selected.id, gridApi.getColumnState(), gridApi.getFilterModel())
    toast.success(t('views.updated.title'), { description: t('views.updated.detail', { name: selected.name }) })
  }

  function remove() {
    if (!selected) return
    const removedName = selected.name
    removeView(selected.id)
    setSelectedId('')
    toast.info(t('views.deleted.title'), { description: t('views.deleted.detail', { name: removedName }) })
  }

  return (
    <>
      <select
        aria-label={t('views.ariaLabel')}
        className="h-7 rounded-md border border-input bg-background px-2 text-xs"
        value={selectedId}
        onChange={(e) => select(e.target.value)}
      >
        <option value="">{t('views.placeholder')}</option>
        {views.map((view) => (
          <option key={view.id} value={view.id}>
            {view.name}
          </option>
        ))}
      </select>
      <button
        type="button"
        className={BTN}
        disabled={!gridApi}
        onClick={() => {
          setName('')
          setDialogOpen(true)
        }}
      >
        <Save className="h-3.5 w-3.5" aria-hidden />
        {t('views.save')}
      </button>
      <button type="button" className={BTN} disabled={!selected} onClick={update}>
        <Check className="h-3.5 w-3.5" aria-hidden />
        {t('views.update')}
      </button>
      <button
        type="button"
        className={BTN + ' text-destructive'}
        disabled={!selected}
        onClick={remove}
      >
        <Trash2 className="h-3.5 w-3.5" aria-hidden />
        {t('views.delete')}
      </button>

      {dialogOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setDialogOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={t('views.dialogTitle')}
            className="w-88 max-w-[90vw] rounded-md border border-border bg-card p-4 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-sm font-semibold">{t('views.dialogTitle')}</h2>
            <label htmlFor="viewName" className="mt-3 block text-xs font-medium text-muted-foreground">
              {t('views.nameLabel')}
            </label>
            <input
              id="viewName"
              autoFocus
              autoComplete="off"
              className="mt-1 h-8 w-full rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder={t('views.namePlaceholder')}
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') confirmSave()
                if (e.key === 'Escape') setDialogOpen(false)
              }}
            />
            <p className="mt-2 text-xs text-muted-foreground">{t('views.dialogHint')}</p>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className={BTN} onClick={() => setDialogOpen(false)}>
                {t('views.cancel')}
              </button>
              <button
                type="button"
                disabled={!name.trim()}
                onClick={confirmSave}
                className="inline-flex h-7 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
              >
                <Save className="h-3.5 w-3.5" aria-hidden />
                {t('views.save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
