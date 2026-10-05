import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Trash2 } from 'lucide-react'
import Button from '@/core/ui/Button'
import Ltr from '@/core/ui/Ltr'
import Modal from '@/core/ui/Modal'
import { fsi } from '@/core/util/bidi'
import { INPUT } from './fields'
import { DEFAULT_UOM, type EditorState, GROUPING_ID_MAX, normalizeGroupingId, upsertGrouping } from './editor'

/**
 * SAP's Local Material Grouping popup (2330 §5, screenshots 3 and 5): a grouping id of at most 12,
 * upper-case, status `3` "Created Manually", and its materials. Confirm hands the bonus buy back
 * with the grouping added or replaced; a line then picks it by id. Read-only in display.
 */
export default function GroupingDialog({
  open,
  readOnly,
  state,
  onClose,
  onConfirm,
}: {
  open: boolean
  readOnly: boolean
  state: EditorState
  onClose: () => void
  onConfirm: (next: EditorState) => void
}) {
  const { t } = useTranslation('bonus-buy-maintenance')
  return (
    <Modal open={open} onClose={onClose} title={t('grouping.title')} width="40rem">
      {/* Mounted only while open, so each opening starts from the bonus buy's groupings. */}
      {open && <GroupingForm readOnly={readOnly} state={state} onClose={onClose} onConfirm={onConfirm} />}
    </Modal>
  )
}

function GroupingForm({
  readOnly,
  state,
  onClose,
  onConfirm,
}: {
  readOnly: boolean
  state: EditorState
  onClose: () => void
  onConfirm: (next: EditorState) => void
}) {
  const { t } = useTranslation('bonus-buy-maintenance')
  const first = state.groupings[0]
  const [id, setId] = useState(first?.id ?? '')
  const [materials, setMaterials] = useState<string[]>(first ? [...first.materials, ''] : [''])

  const pick = (next: string) => {
    setId(next)
    const g = state.groupings.find((x) => x.id === next)
    setMaterials(g ? [...g.materials, ''] : [''])
  }

  const normalized = normalizeGroupingId(id)
  const kept = materials.map((m) => m.trim()).filter((m) => m !== '')
  const canConfirm = !readOnly && normalized !== '' && kept.length > 0

  return (
    <div className="flex flex-col gap-3">
      {state.groupings.length > 0 && (
        <label className="flex w-fit flex-col gap-1 text-xs font-medium text-muted-foreground">
          {t('grouping.existing')}
          <select className={`${INPUT} w-56`} value={state.groupings.some((g) => g.id === id) ? id : ''} onChange={(e) => pick(e.target.value)}>
            <option value="">{t('grouping.new')}</option>
            {state.groupings.map((g) => (
              <option key={g.id} value={g.id}>
                {fsi(g.id)}
              </option>
            ))}
          </select>
        </label>
      )}

      <fieldset disabled={readOnly} className="flex min-w-0 flex-col gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
            {t('grouping.id')}
            <input
              dir="ltr"
              className={`${INPUT} w-48 font-mono uppercase`}
              value={id}
              maxLength={GROUPING_ID_MAX}
              onChange={(e) => {
                const next = normalizeGroupingId(e.target.value)
                // Typing an existing id opens that grouping, so Confirm can never silently
                // replace its materials with the few typed here.
                if (state.groupings.some((g) => g.id === next)) pick(next)
                else setId(next)
              }}
            />
          </label>
          <div className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
            {t('grouping.status')}
            <div className="flex h-8 items-center gap-2 text-sm text-foreground">
              <span className="font-mono">
                <Ltr>3</Ltr>
              </span>
              {t('grouping.createdManually')}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <div className="text-sm font-semibold">{t('grouping.assignment')}</div>
          <table className="w-full text-sm" data-grid="grouping">
            <thead>
              <tr className="text-xs text-muted-foreground">
                <th className="px-1 pb-1 text-start font-medium">{t('grouping.col.material')}</th>
                <th className="px-1 pb-1 text-start font-medium">{t('grouping.col.description')}</th>
                <th className="px-1 pb-1 text-start font-medium">{t('grouping.col.unit')}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {materials.map((m, i) => (
                <tr key={i}>
                  <td className="w-44 px-1 py-0.5">
                    <input
                      aria-label={t('grouping.col.material')}
                      dir="ltr"
                      className={`${INPUT} h-7 w-full font-mono`}
                      value={m}
                      onChange={(e) => setMaterials((ms) => ms.map((x, j) => (j === i ? e.target.value.trim() : x)))}
                    />
                  </td>
                  {/* No item lookup door yet (see BuyGetPanels' DescriptionCell). */}
                  <td className="px-1 py-0.5 text-muted-foreground">{t('editor.line.noDescription')}</td>
                  <td className="px-1 py-0.5 font-mono text-xs text-muted-foreground">
                    <Ltr>{DEFAULT_UOM}</Ltr>
                  </td>
                  <td className="px-1 py-0.5">
                    {!readOnly && (
                      <button
                        type="button"
                        aria-label={t('editor.line.remove', { n: fsi(String(i + 1)) })}
                        onClick={() => setMaterials((ms) => ms.filter((_, j) => j !== i))}
                        className="rounded p-1 text-muted-foreground hover:text-danger-800"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!readOnly && (
            <Button variant="text" className="w-fit" onClick={() => setMaterials((ms) => [...ms, ''])}>
              <Plus className="h-3.5 w-3.5" aria-hidden />
              {t('editor.line.add')}
            </Button>
          )}
        </div>
      </fieldset>

      <div className="flex justify-end gap-2">
        <Button variant="text" onClick={onClose}>
          {t(readOnly ? 'grouping.close' : 'grouping.cancel')}
        </Button>
        {!readOnly && (
          <Button
            variant="primary"
            disabled={!canConfirm}
            onClick={() => onConfirm(upsertGrouping(state, { id: normalized, materials: kept }))}
          >
            {t('grouping.confirm')}
          </Button>
        )}
      </div>
    </div>
  )
}
