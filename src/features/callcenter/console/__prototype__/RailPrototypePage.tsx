/* PROTOTYPE — throwaway. Wayfinder ticket 379 (map 358). Branch
 * prototype/379-cc-rail (from 373's bdc24e7), never merges.
 *
 * Route: /prototype/callcenter-rail?variant=A|B|C|D&state=…&palette=navy&stub=1
 *
 * "Does the Call center customer rail stay, shrink, or collapse into a caller
 * header?" — four answers in the REAL ConsoleShell, under 373's chosen header
 * (D: sentence + ledger), on 362's navy tokens, beside a 56px stand-in for 363's
 * collapsed navy app rail so the width budget is the real one:
 *
 *   A  Rail as today      — 260px CustomerRail, unchanged (the control).
 *   B  Slim caller rail   — 220px; the rail keeps the CALLER jobs (lookup,
 *                           attach, sign-up, requests) and drops the address /
 *                           collecting-from block the sentence now says.
 *   C  Caller header      — no rail. One bar on top of the centre column holds
 *                           lookup → found → attached; sign-up opens in flow.
 *   D  Rail, then header  — the rail while nobody is attached (the opening move
 *                           keeps its column), collapsing into C's bar on attach.
 *
 * Attach / remove / sign-up / unlink are applied LOCALLY. `stub=1` answers the
 * member lookup (a number ending 0000 is a miss) and the signup's two calls.
 */
