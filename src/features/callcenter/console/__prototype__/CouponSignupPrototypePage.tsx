/* PROTOTYPE — throwaway. Wayfinder ticket 159 (map 126).
 *
 * Route: /prototype/callcenter-coupon?state=…
 *
 * 🚩 **It mounts the REAL `ConsoleShell`**, 176's pattern and 177's lesson: every
 * earlier prototype on this map re-drew the console because the import-boundary
 * gate treats `callcenter/__prototype__` and `callcenter/console` as two
 * features, and 177 then found two defects in the real console that no
 * illustration could have surfaced. This file lives inside `console/` for that
 * reason alone.
 *
 * ⚠ **Everything the coupon touches is a stub** (`coupon-mock.ts` says why at
 * length). v1.10 exists on no server. The verbs below are local so the loop is
 * real — apply a code, watch the chip fill, remove it, watch a refusal that
 * changes nothing — which is the only way to judge whether *nothing changed* is
 * a sentence an agent can say down a phone.
 */
import { useState } from 'react'
import { useSearchParams } from 'react-router'
import type { LoyaltyMember, SessionState } from '@/core/models/callcenter'
import PrototypeSwitcher from '@/core/ui/PrototypeSwitcher'
import ConsoleShell from '../ConsoleShell'
import CouponPicker from '../CouponPicker'
import { couponSurface } from '../coupon-view'
import { beginSignup, CLOSED_SIGNUP, type SignupState } from '../signup-view'
import { DEFAULT_SCENARIO, REFUSALS, SCENARIOS } from './coupon-mock'

/** The code the mock refuses, and the code whose REMOVAL the mock refuses — one
 *  of each, so both halves of the one-way story are drivable. */
const REJECTED_CODE = 'EXPIRED'
const UNREMOVABLE_CODE = 'FREEDEL'

export default function CouponSignupPrototypePage() {
  const [params, setParams] = useSearchParams()
  const scenarioKey = params.get('state') ?? DEFAULT_SCENARIO
  const scenario = SCENARIOS.find((s) => s.key === scenarioKey) ?? SCENARIOS[0]

  const [local, setLocal] = useState<SessionState | null>(null)
  const [couponOpen, setCouponOpen] = useState(false)
  const [applyError, setApplyError] = useState<string | null>(null)
  const [removeError, setRemoveError] = useState<string | null>(null)
  // The signup scenario opens ON LOAD, not only on a switcher click: the drive
  // and a shared link both arrive by URL, and a state that only exists after an
  // interaction is a state nobody can be shown.
  const [signup, setSignup] = useState<SignupState>(() =>
    scenarioKey === 'signupMiss' ? beginSignup('0501234567') : CLOSED_SIGNUP,
  )

  const state = local?.transactionId === scenario.state.transactionId && local ? local : scenario.state
  const surface = couponSurface(state.header, state.capabilities)

  const apply = (code: string) => {
    setRemoveError(null)
    const upper = code.toUpperCase()

    // The two business refusals the taxonomy already carries. Both are outcomes
    // the agent says out loud; neither is a crash, and neither is dressed as the
    // other — a transport fault reaches the agent as a coupon that could not be
    // applied, never as a coupon that is invalid (§7, the server's own rule).
    if (upper === REJECTED_CODE) return setApplyError(REFUSALS.COUPON_REJECTED)
    if (surface.coupons.some((c) => c.code === upper))
      return setApplyError(REFUSALS.COUPON_ALREADY_APPLIED)

    setApplyError(null)
    setLocal({
      ...state,
      version: state.version + 1,
      header: {
        ...state.header,
        coupons: [...surface.coupons, { code: upper, description: null, amount: -5 }],
      },
      capabilities: { ...state.capabilities, canRemoveCoupon: true },
    })
  }

  const remove = (code: string) => {
    setApplyError(null)

    // 🚩 The reversal leg refusing. The reverse runs BEFORE the void, so the
    // order is untouched — the coupon is still on it and still spent. This is
    // the state the whole *remove* ruling has to survive being read aloud.
    if (code === UNREMOVABLE_CODE) return setRemoveError(REFUSALS.COUPON_REVERSAL_REFUSED)

    setRemoveError(null)
    const left = surface.coupons.filter((c) => c.code !== code)
    setLocal({
      ...state,
      version: state.version + 1,
      header: { ...state.header, coupons: left },
      capabilities: { ...state.capabilities, canRemoveCoupon: left.length > 0 },
    })
  }

  /** The confirm's answer — a member the agent still has to attach (165). */
  const created: LoyaltyMember = {
    ...MEMBER_SHAPE,
    mobile: signup.mobile || '0501234567',
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
        onChangeCoupon={() => setCouponOpen(true)}
        signup={{
          state: signup,
          actions: {
            onChange: setSignup,
            // Both steps land instantly. The WAIT is the thing being drawn, not
            // the latency: the caller is reading digits back down the phone, and
            // what matters is that the console has not been taken away while
            // they do it.
            onSendCode: () => setSignup((s) => ({ ...s, step: 'otp', otp: '' })),
            onConfirm: () => setSignup((s) => ({ ...s, step: 'created', created })),
            onCancel: () => setSignup(CLOSED_SIGNUP),
            onAttach: NOOP,
            sending: false,
            confirming: false,
            error: null,
          },
        }}
        submit={{ placing: false, outcome: null, failure: null }}
      />

      <CouponPicker
        open={couponOpen}
        surface={surface}
        pendingApply={false}
        pendingRemove={null}
        applyError={applyError}
        removeError={removeError}
        onApply={apply}
        onRemove={remove}
        onClose={() => {
          setCouponOpen(false)
          setApplyError(null)
          setRemoveError(null)
        }}
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
          setCouponOpen(false)
          setApplyError(null)
          setRemoveError(null)
          setSignup(k === 'signupMiss' ? beginSignup('0501234567') : CLOSED_SIGNUP)
          const next = new URLSearchParams(params)
          next.set('state', k)
          setParams(next, { replace: true })
        }}
      />
    </div>
  )
}

const NOOP = () => {}

/** Shaped like the lookup's own answer so the created card and the found card
 *  are the same card — a freshly enrolled caller is attached the same way as one
 *  who was already there. */
const MEMBER_SHAPE: LoyaltyMember = {
  loyId: '0009988776',
  fullName: 'New member',
  mobile: '0501234567',
  email: null,
  tier: null,
  pointsBalance: null,
}
