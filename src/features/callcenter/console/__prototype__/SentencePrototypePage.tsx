/* PROTOTYPE — throwaway. Wayfinder ticket 373 (map 358). Branch
 * prototype/373-cc-sentence, never merges.
 *
 * Route: /prototype/callcenter-sentence?variant=A|B|C|D&state=…&palette=navy&stub=1
 *
 * Four answers to "is the Call center order header a sentence of editable slots?",
 * mounted in the REAL ConsoleShell (176's pattern) on 362's navy tokens:
 *
 *   A  Sentence · sections — the sentence replaces the chip row; a slot opens the
 *      SAME in-flow section a chip opens today (175 §9).
 *   B  Sentence · popovers — Far as drawn: a slot opens an anchored popover in place.
 *   C  Chips + read-back   — the chips stay the controls; the sentence is a quiet,
 *      non-interactive line to read back to the caller.
 *   D  Sentence + ledger   — caller-facing facts as a sentence; source / ref /
 *      coupon / note as a labelled bookkeeping row under it.
 *
 * Every pick is applied LOCALLY (no SIS.Api). `stub=1` answers the three
 * lookup reads the real StorePicker / SlotPicker / SourceForm make.
 */
import { useEffect, useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import type { DeliveryType, PaymentType, SessionState } from '@/core/models/callcenter'
import PrototypeSwitcher from '@/core/ui/PrototypeSwitcher'
import ConsoleShell from '../ConsoleShell'
import CouponPicker from '../CouponPicker'
import { couponSurface } from '../coupon-view'
import FulfilmentPicker from '../FulfilmentPicker'
import { isPickup } from '../fulfilment-view'
import NoteForm from '../NoteForm'
import PaymentPicker from '../PaymentPicker'
import SlotPicker from '../SlotPicker'
import SourceForm from '../SourceForm'
import StorePicker from '../StorePicker'
import { DEFAULT_SCENARIO, SCENARIOS } from './sentence-mock'
import { HeaderNotes, Ledger, Popover, ReadBack, Sentence, type Openers, type PopOption, type SlotId } from './SentenceParts'

const VARIANTS = [
  { key: 'A', name: 'Sentence · sections' },
  { key: 'B', name: 'Sentence · popovers (Far)' },
  { key: 'C', name: 'Chips + read-back' },
  { key: 'D', name: 'Sentence + ledger' },
]

type Surface = 'mode' | 'payment' | 'store' | 'slot' | 'source' | 'reference' | 'note' | 'coupon' | 'address'

const STORES = [
  ['1101', 'Al Malqa'],
  ['1204', 'Al Yasmin'],
  ['1001', 'King AbdelAziz Road'],
] as const
const WINDOWS = [
  ['2026-10-02#S2', 'Fri 2 Oct', '15:00', '18:00', false],
  ['2026-10-02#S3', 'Fri 2 Oct', '18:00', '21:00', true],
  ['2026-10-02#S4', 'Fri 2 Oct', '21:00', '23:00', true],
  ['2026-10-03#S2', 'Sat 3 Oct', '15:00', '18:00', true],
] as const

function drop(s: SessionState, ...codes: string[]): SessionState['capabilities'] {
  return { ...s.capabilities, submitBlockers: s.capabilities.submitBlockers.filter((b) => !codes.includes(b)) }
}

export default function SentencePrototypePage() {
  const { t } = useTranslation('callcenter')
  const [params, setParams] = useSearchParams()
  const variant = params.get('variant') ?? 'A'
  const scenario = SCENARIOS.find((s) => s.key === (params.get('state') ?? DEFAULT_SCENARIO)) ?? SCENARIOS[0]
  const lang = scenario.rtl ? 'ar' : 'en'

  const [local, setLocal] = useState<{ key: string; state: SessionState } | null>(null)
  const state = local?.key === scenario.key ? local.state : scenario.state
  const set = (next: SessionState) => setLocal({ key: scenario.key, state: { ...next, version: next.version + 1 } })
  const header = (h: Partial<SessionState['header']>, caps?: SessionState['capabilities']) =>
    set({ ...state, header: { ...state.header, ...h }, capabilities: caps ?? state.capabilities })
  const [surface, setSurface] = useState<Surface | null>(null)
  const pickup = isPickup(state.header)

  useEffect(() => {
    const html = document.documentElement
    html.dir = scenario.rtl ? 'rtl' : 'ltr'
    return () => {
      html.dir = 'ltr'
    }
  }, [scenario.rtl])
  useEffect(() => setSurface(null), [variant, scenario.key])

  // --- the verbs, applied locally ---------------------------------------------------
  const setMode = (mode: DeliveryType) => {
    const collecting = mode === 'PickInStore'
    const base = SCENARIOS[0].state.header
    set({
      ...state,
      header: {
        ...state.header,
        deliveryType: mode,
        address: collecting ? null : (state.header.address ?? base.address),
        slot: collecting ? null : state.header.slot,
        plantSource: collecting ? 'chosenForPickup' : 'derivedFromAddress',
      },
      capabilities: collecting
        ? drop(state, 'MISSING_SLOT')
        : {
            ...state.capabilities,
            submitBlockers: state.header.slot
              ? state.capabilities.submitBlockers
              : [...new Set([...state.capabilities.submitBlockers, 'MISSING_SLOT'])],
          },
    })
  }
  const setPayment = (p: PaymentType) => header({ paymentType: p })
  const setStore = (code: string) =>
    header(
      { plant: code, plantName: STORES.find((s) => s[0] === code)?.[1] ?? code, plantSource: 'chosenForPickup' },
      drop(state, 'STORE_NOT_CHOSEN'),
    )
  const setSlot = (slotId: string, from: string, to: string) =>
    header({ slot: { slotId, from, to, isActive: true } }, drop(state, 'MISSING_SLOT'))
  const setSource = (src: string, ref: string) =>
    header(
      { documentSource: src, sourceReference: ref.trim() || null },
      drop(state, 'MISSING_SOURCE', ...(ref.trim() ? ['MISSING_SOURCE_REFERENCE'] : [])),
    )
  const setNote = (note: string | null) => header({ orderNote: note?.trim() ? note : null })
  const addCoupon = (code: string) =>
    code.trim() &&
    header(
      { coupons: [...(state.header.coupons ?? []), { code: code.trim().toUpperCase(), description: null, amount: 0 }] },
      { ...state.capabilities, canRemoveCoupon: true },
    )
  const removeCoupon = (code: string) => header({ coupons: (state.header.coupons ?? []).filter((c) => c.code !== code) })

  // --- who opens what ---------------------------------------------------------------
  const opener = (s: Surface) => () => setSurface((cur) => (cur === s ? null : s))
  const openers: Openers = {
    mode: opener('mode'),
    payment: opener('payment'),
    store: opener('store'),
    slot: opener('slot'),
    source: opener('source'),
    reference: variant === 'B' ? opener('reference') : opener('source'),
    note: opener('note'),
    coupon: opener('coupon'),
    address: variant === 'B' ? opener('address') : () => toast('PROTOTYPE: opens the rail’s address book (166), unchanged.'),
  }
  const sections = variant !== 'B'

  // --- B: what each popover holds ---------------------------------------------------------
  const popoverFor = (id: SlotId, _close: () => void, returnFocus: () => void): ReactNode => {
    const close = () => setSurface(null)
    const common = { onClose: close, returnFocus }
    const h = state.header
    switch (id) {
      case 'mode':
        return (
          <Popover {...common} title={t('fulfilment.title', { defaultValue: 'Delivering, or collecting?' })}
            options={[
              { key: 'Delivery', label: t('chips.value.delivery'), current: !pickup },
              { key: 'PickInStore', label: t('chips.value.pickInStore'), current: pickup },
            ]}
            onPick={(k) => setMode(k as DeliveryType)} />
        )
      case 'payment':
        return (
          <Popover {...common} title="How are they paying?"
            options={[
              { key: 'CashOnDelivery', label: t(pickup ? 'chips.value.payOnCollection' : 'chips.value.cashOnDelivery'), current: h.paymentType === 'CashOnDelivery' },
              { key: 'Online', label: t('chips.value.paidOnline'), current: h.paymentType === 'Online' },
            ]}
            onPick={(k) => setPayment(k as PaymentType)} />
        )
      case 'store':
        return (
          <Popover {...common} title="Collection store"
            options={STORES.map(([code, name]) => ({ key: code, label: `${code} · ${name}`, current: code === h.plant }))}
            onPick={setStore} />
        )
      case 'slot':
        return (
          <Popover {...common} title={`Windows at store ${h.plant}`}
            options={WINDOWS.map(([slotId, day, from, to, free]): PopOption => ({
              key: slotId, label: `${from}–${to}`, hint: free ? day : `${day} · full`, disabled: !free, current: h.slot?.slotId === slotId,
            }))}
            onPick={(k) => {
              const w = WINDOWS.find((x) => x[0] === k)!
              setSlot(w[0], w[2], w[3])
            }} />
        )
      case 'source':
        return (
          <Popover {...common} title="Document source"
            options={[
              { key: 'CLCN', label: 'CLCN · Call center', current: h.documentSource === 'CLCN' },
              { key: 'WHTS', label: 'WHTS · WhatsApp', current: h.documentSource === 'WHTS' },
            ]}
            onPick={(k) => setSource(k, h.sourceReference ?? '')} />
        )
      case 'reference':
        return (
          <Popover {...common} title="Source reference"
            input={{ placeholder: 'CRM-…', initial: h.sourceReference ?? '', onSubmit: (v) => setSource(h.documentSource ?? 'CLCN', v) }} />
        )
      case 'note':
        return (
          <Popover {...common} title="Order note"
            input={{ placeholder: 'What the caller asked for', initial: h.orderNote ?? '', multiline: true, onSubmit: (v) => setNote(v) }} />
        )
      case 'coupon':
        return (h.coupons ?? []).length ? (
          <Popover {...common} title="Coupon"
            options={(h.coupons ?? []).map((c) => ({ key: c.code, label: `Remove ${c.code}` }))}
            onPick={removeCoupon} />
        ) : (
          <Popover {...common} title="Coupon" input={{ placeholder: 'Coupon code', initial: '', onSubmit: addCoupon }} />
        )
      case 'address':
        return (
          <Popover {...common} title="The caller's addresses"
            options={[
              { key: 'home', label: 'Home · Al Malqa, Riyadh', current: true },
              { key: 'work', label: 'Work · Al Olaya, Riyadh' },
              { key: 'new', label: '+ New address…' },
            ]}
            onPick={() => toast('PROTOTYPE: re-derives the store (166).')} />
        )
      default:
        return null
    }
  }

  // --- the header row per variant ----------------------------------------------------------
  const headerRow = (chipRow: ReactNode): ReactNode => {
    if (variant === 'C')
      return (
        <>
          {chipRow}
          <ReadBack state={state} lang={lang} />
        </>
      )
    if (variant === 'D')
      return (
        <div className="flex flex-col gap-1 border-b border-divider bg-card px-4 py-2" data-cc-chips>
          <Sentence state={state} open={openers} lang={lang} part="core" />
          <Ledger state={state} open={openers} lang={lang} />
          <HeaderNotes state={state} />
        </div>
      )
    return (
      <div className="border-b border-divider bg-card px-4 py-2" data-cc-chips>
        <Sentence
          state={state}
          open={openers}
          lang={lang}
          expanded={variant === 'B' ? (surface as SlotId | null) : null}
          popoverFor={variant === 'B' ? popoverFor : undefined}
        />
        <HeaderNotes state={state} />
      </div>
    )
  }

  const NOOP = () => {}
  const closeSection = () => setSurface(null)
  const busy = { busy: false, error: null }
  const headerSection = sections ? (
    <>
      <FulfilmentPicker open={surface === 'mode'} current={pickup ? 'PickInStore' : 'Delivery'} pending={null} error={null}
        onPick={(m) => { setMode(m); closeSection() }} onClose={closeSection} />
      <PaymentPicker open={surface === 'payment'} current={state.header.paymentType ?? 'CashOnDelivery'} pickup={pickup}
        pending={null} error={null} onPick={(p) => { setPayment(p); closeSection() }} onClose={closeSection} />
      <StorePicker open={surface === 'store'} currentPlant={state.header.plant} pending={null} error={null}
        onPick={(c) => { setStore(c); closeSection() }} onClose={closeSection} />
      <SlotPicker open={surface === 'slot'} plant={state.header.plant} current={state.header.slot ?? null}
        apply={{ pending: null, error: null, lapsed: false, onPick: (s) => { setSlot(s.slotId, s.from.slice(11, 16) || s.from, s.to.slice(11, 16) || s.to); closeSection() } }}
        onClose={closeSection} />
      <SourceForm open={surface === 'source'} currentSource={state.header.documentSource} currentReference={state.header.sourceReference}
        apply={{ ...busy, onApply: (s, r) => { setSource(s, r); closeSection() } }} onClose={closeSection} />
      <NoteForm open={surface === 'note'} current={state.header.orderNote}
        apply={{ ...busy, onApply: (n) => { setNote(n); closeSection() } }} onClose={closeSection} />
      <CouponPicker open={surface === 'coupon'} surface={couponSurface(state.header, state.capabilities)} pendingApply={false}
        pendingRemove={null} applyError={null} removeError={null} onApply={addCoupon} onRemove={removeCoupon} onClose={closeSection} />
    </>
  ) : null

  return (
    <div className="h-[calc(100vh-3.5rem)] w-screen overflow-hidden" data-proto-variant={variant} data-proto-state={scenario.key}>
      <ConsoleShell
        state={state}
        headerRow={headerRow}
        customerActions={{ onAttach: NOOP, onRemove: NOOP, busy: false, error: null }}
        addItem={{ onAdd: null, pending: null, landed: 0, error: null, dismissError: NOOP }}
        guidance={{ onAdd: null, pending: null, outcome: null, dismissOutcome: NOOP, onSearchRest: NOOP }}
        lineEdit={null}
        onChangeFulfilment={openers.mode}
        onChangePayment={openers.payment}
        onChangeStore={pickup ? openers.store : undefined}
        onChangeSlot={openers.slot}
        onChangeSource={openers.source}
        onChangeNote={openers.note}
        onChangeCoupon={openers.coupon}
        onPickAddress={() => toast('PROTOTYPE: opens the rail’s address book (166), unchanged.')}
        submit={{ placing: false, outcome: null, failure: null }}
        headerSection={headerSection}
        headerSectionOpen={sections && surface !== null}
      />
      <PrototypeSwitcher
        variants={VARIANTS}
        variant={variant}
        onVariant={(k) => {
          const next = new URLSearchParams(params)
          next.set('variant', k)
          setParams(next, { replace: true })
        }}
        scenarios={SCENARIOS.map(({ key, label, proves }) => ({ key, label, proves }))}
        scenario={scenario.key}
        onScenario={(k) => {
          setLocal(null)
          const next = new URLSearchParams(params)
          next.set('state', k)
          setParams(next, { replace: true })
        }}
      />
    </div>
  )
}
