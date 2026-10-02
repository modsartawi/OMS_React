/* PROTOTYPE — throwaway. Wayfinder ticket 373 (map 358). Never merges.
 *
 * The order header as a SENTENCE of slots, drawn four ways over ONE model:
 * `headerChips()` — the shipped pure module — still decides every slot's state
 * (settled / needsAttention off the server's submitBlockers / unset), its value
 * and its derived/lapsed flags. Only the RENDERING changes. That is the first
 * thing this prototype is checking: the sentence replaces `ChipRow`, not
 * `header-chips.ts`.
 *
 * ⚠ Copy here is a prototype-local table (EN + unreviewed AR), not callcenter.json.
 * The production shape is one i18n key per sentence with NAMED slot tags —
 * `"<mode/> to <address/> for <customer/> …"` — so a translation owns word
 * order. `fill()` below is a stand-in for react-i18next's <Trans components>.
 */
import { Fragment, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { SessionState } from '@/core/models/callcenter'
import Ltr from '@/core/ui/Ltr'
import { headerChips, type HeaderChip } from '../header-chips'
import { capabilityGate, isPickup } from '../fulfilment-view'

// --- copy (prototype-local) ---------------------------------------------------

type Lang = 'en' | 'ar'

const COPY = {
  en: {
    delivery: '<mode/> to <address/> for <customer/> from <store/> at <slot/>, <payment/>.',
    pickup: '<mode/> from <store/> for <customer/>, <payment/>.',
    tail: 'Logged as <source/> <reference/>. <coupon/> <note/>',
    mode: { delivery: 'Deliver', pickInStore: 'Collect' },
    payment: { cashOnDelivery: 'cash on delivery', payOnCollection: 'pay on collection', paidOnline: 'paid online' },
    unset: {
      address: 'choose an address',
      slot: 'choose a slot',
      store: 'choose a store',
      source: 'choose a source',
      reference: 'add a reference',
      customer: 'no caller yet',
      coupon: '+ coupon',
      note: '+ note',
    },
    seeded: 'not chosen',
    derived: 'Follows the address. Change the address to move it.',
    readback: 'Read back',
    ledger: { source: 'Source', reference: 'Ref', coupon: 'Coupon', note: 'Note' },
  },
  ar: {
    delivery: '<mode/> إلى <address/> لـ<customer/> من <store/> في <slot/>، <payment/>.',
    pickup: '<mode/> من <store/> لـ<customer/>، <payment/>.',
    tail: 'مسجّل كـ<source/> <reference/>. <coupon/> <note/>',
    mode: { delivery: 'توصيل', pickInStore: 'استلام' },
    payment: { cashOnDelivery: 'الدفع عند التوصيل', payOnCollection: 'الدفع عند الاستلام', paidOnline: 'مدفوع إلكترونيًا' },
    unset: {
      address: 'اختر عنوانًا',
      slot: 'اختر موعدًا',
      store: 'اختر فرعًا',
      source: 'اختر المصدر',
      reference: 'أضف مرجعًا',
      customer: 'لا يوجد متصل بعد',
      coupon: '+ قسيمة',
      note: '+ ملاحظة',
    },
    seeded: 'لم يُختر',
    derived: 'يتبع العنوان. غيّر العنوان لنقله.',
    readback: 'للتأكيد',
    ledger: { source: 'المصدر', reference: 'المرجع', coupon: 'القسيمة', note: 'ملاحظة' },
  },
} as const

export type SlotId = 'mode' | 'address' | 'customer' | 'store' | 'slot' | 'payment' | 'source' | 'reference' | 'coupon' | 'note'

/** Split `"<a/> to <b/>"` into text runs and named slots — what <Trans> does. */
function fill(template: string, slots: Partial<Record<SlotId, ReactNode>>): ReactNode[] {
  return template.split(/(<[a-z]+\/>)/).map((part, i) => {
    const m = /^<([a-z]+)\/>$/.exec(part)
    if (!m) return <Fragment key={i}>{part}</Fragment>
    return <Fragment key={i}>{slots[m[1] as SlotId] ?? null}</Fragment>
  })
}

// --- the slot model: headerChips() + the two facts the rail owns ---------------

interface Slot {
  id: SlotId
  tone: 'settled' | 'needsAttention' | 'unset' | 'readout' | 'optional'
  value: ReactNode
  /** Absent ⇒ not a control (a readout, or a shut gate). */
  onOpen?: () => void
  title?: string
}

export type Openers = Partial<Record<SlotId, (() => void) | undefined>>

function slotsOf(state: SessionState, open: Openers, lang: Lang): Record<SlotId, Slot> {
  const c = COPY[lang]
  const chips = Object.fromEntries(headerChips(state.header, state.capabilities).map((ch) => [ch.id, ch])) as Partial<
    Record<HeaderChip['id'], HeaderChip>
  >
  const h = state.header
  const pickup = isPickup(h)
  const blockers = new Set(state.capabilities.submitBlockers)
  const tone = (ch: HeaderChip | undefined, optional = false): Slot['tone'] =>
    ch?.state === 'needsAttention' ? 'needsAttention' : ch?.state === 'settled' ? 'settled' : optional ? 'optional' : 'unset'
  const gate = capabilityGate(state.capabilities, 'canChangeFulfilment')
  const payGate = capabilityGate(state.capabilities, 'canChangePaymentType')

  const store = chips.store
  const seeded = blockers.has('STORE_NOT_CHOSEN')
  return {
    mode: {
      id: 'mode',
      tone: 'settled',
      value: pickup ? c.mode.pickInStore : c.mode.delivery,
      onOpen: gate.open ? open.mode : undefined,
    },
    customer: {
      id: 'customer',
      // The rail owns the caller; in the sentence the name is a WORD, never a control.
      tone: h.customer ? 'readout' : 'needsAttention',
      value: h.customer ? <bdi className="font-semibold text-foreground">{h.customer.name}</bdi> : c.unset.customer,
    },
    address: {
      id: 'address',
      tone: h.address ? 'settled' : blockers.has('NO_ADDRESS') ? 'needsAttention' : 'unset',
      value: h.address ? (
        <bdi>
          {h.address.label} · {h.address.districtName}, {h.address.cityName}
        </bdi>
      ) : (
        c.unset.address
      ),
      onOpen: h.customer ? open.address : undefined,
    },
    store: {
      id: 'store',
      tone: !pickup && store?.derived ? 'readout' : tone(store),
      value: h.plant ? (
        <>
          <Ltr>
            <span className="font-mono text-[0.92em]">{h.plant}</span>
          </Ltr>{' '}
          · <bdi>{h.plantName}</bdi>
          {seeded && <span className="ms-1 text-[0.8em] font-normal opacity-80">({c.seeded})</span>}
        </>
      ) : (
        c.unset.store
      ),
      onOpen: pickup ? open.store : undefined,
      title: !pickup && store?.derived ? c.derived : undefined,
    },
    slot: {
      id: 'slot',
      tone: tone(chips.slot),
      value: h.slot ? (
        <Ltr>
          {h.slot.from}–{h.slot.to}
        </Ltr>
      ) : (
        c.unset.slot
      ),
      onOpen: open.slot,
    },
    payment: {
      id: 'payment',
      tone: 'settled',
      value: chips.payment?.valueKey ? c.payment[chips.payment.valueKey as keyof typeof c.payment] : '—',
      onOpen: payGate.open ? open.payment : undefined,
    },
    source: {
      id: 'source',
      tone: tone(chips.source),
      value: h.documentSource ? <span className="font-mono text-[0.92em]">{h.documentSource}</span> : c.unset.source,
      onOpen: open.source,
    },
    reference: {
      id: 'reference',
      tone: tone(chips.reference),
      value: h.sourceReference ? (
        <Ltr>
          <span className="font-mono text-[0.92em]">{h.sourceReference}</span>
        </Ltr>
      ) : (
        c.unset.reference
      ),
      onOpen: open.reference ?? open.source,
    },
    coupon: {
      id: 'coupon',
      tone: chips.coupon?.value ? 'settled' : 'optional',
      value: chips.coupon?.value ? <Ltr><span className="font-mono text-[0.92em]">{chips.coupon.value}</span></Ltr> : c.unset.coupon,
      onOpen: open.coupon,
    },
    note: {
      id: 'note',
      tone: h.orderNote?.trim() ? 'settled' : 'optional',
      value: h.orderNote?.trim() ? (
        <bdi className="inline-block max-w-[18rem] truncate align-bottom">“{h.orderNote}”</bdi>
      ) : (
        c.unset.note
      ),
      onOpen: open.note,
    },
  }
}

// --- one slot, drawn -----------------------------------------------------------

const TONE: Record<Slot['tone'], string> = {
  settled: 'border-border-strong bg-card text-foreground hover:border-primary',
  needsAttention: 'border-dashed border-attention-border bg-attention-050 text-attention-800 hover:border-attention-800',
  unset: 'border-dashed border-input bg-card text-muted-foreground hover:border-primary',
  optional: 'border-transparent bg-transparent text-muted-foreground hover:border-input',
  readout: '',
}

function SlotWord({
  slot,
  expanded,
  popover,
  buttonRef,
}: {
  slot: Slot
  expanded?: boolean
  popover?: ReactNode
  buttonRef?: (el: HTMLButtonElement | null) => void
}) {
  if (slot.tone === 'readout' || !slot.onOpen)
    return (
      <span
        data-proto-slot={slot.id}
        title={slot.title}
        className={
          slot.tone === 'needsAttention'
            ? 'rounded-md border border-dashed border-attention-border bg-attention-050 px-1.5 text-attention-800'
            : 'font-medium text-foreground ' + (slot.title ? 'cursor-help underline decoration-dotted decoration-from-font underline-offset-4' : '')
        }
      >
        {slot.value}
      </span>
    )
  return (
    <span className="relative inline-block">
      <button
        ref={buttonRef}
        type="button"
        onClick={slot.onOpen}
        data-proto-slot={slot.id}
        aria-expanded={expanded}
        aria-haspopup={popover !== undefined ? 'dialog' : undefined}
        className={
          'rounded-md border px-1.5 py-px font-medium leading-6 outline-none focus-visible:ring-2 focus-visible:ring-ring ' +
          TONE[slot.tone] +
          (expanded ? ' border-primary ring-2 ring-primary-050' : '')
        }
      >
        {slot.value}
      </button>
      {popover}
    </span>
  )
}

// --- the sentence ---------------------------------------------------------------

export function Sentence({
  state,
  open,
  lang,
  expanded,
  part = 'both',
  popoverFor,
}: {
  state: SessionState
  open: Openers
  lang: Lang
  expanded?: SlotId | null
  part?: 'core' | 'both'
  popoverFor?: (id: SlotId, close: () => void, returnFocus: () => void) => ReactNode
}) {
  const c = COPY[lang]
  const slots = slotsOf(state, open, lang)
  const buttons = useRef<Partial<Record<SlotId, HTMLButtonElement | null>>>({})
  const word = (id: SlotId) => (
    <SlotWord
      slot={slots[id]}
      expanded={expanded === id}
      buttonRef={(el) => {
        buttons.current[id] = el
      }}
      popover={
        expanded === id && popoverFor
          ? popoverFor(id, () => undefined, () => buttons.current[id]?.focus())
          : undefined
      }
    />
  )
  const all = Object.fromEntries((Object.keys(slots) as SlotId[]).map((id) => [id, word(id)])) as Record<SlotId, ReactNode>
  return (
    <div className="text-[14px] leading-8 text-muted-foreground" data-proto-sentence>
      <p>{fill(isPickup(state.header) ? c.pickup : c.delivery, all)}</p>
      {part === 'both' && <p className="text-[13px]">{fill(c.tail, all)}</p>}
    </div>
  )
}

/** The flat, non-interactive read-back (variant C). */
export function ReadBack({ state, lang }: { state: SessionState; lang: Lang }) {
  const c = COPY[lang]
  const slots = slotsOf(state, {}, lang)
  const plain = Object.fromEntries(
    (Object.keys(slots) as SlotId[]).map((id) => [
      id,
      <span
        key={id}
        className={slots[id].tone === 'needsAttention' || slots[id].tone === 'unset' ? 'text-attention-800 italic' : 'font-medium text-foreground'}
      >
        {slots[id].value}
      </span>,
    ]),
  ) as Record<SlotId, ReactNode>
  return (
    <div className="flex items-baseline gap-2 border-b border-divider bg-card-2 px-4 py-1.5 text-[13px] text-muted-foreground" data-proto-readback>
      <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide">{c.readback}</span>
      <p>{fill(isPickup(state.header) ? c.pickup : c.delivery, plain)}</p>
    </div>
  )
}

/** Variant D's bookkeeping row: labelled fields, not prose. */
export function Ledger({ state, open, lang }: { state: SessionState; open: Openers; lang: Lang }) {
  const c = COPY[lang]
  const slots = slotsOf(state, open, lang)
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px]" data-proto-ledger>
      {(['source', 'reference', 'coupon', 'note'] as const).map((id) => {
        const s = slots[id]
        const attention = s.tone === 'needsAttention'
        return (
          <button
            key={id}
            type="button"
            onClick={s.onOpen}
            disabled={!s.onOpen}
            data-proto-slot={id}
            className={
              'flex max-w-[22rem] items-baseline gap-1.5 rounded-md px-1 py-0.5 outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring ' +
              (attention ? 'text-attention-800' : 'text-foreground')
            }
          >
            <span className="text-[10.5px] uppercase tracking-wide text-muted-foreground">{c.ledger[id]}</span>
            <span className={'truncate ' + (attention ? 'border-b border-dashed border-attention-border' : s.tone === 'settled' ? 'font-medium' : 'text-muted-foreground')}>
              {s.value}
            </span>
          </button>
        )
      })}
    </div>
  )
}