import { useEffect, useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { Bell, Boxes, Headset, LayoutGrid, Search, Truck } from 'lucide-react'
import type { DeliveryType, LoyaltyMember, PaymentType, SessionState } from '@/core/models/callcenter'
import PrototypeSwitcher from '@/core/ui/PrototypeSwitcher'
import ConsoleShell from '../ConsoleShell'
import CouponPicker from '../CouponPicker'
import { couponSurface } from '../coupon-view'
import CustomerRail from '../CustomerRail'
import FulfilmentPicker from '../FulfilmentPicker'
import { isPickup } from '../fulfilment-view'
import { linkedCard } from '../linked-request'
import NoteForm from '../NoteForm'
import PaymentPicker from '../PaymentPicker'
import { CLOSED_SIGNUP, codeSent, signupCreated, type SignupState } from '../signup-view'
import SlotPicker from '../SlotPicker'
import SourceForm from '../SourceForm'
import StorePicker from '../StorePicker'
import CallerBar from './CallerBar'
import { DEFAULT_RAIL_SCENARIO, FALLBACK_ADDRESS, RAIL_SCENARIOS } from './rail-mock'
import { HeaderNotes, Ledger, Sentence, type Openers } from './SentenceParts'

const VARIANTS = [
  { key: 'A', name: 'Rail as today (260px)' },
  { key: 'B', name: 'Slim caller rail (220px)' },
  { key: 'C', name: 'Caller header (Far)' },
  { key: 'D', name: 'Rail to open, header after' },
]

type Surface = 'mode' | 'payment' | 'store' | 'slot' | 'source' | 'note' | 'coupon'

const STORES: Record<string, string> = { '1101': 'Al Malqa', '1204': 'Al Yasmin', '1001': 'King AbdelAziz Road' }

function blockers(s: SessionState, add: string[], drop: string[]): SessionState['capabilities'] {
  const next = new Set(s.capabilities.submitBlockers)
  drop.forEach((b) => next.delete(b))
  add.forEach((b) => next.add(b))
  return { ...s.capabilities, submitBlockers: [...next] }
}

export default function RailPrototypePage() {
  const { t } = useTranslation('callcenter')
  const [params, setParams] = useSearchParams()
  const variant = params.get('variant') ?? 'A'
  const scenario = RAIL_SCENARIOS.find((s) => s.key === (params.get('state') ?? DEFAULT_RAIL_SCENARIO)) ?? RAIL_SCENARIOS[0]
  const lang = scenario.rtl ? 'ar' : 'en'

  const [local, setLocal] = useState<{ key: string; state: SessionState } | null>(null)
  const state = local?.key === scenario.key ? local.state : scenario.state
  const set = (next: SessionState) => setLocal({ key: scenario.key, state: { ...next, version: next.version + 1 } })
  const header = (h: Partial<SessionState['header']>, caps?: SessionState['capabilities']) =>
    set({ ...state, header: { ...state.header, ...h }, capabilities: caps ?? state.capabilities })
  const [surface, setSurface] = useState<Surface | null>(null)
  const [member, setMember] = useState<LoyaltyMember | null>(null)
  const [signup, setSignup] = useState<SignupState>(CLOSED_SIGNUP)
  const pickup = isPickup(state.header)

  useEffect(() => {
    const html = document.documentElement
    html.dir = scenario.rtl ? 'rtl' : 'ltr'
    return () => {
      html.dir = 'ltr'
    }
  }, [scenario.rtl])
  useEffect(() => {
    setSurface(null)
    setSignup(CLOSED_SIGNUP)
    setMember(null)
  }, [variant, scenario.key])

  // --- the caller verbs, applied locally ------------------------------------------
  const attach = (m: LoyaltyMember) => {
    setMember(m)
    setSignup(CLOSED_SIGNUP)
    set({
      ...state,
      header: { ...state.header, customer: { customerId: m.loyId, name: m.fullName, mobile: m.mobile, loyaltyAttached: true } },
      capabilities: { ...blockers(state, [], ['NO_CUSTOMER']), canOpenAddressBook: !pickup },
    })
  }
  const remove = () => {
    setMember(null)
    set({
      ...state,
      header: { ...state.header, customer: null, address: null, linkedRequest: null },
      capabilities: { ...blockers(state, ['NO_CUSTOMER', ...(pickup ? [] : ['NO_ADDRESS'])], []), canOpenAddressBook: false },
    })
  }
  const customerActions = { onAttach: attach, onRemove: remove, busy: false, error: null }
  const signupProp = {
    state: signup,
    actions: {
      onChange: setSignup,
      onSendCode: () => setSignup(codeSent(signup)),
      onConfirm: () =>
        setSignup(
          signupCreated(signup, {
            loyId: 'C-1000000991', mobile: signup.mobile, fullName: 'Sara Al-Ghamdi', tier: 'Blue', pointsBalance: 0, email: null,
          }),
        ),
      onCancel: () => setSignup(CLOSED_SIGNUP),
      onAttach: attach,
      sending: false,
      confirming: false,
      error: null,
    },
  }
  const card = linkedCard(state)
  const requests = {
    offer: state.header.customer && !card && scenario.openRequests > 0 ? { count: scenario.openRequests } : null,
    card,
    onView: () => toast('PROTOTYPE: opens the request picker (194), unchanged.'),
    onUnlink: () => header({ linkedRequest: null }),
  }
  const addressBook = state.capabilities.canOpenAddressBook
    ? () => toast('PROTOTYPE: opens the caller’s address book (166), unchanged.')
    : undefined

  // --- the header verbs (373's), applied locally ------------------------------------
  const setMode = (mode: DeliveryType) => {
    const collecting = mode === 'PickInStore'
    set({
      ...state,
      header: {
        ...state.header,
        deliveryType: mode,
        address: collecting ? null : (state.header.address ?? FALLBACK_ADDRESS),
        slot: collecting ? null : state.header.slot,
        plantSource: collecting ? 'chosenForPickup' : 'derivedFromAddress',
        retainedAddressLabel: collecting ? (state.header.address?.label ?? null) : null,
      },
      capabilities: collecting
        ? blockers(state, [], ['MISSING_SLOT', 'NO_ADDRESS'])
        : blockers(state, state.header.slot ? [] : ['MISSING_SLOT'], []),
    })
  }
  const close = () => setSurface(null)
  const opener = (s: Surface) => () => setSurface((cur) => (cur === s ? null : s))
  const openers: Openers = {
    mode: opener('mode'),
    payment: opener('payment'),
    store: opener('store'),
    slot: opener('slot'),
    source: opener('source'),
    reference: opener('source'),
    note: opener('note'),
    coupon: opener('coupon'),
    address: addressBook,
  }

  const railless = variant === 'C' || (variant === 'D' && state.header.customer != null)
  const showsTrace = variant !== 'A' // A keeps the rail's own "Collecting from" + trace

  const headerRow = (): ReactNode => (
    <div className="flex flex-col gap-1 border-b border-divider bg-card px-4 py-2" data-cc-chips>
      <Sentence state={state} open={openers} lang={lang} part="core" />
      <Ledger state={state} open={openers} lang={lang} />
      <HeaderNotes state={state} />
      {showsTrace && pickup && state.header.retainedAddressLabel && (
        <p className="text-[11px] text-muted-foreground" data-cc-address-retained>
          {t('rail.addressRetained', { label: state.header.retainedAddressLabel })}
        </p>
      )}
    </div>
  )

  const h = state.header
  const busy = { busy: false, error: null }
  const headerSection = (
    <>
      <FulfilmentPicker open={surface === 'mode'} current={pickup ? 'PickInStore' : 'Delivery'} pending={null} error={null}
        onPick={(m) => { setMode(m); close() }} onClose={close} />
      <PaymentPicker open={surface === 'payment'} current={h.paymentType ?? 'CashOnDelivery'} pickup={pickup}
        pending={null} error={null} onPick={(p: PaymentType) => { header({ paymentType: p }); close() }} onClose={close} />
      <StorePicker open={surface === 'store'} currentPlant={h.plant} pending={null} error={null}
        onPick={(c) => {
          header({ plant: c, plantName: STORES[c] ?? c, plantSource: 'chosenForPickup' }, blockers(state, [], ['STORE_NOT_CHOSEN']))
          close()
        }}
        onClose={close} />
      <SlotPicker open={surface === 'slot'} plant={h.plant} current={h.slot ?? null}
        apply={{
          pending: null, error: null, lapsed: false,
          onPick: (s) => {
            header({ slot: { slotId: s.slotId, from: s.from.slice(11, 16) || s.from, to: s.to.slice(11, 16) || s.to, isActive: true } },
              blockers(state, [], ['MISSING_SLOT']))
            close()
          },
        }}
        onClose={close} />
      <SourceForm open={surface === 'source'} currentSource={h.documentSource} currentReference={h.sourceReference}
        apply={{
          ...busy,
          onApply: (src, ref) => {
            header({ documentSource: src, sourceReference: ref.trim() || null },
              blockers(state, [], ['MISSING_SOURCE', ...(ref.trim() ? ['MISSING_SOURCE_REFERENCE'] : [])]))
            close()
          },
        }}
        onClose={close} />
      <NoteForm open={surface === 'note'} current={h.orderNote}
        apply={{ ...busy, onApply: (n) => { header({ orderNote: n?.trim() ? n : null }); close() } }} onClose={close} />
      <CouponPicker open={surface === 'coupon'} surface={couponSurface(h, state.capabilities)} pendingApply={false}
        pendingRemove={null} applyError={null} removeError={null}
        onApply={(code) => code.trim() && header({ coupons: [...(h.coupons ?? []), { code: code.trim().toUpperCase(), description: null, amount: 0 }] })}
        onRemove={(code) => header({ coupons: (h.coupons ?? []).filter((c) => c.code !== code) })}
        onClose={close} />
    </>
  )

  const protoRail =
    variant === 'A'
      ? undefined
      : variant === 'B'
        ? {
            cols: '220px minmax(0,1fr) 320px',
            rail: (
              <CustomerRail state={state} customerActions={customerActions} signup={signupProp} requests={requests}
                onPickAddress={addressBook} protoNoWhere />
            ),
          }
        : railless
          ? {
              cols: 'minmax(0,1fr) 320px',
              rail: null,
              bar: <CallerBar state={state} member={member} actions={customerActions} signup={signupProp} requests={requests} />,
              callerHint: '— in the caller bar above',
            }
          : {
              cols: '260px minmax(0,1fr) 320px',
              rail: (
                <CustomerRail state={state} customerActions={customerActions} signup={signupProp} requests={requests}
                  onPickAddress={addressBook} protoNoWhere />
              ),
            }

  const NOOP = () => {}
  return (
    <div className="flex h-[calc(100vh-3.5rem)] overflow-hidden" data-proto-variant={variant} data-proto-state={scenario.key}>
      <AppRailStandIn />
      <div className="min-w-0 flex-1" data-proto-console>
        <ConsoleShell
          state={state}
          headerRow={headerRow}
          protoRail={protoRail}
          customerActions={customerActions}
          signup={signupProp}
          requests={requests}
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
          onPickAddress={addressBook}
          submit={{ placing: false, outcome: null, failure: null }}
          headerSection={headerSection}
          headerSectionOpen={surface !== null}
        />
      </div>
      <PrototypeSwitcher
        variants={VARIANTS}
        variant={variant}
        onVariant={(k) => {
          const next = new URLSearchParams(params)
          next.set('variant', k)
          setParams(next, { replace: true })
        }}
        scenarios={RAIL_SCENARIOS.map(({ key, label, proves }) => ({ key, label, proves }))}
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

/** 363's collapsed navy rail, as a 56px stand-in — chrome, not a control. */
function AppRailStandIn() {
  const icons = [LayoutGrid, Truck, Boxes, Headset, Search, Bell]
  return (
    <nav
      aria-hidden
      className="flex w-14 shrink-0 flex-col items-center gap-4 py-3"
      style={{ background: '#002554', color: 'rgba(255,255,255,.72)' }}
      data-proto-app-rail
    >
      {icons.map((Icon, i) => (
        <span key={i} className="relative flex h-8 w-8 items-center justify-center rounded-md" style={i === 3 ? { background: 'rgba(255,255,255,.12)', color: '#fff' } : undefined}>
          {i === 3 && <span className="absolute inset-y-1 -start-3 w-[3px] rounded-full" style={{ background: '#FDC801' }} />}
          <Icon className="h-[18px] w-[18px]" />
        </span>
      ))}
    </nav>
  )
}
