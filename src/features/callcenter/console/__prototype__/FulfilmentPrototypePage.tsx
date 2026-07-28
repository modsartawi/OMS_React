/* PROTOTYPE — throwaway. Wayfinder ticket 176 (map 126).
 *
 * Route: /prototype/callcenter-fulfilment?state=…
 *
 * 🚩 **It mounts the REAL `ConsoleShell`, not a host that looks like it.** 177's
 * lesson, taken literally: driving the real projection through the real
 * components found two client defects an illustration could never have — and
 * this ticket's whole subject is what the SHIPPED console does when
 * `deliveryType` flips, which a hand-drawn host would answer by construction.
 * Everything below the switcher is the console tickets 161–174 built; the only
 * things this file supplies are the state and the no-op verbs.
 *
 * 🚩 It lives INSIDE `console/` rather than beside the other three prototypes,
 * and that is not tidiness: the import-boundary gate treats
 * `callcenter/__prototype__` and `callcenter/console` as two features, so a
 * prototype in the usual place **cannot import the console it is about**. That
 * rule is why 135's and 138's prototypes each re-drew the console as a
 * `HostConsole` — and why 177 then found two defects in the real one that no
 * illustration could have surfaced.
 *
 * There is **no variant axis**, deliberately. 175 already put four arrangements
 * of this region to the owner and ruled one (variant 4: a chip bar at rest, a
 * section when one opens), and spec 160's build settled where a chip opens TO —
 * a modal, like every other chip. What is genuinely open here is not the
 * arrangement but the CONSEQUENCES of the flip, and a consequence is judged
 * against the one arrangement that won, not against three that did not.
 */
import { useState } from 'react'
import { useSearchParams } from 'react-router'
import type { DeliveryType, PaymentType, SessionState } from '@/core/models/callcenter'
import PrototypeSwitcher from '@/core/ui/PrototypeSwitcher'
import ConsoleShell from '../ConsoleShell'
import FulfilmentPicker from '../FulfilmentPicker'
import { isPickup } from '../fulfilment-view'
import PaymentPicker from '../PaymentPicker'
import { DEFAULT_SCENARIO, SCENARIOS } from './fulfilment-mock'

export default function FulfilmentPrototypePage() {
  const [params, setParams] = useSearchParams()
  const scenarioKey = params.get('state') ?? DEFAULT_SCENARIO
  const scenario = SCENARIOS.find((s) => s.key === scenarioKey) ?? SCENARIOS[0]

  /**
   * The flip is applied LOCALLY so the interactive loop is real: open the chip,
   * pick the other mode, watch the address block become the collection block,
   * the slot chip leave the row and the delivery region leave the receipt — in
   * one gesture, which is the only way to see whether the furniture moves.
   *
   * 🚩 It is a *local* projection, not a second source of truth: in the real
   * console `setFulfilment` returns the whole state and the cache is the store
   * of record. What it reproduces is exactly what the wire does — the capture
   * shows the server clearing `address`, dropping `MISSING_SLOT` and zeroing the
   * fee in the same response, so this must too or the drawing would be of a
   * state no server produces.
   */
  const [local, setLocal] = useState<SessionState | null>(null)
  const [surface, setSurface] = useState<'fulfilment' | 'payment' | null>(null)

  const state = local?.transactionId === scenario.state.transactionId && local ? local : scenario.state
  const pickup = isPickup(state.header)

  const setMode = (mode: DeliveryType) => {
    const collecting = mode === 'PickInStore'
    setLocal({
      ...state,
      version: state.version + 1,
      header: {
        ...state.header,
        deliveryType: mode,
        // The server clears it; the sidecar keeps it. The console's own memory
        // of it is the rail's retained-address trace.
        address: collecting ? null : (SCENARIOS[0].state.header.address ?? null),
        // v1.8 — the sidecar's label, set by the server on the way into
        // collection and cleared on the way out, where the address is back.
        retainedAddressLabel: collecting
          ? (state.header.address?.label ?? state.header.retainedAddressLabel ?? null)
          : null,
        slot: collecting ? null : state.header.slot,
      },
      totals: {
        ...state.totals,
        deliveryFee: {
          ...state.totals.deliveryFee,
          amount: collecting ? 0 : SCENARIOS[0].state.totals.deliveryFee.amount,
        },
        payable: Number(
          (state.totals.gross + (collecting ? 0 : SCENARIOS[0].state.totals.deliveryFee.amount)).toFixed(2),
        ),
      },
      capabilities: {
        ...state.capabilities,
        canOpenAddressBook: !collecting,
        canConfirmSeededStore: collecting && state.header.plantSource === 'seededAtOpen',
        submitBlockers: collecting
          ? state.capabilities.submitBlockers.filter((b) => b !== 'MISSING_SLOT')
          : [...new Set([...state.capabilities.submitBlockers, 'MISSING_SLOT'])],
      },
    })
    setSurface(null)
  }

  const setPayment = (value: PaymentType) => {
    setLocal({ ...state, version: state.version + 1, header: { ...state.header, paymentType: value } })
    setSurface(null)
  }

  return (
    <div className="h-[calc(100vh-3.5rem)] w-screen overflow-hidden">
      <ConsoleShell
        state={state}
        customerActions={{ onAttach: NOOP, onRemove: NOOP, busy: false, error: null }}
        addItem={{ onAdd: null, pending: null, landed: 0, error: null, dismissError: NOOP }}
        guidance={{
          onAdd: null,
          pending: null,
          outcome: null,
          dismissOutcome: NOOP,
          onSearchRest: NOOP,
        }}
        lineEdit={null}
        onChangeFulfilment={() => setSurface('fulfilment')}
        onChangePayment={() => setSurface('payment')}
        onChangeStore={NOOP}
        onChangeSlot={NOOP}
        onChangeSource={NOOP}
        onPickAddress={NOOP}
        submit={{ placing: false, outcome: null, failure: null }}
      />

      <FulfilmentPicker
        open={surface === 'fulfilment'}
        current={pickup ? 'PickInStore' : 'Delivery'}
        pending={null}
        error={null}
        onPick={setMode}
        onClose={() => setSurface(null)}
      />
      <PaymentPicker
        open={surface === 'payment'}
        current={state.header.paymentType ?? 'CashOnDelivery'}
        pickup={pickup}
        pending={null}
        error={null}
        onPick={setPayment}
        onClose={() => setSurface(null)}
      />

      <PrototypeSwitcher
        variants={[]}
        variant=""
        onVariant={NOOP}
        scenarios={SCENARIOS.map(({ key, label, proves, stubbed }) => ({
          key,
          label: stubbed ? `${label} ⚠ stub` : label,
          proves,
        }))}
        scenario={scenario.key}
        onScenario={(k) => {
          setLocal(null)
          setSurface(null)
          const next = new URLSearchParams(params)
          next.set('state', k)
          setParams(next, { replace: true })
        }}
      />
    </div>
  )
}

const NOOP = () => {}
