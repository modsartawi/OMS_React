import { useTranslation } from 'react-i18next'
import Kbd from '@/core/ui/Kbd'
import Ltr from '@/core/ui/Ltr'
import Modal from '@/core/ui/Modal'

/**
 * The board editor's shortcut sheet (ticket 846 item 6), opened with `?` or the toolbar's keyboard button. Each
 * chord is ONE isolate (`Ltr` around its caps), so it reads `Ctrl Z` under Arabic too. A named cap is a key
 * (`common:keys.*`, or this sheet's `boardEditor.keys.cap.*`); a letter, an arrow or `?` is printed as it is on the key.
 */

const NAMED: Record<string, string> = {
  ctrl: 'common:keys.ctrl',
  shift: 'common:keys.shift',
  esc: 'common:keys.esc',
  delete: 'boardEditor.keys.cap.delete',
  click: 'boardEditor.keys.cap.click',
}

const ROWS: { keys: string[][]; what: string }[] = [
  { keys: [['ctrl', 'Z']], what: 'undo' },
  { keys: [['ctrl', 'Y'], ['ctrl', 'shift', 'Z']], what: 'redo' },
  { keys: [['←', '→', '↑', '↓']], what: 'move' },
  { keys: [['shift', '←', '→', '↑', '↓']], what: 'resize' },
  { keys: [['delete']], what: 'remove' },
  { keys: [['ctrl', 'D']], what: 'duplicate' },
  { keys: [['ctrl', 'click'], ['shift', 'click']], what: 'select' },
  { keys: [['esc']], what: 'escape' },
  { keys: [['?']], what: 'sheet' },
]

export default function BoardShortcuts({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation('boards')
  return (
    <Modal open={open} onClose={onClose} title={t('boardEditor.keys.title')} width="32rem">
      <dl className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-2 text-sm" data-board-shortcuts>
        {ROWS.map((r) => (
          <div key={r.what} className="contents">
            <dt className="flex flex-wrap gap-2">
              {r.keys.map((chord) => (
                <Ltr key={chord.join('+')}>
                  <span className="inline-flex gap-0.5">
                    {chord.map((k) => (
                      <Kbd key={k}>{NAMED[k] ? t(NAMED[k]) : k}</Kbd>
                    ))}
                  </span>
                </Ltr>
              ))}
            </dt>
            <dd>{t(`boardEditor.keys.${r.what}`)}</dd>
          </div>
        ))}
      </dl>
    </Modal>
  )
}