/** The lines the chip row says under itself today — kept, said once. */
export function HeaderNotes({ state }: { state: SessionState }) {
  const { t } = useTranslation('callcenter')
  const gate = capabilityGate(state.capabilities, 'canChangeFulfilment')
  const lapsed = state.header.slot && !state.header.slot.isActive
  return (
    <>
      {lapsed && <p className="text-[11px] text-attention-800">{t('slot.lapsedWarning')}</p>}
      {!gate.open && (
        <p className="text-[11px] text-muted-foreground">
          {t(gate.reason ? `fulfilment.locked.${gate.reason}` : 'fulfilment.locked.unknown', {
            defaultValue: t('fulfilment.locked.unknown'),
          })}
        </p>
      )}
    </>
  )
}

// --- variant B's anchored popover -------------------------------------------------

export interface PopOption {
  key: string
  label: ReactNode
  hint?: ReactNode
  current?: boolean
  disabled?: boolean
}

/**
 * An in-place listbox under the word. ↑↓ move, Enter picks, Esc / Tab / outside
 * click close, focus returns to the word. No single letters (365).
 */
export function Popover({
  title,
  options,
  onPick,
  onClose,
  returnFocus,
  input,
}: {
  title: string
  options?: PopOption[]
  onPick?: (key: string) => void
  onClose: () => void
  returnFocus: () => void
  input?: { placeholder: string; initial: string; multiline?: boolean; onSubmit: (v: string) => void }
}) {
  const box = useRef<HTMLDivElement>(null)
  const [cur, setCur] = useState(() => Math.max(0, options?.findIndex((o) => o.current) ?? 0))
  const [text, setText] = useState(input?.initial ?? '')
  const close = () => {
    onClose()
    returnFocus()
  }
  useLayoutEffect(() => {
    const first = box.current?.querySelector<HTMLElement>(input ? 'input,textarea' : '[aria-selected="true"]')
    first?.focus()
  }, [input])
  useEffect(() => {
    const away = (e: MouseEvent) => {
      if (box.current && !box.current.parentElement?.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', away)
    return () => document.removeEventListener('mousedown', away)
  }, [onClose])
  useEffect(() => {
    box.current?.querySelector<HTMLElement>(`[data-i="${cur}"]`)?.focus()
  }, [cur])

  return (
    <div
      ref={box}
      role="dialog"
      aria-label={title}
      onKeyDown={(e) => {
        e.stopPropagation()
        if (e.key === 'Escape') {
          e.preventDefault()
          close()
        }
        if (!options) return
        if (e.key === 'ArrowDown') {
          e.preventDefault()
          setCur((i) => Math.min(options.length - 1, i + 1))
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault()
          setCur((i) => Math.max(0, i - 1))
        }
        if (e.key === 'Tab') onClose()
      }}
      className="absolute start-0 top-full z-40 mt-1 min-w-64 rounded-lg border border-border bg-card p-1 text-[13px] leading-normal text-foreground shadow-[0_10px_30px_rgb(16_24_40/.16)]"
    >
      <div className="flex items-center justify-between px-2 pb-1 pt-0.5 text-[11px] text-muted-foreground">
        <span>{title}</span>
        <kbd className="rounded border border-border px-1 font-mono text-[10px]">Esc</kbd>
      </div>
      {options && (
        <div role="listbox" aria-label={title}>
          {options.map((o, i) => (
            <button
              key={o.key}
              type="button"
              role="option"
              data-i={i}
              aria-selected={i === cur}
              aria-disabled={o.disabled || undefined}
              tabIndex={i === cur ? 0 : -1}
              onClick={() => {
                if (o.disabled) return
                onPick?.(o.key)
                close()
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  if (!o.disabled) {
                    onPick?.(o.key)
                    close()
                  }
                }
              }}
              className={
                'flex w-full items-baseline gap-2 rounded-md px-2 py-1.5 text-start outline-none aria-disabled:opacity-50 ' +
                (i === cur ? 'bg-primary-050' : 'hover:bg-accent')
              }
            >
              <span className="w-3 text-primary">{o.current ? '✓' : ''}</span>
              <span className="flex-1">{o.label}</span>
              {o.hint && <span className="text-[11px] text-muted-foreground">{o.hint}</span>}
            </button>
          ))}
        </div>
      )}
      {input && (
        <form
          className="flex flex-col gap-1.5 p-1"
          onSubmit={(e) => {
            e.preventDefault()
            input.onSubmit(text)
            close()
          }}
        >
          {input.multiline ? (
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={input.placeholder}
              rows={3}
              dir="auto"
              className="w-72 rounded-md border border-input bg-card px-2 py-1 outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          ) : (
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={input.placeholder}
              dir="auto"
              className="h-7 w-64 rounded-md border border-input bg-card px-2 outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          )}
          <button type="submit" className="self-end rounded-md bg-primary px-2.5 py-1 text-[12px] text-primary-foreground">
            OK ↵
          </button>
        </form>
      )}
    </div>
  )
}
