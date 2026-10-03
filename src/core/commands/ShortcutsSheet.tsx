/**
 * The "Keyboard shortcuts" sheet (ticket 393, spec 380 K16; ruling 365 §9): a native
 * dialog **generated from the registry** — the app-wide keys, then the mounted screen's
 * bound commands, hidden ones (J/K) included — so it can never drift from what the keys
 * actually do. It holds the single-key switch too (K6). There is no tour.
 *
 * It is `core/ui/Modal`, so it takes 388's card recipe, the platform's focus trap and Esc.
 */
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import Button from '@/core/ui/Button'
import Modal from '@/core/ui/Modal'
import KeyChord from './KeyChord'
import { isSingleKey } from './keys'
import type { Command } from './palette-model'
import {
  appWideLines,
  closeShortcuts,
  resetShortcuts,
  returnShortcutsFocus,
  screenLines,
  useShortcutsSheet,
  type SheetLine,
} from './shortcuts-sheet'
import { useSingleKeys } from './single-key-switch'

export default function ShortcutsSheet({
  commands,
  singleKeyScreen,
}: {
  commands: readonly Command[]
  singleKeyScreen: boolean
}) {
  const { t } = useTranslation()
  const open = useShortcutsSheet((s) => s.open)
  const switchOn = useSingleKeys((s) => s.on)
  const toggle = useSingleKeys((s) => s.toggle)

  // Focus goes back where it came from once the dialog is gone: the element is unmounted
  // on close, so the browser has no node to restore from.
  const wasOpen = useRef(false)
  useEffect(() => {
    if (!open && wasOpen.current) returnShortcutsFocus()
    wasOpen.current = open
  }, [open])
  // The host is leaving (a route with no palette): the sheet goes with it.
  useEffect(() => resetShortcuts, [])

  const app = appWideLines({ singleKeyScreen })
  const screen = screenLines(commands, { singleKeyScreen })

  /** A single key is listed while the switch is off, muted: the sheet says what exists. */
  const line = (l: SheetLine, group: string) => {
    const off = !switchOn && isSingleKey(l.keys)
    return (
      <li
        key={l.id}
        data-shortcut={`${group}:${l.id}`}
        className={'flex min-h-7 items-center justify-between gap-3 ' + (off ? 'text-muted-foreground' : '')}
      >
        <span className="min-w-0">{t(l.label)}</span>
        <KeyChord keys={l.keys} />
      </li>
    )
  }

  const heading = 'mb-1 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground'

  return (
    <Modal
      open={open}
      onClose={closeShortcuts}
      title={t('shortcuts.title')}
      width="28rem"
      footer={
        <Button variant="secondary" onClick={closeShortcuts}>
          {t('shortcuts.close')}
        </Button>
      }
    >
      <div data-shortcuts-sheet className="flex flex-col gap-4 text-[13px]">
        <section>
          <h3 className={heading}>{t('shortcuts.appWide')}</h3>
          <ul>{app.map((l) => line(l, 'app'))}</ul>
        </section>
        <section>
          <h3 className={heading}>{t('shortcuts.screen')}</h3>
          {screen.length > 0 ? (
            <ul>{screen.map((l) => line(l, 'screen'))}</ul>
          ) : (
            <p className="text-muted-foreground" data-shortcuts-none>
              {t('shortcuts.noScreenKeys')}
            </p>
          )}
        </section>
        <label className="flex items-start gap-2 border-t border-border pt-3">
          <input
            type="checkbox"
            checked={switchOn}
            onChange={toggle}
            data-shortcuts-switch
            className="mt-0.5 accent-primary"
          />
          <span>
            <span className="block font-medium">{t('shortcuts.switch')}</span>
            <span className="block text-[11.5px] text-muted-foreground">{t('shortcuts.switchHint')}</span>
          </span>
        </label>
      </div>
    </Modal>
  )
}
