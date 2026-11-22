import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Trans, useTranslation } from 'react-i18next'
import type { StockConsoleFlag } from '@/core/models/stock-console'
import Ltr from '@/core/ui/Ltr'
import StatusBadge from '@/core/ui/StatusBadge'
import { POPOVER } from '@/core/ui/overlay'
import { usePopoverDismiss } from '@/core/ui/use-popover-dismiss'
import { fsi } from '@/core/util/bidi'
import { formatFigure } from '@/core/util/number-format'
import { flagLines, statusPill, type FlagLine } from './figures'

/**
 * A store's status pill (oms 940, spec 4157 story 76): OK, Watch or Problem, and a press opens its flags, each with its
 * measured value and its limit ("No SAP document for 31 hours · limit 24"), so a status is never a mystery.
 *
 * The popover is portalled to the body: the pill sits in a grid cell, and AG Grid's rows are transformed and clipped,
 * so a popover inside one would be cut off. It closes on a press outside, on Esc, and when the page scrolls.
 */
export default function StatusPill({ store, status, flags }: { store: string; status: string; flags: StockConsoleFlag[] }) {
  const { t } = useTranslation('stock-console')
  const pill = statusPill(status)
  const [at, setAt] = useState<{ top: number; start: number } | null>(null)
  const open = at !== null
  const trigger = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  // A press on the pill while open is "outside" the portalled panel: the pill's own click closes it instead.
  const pressedPill = useRef(false)
  const panelId = useId()

  usePopoverDismiss(open, panel, (by) => {
    if (by === 'outside' && pressedPill.current) {
      pressedPill.current = false
      return
    }
    setAt(null)
    if (by === 'escape') trigger.current?.focus()
  })

  useEffect(() => {
    if (!open) return
    const close = () => setAt(null)
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => {
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [open])

  const toggle = () => {
    pressedPill.current = false
    if (open || !trigger.current) return setAt(null)
    const r = trigger.current.getBoundingClientRect()
    const rtl = document.documentElement.dir === 'rtl'
    setAt({ top: r.bottom + 4, start: rtl ? window.innerWidth - r.right : r.left })
  }

  const label = 'key' in pill ? t(pill.key) : pill.raw
  return (
    <>
      {/* Hand-written (baseline-allowlisted): a StatusBadge that opens its flags must stay the one pill shape. */}
      <button
        ref={trigger}
        type="button"
        onMouseDown={() => {
          if (open) pressedPill.current = true
        }}
        onClick={toggle}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-label={t('pill.open', { status: 'key' in pill ? label : fsi(label) })}
        className="inline-flex items-center rounded-full"
        data-status-pill={status}
      >
        <StatusBadge sev={pill.sev}>{'key' in pill ? label : <bdi>{label}</bdi>}</StatusBadge>
      </button>
      {open &&
        createPortal(
          <div
            ref={panel}
            id={panelId}
            role="dialog"
            aria-label={t('pill.title', { store: fsi(store) })}
            className={`fixed z-50 w-80 p-3 text-sm ${POPOVER}`}
            style={{ top: at.top, insetInlineStart: at.start }}
            data-status-flags={store}
          >
            <div className="mb-2 font-medium">
              <Trans t={t} i18nKey="pill.heading" values={{ store }} components={{ s: <Ltr /> }} />
            </div>
            {flags.length === 0 ? (
              <p className="text-muted-foreground">{t('pill.none')}</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {flagLines(flags).map((line, i) => (
                  <FlagItem key={`${line.code}-${i}`} line={line} />
                ))}
              </ul>
            )}
          </div>,
          document.body,
        )}
    </>
  )
}

/** A flag's sentence with its measured value ("41 items below zero"); also the store header's flag chips (941). */
export function FlagSentence({ line }: { line: FlagLine }) {
  const { t } = useTranslation('stock-console')
  return line.key === 'flag.unknown' ? (
    <Trans
      t={t}
      i18nKey="flag.unknown"
      values={{ code: line.code, value: formatFigure(line.value) }}
      components={{ c: <Ltr />, v: <Ltr /> }}
    />
  ) : (
    <Trans
      t={t}
      i18nKey={line.key}
      count={line.value ?? undefined}
      values={{ value: formatFigure(line.value) }}
      components={{ v: <Ltr /> }}
    />
  )
}

function FlagItem({ line }: { line: FlagLine }) {
  const { t } = useTranslation('stock-console')
  return (
    <li className="flex items-start gap-2" data-flag={line.code}>
      <StatusBadge sev={line.sev}>{t(line.sev === 'bad' ? 'level.Problem' : 'level.Watch')}</StatusBadge>
      <span className="flex flex-col">
        <span>
          <FlagSentence line={line} />
        </span>
        <span className="text-xs text-muted-foreground">
          {line.limit.key === 'flag.limit' ? (
            <Trans t={t} i18nKey="flag.limit" values={{ limit: formatFigure(line.limit.value) }} components={{ v: <Ltr /> }} />
          ) : (
            t('flag.limitAny')
          )}
        </span>
      </span>
    </li>
  )
}
