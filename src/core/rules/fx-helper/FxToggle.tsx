import { useTranslation } from 'react-i18next'

/**
 * The ƒx button beside a formula box: it opens and closes the helper under it. `onMouseDown`
 * remembers the box's cursor before the button takes the focus. The words are the namespace's
 * `fx.toggle` / `fx.symbol` (each feature owns its own).
 */
export default function FxToggle({ ns, open, onToggle, onMouseDown }: { ns: string; open: boolean; onToggle: () => void; onMouseDown: () => void }) {
  const { t } = useTranslation(ns, { keyPrefix: 'fx' })
  return (
    <button
      type="button"
      className={
        'inline-grid h-7 min-w-7 shrink-0 place-items-center rounded-full border px-2 font-serif text-sm font-semibold italic transition-colors ' +
        (open ? 'border-primary bg-primary-050 text-primary-800' : 'border-border text-muted-foreground hover:bg-accent hover:text-foreground')
      }
      aria-expanded={open}
      aria-label={t('toggle')}
      title={t('toggle')}
      onMouseDown={onMouseDown}
      onClick={onToggle}
      data-fx-toggle=""
    >
      {t('symbol')}
    </button>
  )
}
