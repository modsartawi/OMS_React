import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Languages, ListOrdered, LogOut } from 'lucide-react'
import { setUnauthorizedHandler } from '@/core/api'
import Button from '@/core/ui/Button'
import { applyState } from '@/core/engine-session/session-state'
import { newRequestId } from '@/core/engine-session/request-id'
import { confirmAction } from '@/core/services/confirm'
import type { ExistingOrder, LoyaltyMember, OpenResult, SessionLine, SessionState, SubmitResult } from '@/core/models/callcenter'
import { miniPosApi, type AddItemInput } from './api'
import BasketScreen from './BasketScreen'
import CustomerScreen from './CustomerScreen'
import CustomerSlot from './CustomerSlot'
import { DoorRefusedScreen, ExistingBasketScreen, UnlockScreen } from './DoorScreens'
import { addItemCode } from './gs1'
import type { KeyedCode } from './KeyedCodeField'
import { switchLanguage } from './language'
import { clearPhoneSession, phoneSession, savePhoneSession, type PhoneSession } from './phone-session'
import { afterOpen, basketView, basketWait, createSubmitGuard, isNoConnection, routeFault } from './flow'
import NoConnection, { useOnline } from './NoConnection'
import OrdersScreen from './OrdersScreen'
import RefusalBanner from './RefusalBanner'
import { doorScreenFor, readRefusal, withPhoneArabic, type ShownRefusal } from './refusal'
import type { ScanRead } from './scanner'
import SignInScreen from './SignInScreen'
import SubmittedScreen from './SubmittedScreen'

/**
 * The Mini POS phone app (BackOffice spec 4063, oms tickets 916, 917): sign in → (not assigned today | unlock) →
 * customer → basket → submitted, and my orders today → reopen → basket → resubmitted. 🚩 THE PHONE DECIDES NOTHING.
 * Which screen comes next is the server's answer: the door's (`doorScreenFor`) on whether this promoter is assigned
 * today, has unlocked at the pharmacy, or may sell; the session's on whether a customer is attached (`basketView`); the
 * order's own status and the reopen's refusal on whether an order may be edited. The store, the promoter, the customer's
 * membership and every price are the server's.
 *
 * No connection: a call that never reached the server says so (`NoConnection`) and moves nothing; submit is held while
 * the phone is offline, and a retry re-sends the same submit (`createSubmitGuard`), so an order is never placed twice.
 */

type Screen =
  | { kind: 'signIn' }
  | { kind: 'starting' }
  | { kind: 'refused'; notAssigned: boolean; refusal: ShownRefusal | null }
  | { kind: 'unlock' }
  | { kind: 'existing'; existing: ExistingOrder }
  /** The basket, behind the customer step while the session has no customer. `editing`: the order it reopened. */
  | { kind: 'basket'; transactionId: string; editing: string | null }
  | { kind: 'orders' }
  | { kind: 'submitted'; documentNo: string; resubmitted: boolean }

const basketKey = (transactionId: string) => ['minipos', 'basket', transactionId] as const
const ORDERS_KEY = ['minipos', 'orders'] as const

/** Basket verbs run one at a time, in the order they were asked: two scans never race on the session's claim. */
const BASKET_SCOPE = { id: 'minipos-basket' }

export default function MiniPosPhonePage() {
  const { t } = useTranslation('mini-pos-phone')
  const queryClient = useQueryClient()
  const [screen, setScreen] = useState<Screen>(() => (phoneSession() ? { kind: 'starting' } : { kind: 'signIn' }))
  const [refusal, setRefusal] = useState<ShownRefusal | null>(null)
  const [belowStock, setBelowStock] = useState<AddItemInput | null>(null)
  const [user, setUser] = useState(() => phoneSession())
  /** The member the phone found (for the tier: the session holds the name and mobile, not the tier). */
  const [member, setMember] = useState<LoyaltyMember | null>(null)
  /** The last call never reached the server. Cleared by the next answer. */
  const [noConnection, setNoConnection] = useState(false)
  const online = useOnline()
  const submitGuard = useRef(createSubmitGuard())
  /** Why the phone went back to the door (the order was over, or not this sign-in's): shown on what the door opens. */
  const carried = useRef<ShownRefusal | null>(null)

  const signOut = () => {
    clearPhoneSession()
    queryClient.clear()
    setUser(null)
    setRefusal(null)
    setBelowStock(null)
    setMember(null)
    setNoConnection(false)
    carried.current = null
    setScreen({ kind: 'signIn' })
  }

  /** A refusal in the server's words; the session's English-only no-customer refusal gets the phone's Arabic line. */
  const shownOf = (err: unknown): ShownRefusal =>
    withPhoneArabic(readRefusal(err, t('app.failed')), (code) => t(`phoneArabic.${code}`, { lng: 'ar' }))

  // An ended or refused session (a bare 401 from the door) goes back to sign in. The login's own 401 (a bad channel
  // key) stays on the sign-in screen, where its message is shown.
  const signOutRef = useRef(signOut)
  signOutRef.current = signOut
  useEffect(() => {
    setUnauthorizedHandler((path) => {
      if (!path.startsWith('UaAuth/')) signOutRef.current()
    })
    return () => setUnauthorizedHandler(null)
  }, [])

  /** The server's state into the cache, never older than what is on screen (contract §2.1). */
  const put = (state: SessionState, source: 'verb' | 'read' = 'verb') =>
    queryClient.setQueryData<SessionState>(basketKey(state.transactionId), (current) => applyState(current, state, source))

  /**
   * Every failed call, one routing (`routeFault`): no connection moves nothing; an order that is over or not this
   * sign-in's goes back to the door, carrying its refusal; a refusal of the door moves the phone; any other is shown
   * where it happened.
   */
  const refused = (err: unknown) => {
    const route = routeFault(err, shownOf)
    if (route.to === 'noConnection') {
      setNoConnection(true)
      return
    }
    setNoConnection(false)
    if (route.to === 'start') {
      // The order is over or not this sign-in's (submitted elsewhere, swept): back to the door, which opens anew.
      carried.current = route.refusal
      setRefusal(route.refusal)
      setBelowStock(null)
      setScreen({ kind: 'starting' })
      return
    }
    if (route.to === 'here') {
      setRefusal(route.refusal)
      return
    }
    switch (route.door) {
      case 'signIn':
        signOut()
        return
      case 'notAssigned':
        setScreen({ kind: 'refused', notAssigned: true, refusal: route.refusal })
        return
      case 'blocked':
        setScreen({ kind: 'refused', notAssigned: false, refusal: route.refusal })
        return
      case 'unlock':
        setRefusal(null)
        setScreen({ kind: 'unlock' })
        return
    }
  }

  const opened = (result: OpenResult) => {
    const { next, refusal: shown } = afterOpen(result, carried.current)
    carried.current = null
    setRefusal(shown)
    setNoConnection(false)
    if (next?.kind === 'basket' && result.state) {
      put(result.state, 'read')
      setMember(null)
    }
    if (next) setScreen(next)
  }

  // ----- the door: open a basket, and go where the answer says -----
  const opening = useRef(false)
  const start = useMutation({
    mutationFn: () => miniPosApi.open(),
    onMutate: () => {
      opening.current = true
    },
    onSuccess: opened,
    onError: (err) => {
      carried.current = null
      // A door refusal moves the phone; anything else (a network fault, a server error) stays on a screen that can
      // try again.
      if (doorScreenFor(err)) refused(err)
      else setScreen({ kind: 'refused', notAssigned: false, refusal: readRefusal(err, t('app.failed')) })
    },
    onSettled: () => {
      opening.current = false
    },
  })
  const startRef = useRef(start.mutate)
  startRef.current = start.mutate
  useEffect(() => {
    // Once per arrival at `starting` (a second open would answer "a basket is already open" with this one).
    if (screen.kind === 'starting' && !opening.current) {
      opening.current = true
      startRef.current()
    }
  }, [screen.kind])

  const signedIn = (session: PhoneSession) => {
    savePhoneSession(session)
    setUser(session)
    setScreen({ kind: 'starting' })
  }

  // ----- unlock -----
  const unlock = useMutation({
    mutationFn: (code: string) => miniPosApi.unlock(code),
    onMutate: () => setRefusal(null),
    onSuccess: () => setScreen({ kind: 'starting' }),
    onError: refused,
  })

  // ----- the basket -----
  const transactionId = screen.kind === 'basket' ? screen.transactionId : null
  const basket = useQuery({
    queryKey: basketKey(transactionId ?? ''),
    queryFn: async () => miniPosApi.state(transactionId!),
    enabled: !!transactionId,
    staleTime: Infinity,
  })
  const refusedRef = useRef(refused)
  refusedRef.current = refused
  useEffect(() => {
    if (basket.error) refusedRef.current(basket.error)
  }, [basket.error])

  const verb = useMutation({
    scope: BASKET_SCOPE,
    mutationFn: (run: () => Promise<SessionState>) => run(),
    onMutate: () => setRefusal(null),
    onSuccess: (state) => {
      setNoConnection(false)
      put(state)
    },
    onError: refused,
  })

  const add = (input: AddItemInput) =>
    verb.mutate(async () => {
      const state = await miniPosApi.addItem(input)
      // Below the pharmacy's stock: the add waits for "add anyway", re-sent as the SAME action with its token.
      const pending = state.pendingConfirmation
      setBelowStock(pending?.kind === 'belowAtp' ? { ...input, confirmToken: pending.confirmToken } : null)
      return state
    })

  const addCode = (value: string, entry: Pick<AddItemInput, 'entryMode' | 'reader' | 'msToRead'>, format?: string) => {
    if (!transactionId) return
    const { code, serial } = addItemCode(value, format)
    add({ transactionId, requestId: newRequestId(), code, qty: 1, serial, ...entry })
  }

  const onScan = (read: ScanRead) =>
    addCode(read.value, { entryMode: 'camera', reader: read.reader, msToRead: read.msToRead }, read.format)
  const onKeyed = (keyed: KeyedCode) =>
    addCode(keyed.value, { entryMode: keyed.entryMode, reader: keyed.reader, msToRead: keyed.msToRead })
  const onQty = (line: SessionLine, qty: number) => transactionId && verb.mutate(() => miniPosApi.changeQty(transactionId, line.lineId, qty))
  const onRemove = (line: SessionLine) => transactionId && verb.mutate(() => miniPosApi.voidLine(transactionId, line.lineId))

  // ----- the customer (oms 917): the member found is attached to the session; the server says who is on the order -----
  const attach = (found: LoyaltyMember) => {
    setMember(found)
    if (transactionId) verb.mutate(() => miniPosApi.attachCustomer(transactionId, found.loyId))
  }

  // ----- submit, or resubmit a reopened order: one action, one request id, never twice -----
  const submit = useMutation({
    scope: BASKET_SCOPE,
    mutationFn: ({ id, requestId, editing }: { id: string; requestId: string; editing: string | null }): Promise<SubmitResult> =>
      editing ? miniPosApi.resubmit(id, requestId) : miniPosApi.submit(id, requestId),
    onMutate: () => setRefusal(null),
    onSuccess: (result, { id, editing }) => {
      submitGuard.current.end('done')
      setNoConnection(false)
      queryClient.removeQueries({ queryKey: basketKey(id) })
      void queryClient.invalidateQueries({ queryKey: ORDERS_KEY })
      setBelowStock(null)
      setMember(null)
      setScreen({ kind: 'submitted', documentNo: result.documentNo, resubmitted: !!editing })
    },
    onError: (err) => {
      submitGuard.current.end(isNoConnection(err) ? 'noConnection' : 'refused')
      refused(err)
    },
  })

  const onSubmit = () => {
    if (screen.kind !== 'basket' || !online) return
    const requestId = submitGuard.current.begin(screen.transactionId)
    if (requestId) submit.mutate({ id: screen.transactionId, requestId, editing: screen.editing })
  }

  // ----- my orders today, and reopen (oms 917; BackOffice 4071) -----
  const [ordersRefusal, setOrdersRefusal] = useState<ShownRefusal | null>(null)
  const orders = useQuery({
    queryKey: ORDERS_KEY,
    queryFn: () => miniPosApi.myOrdersToday(),
    enabled: screen.kind === 'orders',
    refetchOnMount: 'always',
  })
  const ordersFailed = useRef<(err: unknown) => void>(() => {})
  ordersFailed.current = (err) => {
    // Held at a till, paid, closed, another basket open: the server's refusal, shown on the list it came from.
    if (isNoConnection(err)) setNoConnection(true)
    else if (doorScreenFor(err)) refused(err)
    else setOrdersRefusal(shownOf(err))
  }
  useEffect(() => {
    if (orders.error) ordersFailed.current(orders.error)
  }, [orders.error])
  useEffect(() => {
    if (orders.isSuccess) setNoConnection(false)
  }, [orders.isSuccess, orders.dataUpdatedAt])

  const reopen = useMutation({
    mutationFn: (documentNo: string) => miniPosApi.reopen(documentNo),
    onMutate: () => setOrdersRefusal(null),
    onSuccess: (result) => {
      setNoConnection(false)
      put(result.state, 'read')
      setMember(null)
      setScreen({ kind: 'basket', transactionId: result.state.transactionId, editing: result.documentNo })
    },
    onError: (err) => ordersFailed.current(err),
  })

  const showOrders = () => {
    setOrdersRefusal(null)
    setRefusal(null)
    setScreen({ kind: 'orders' })
  }

  const abandon = useMutation({
    scope: BASKET_SCOPE,
    mutationFn: (id: string) => miniPosApi.abandon(id),
    onMutate: () => setRefusal(null),
    onSuccess: (_result, id) => {
      queryClient.removeQueries({ queryKey: basketKey(id) })
      setBelowStock(null)
      setScreen({ kind: 'starting' })
    },
    onError: refused,
  })

  const onAbandon = async () => {
    if (!transactionId) return
    if (await confirmAction(t('basket.abandonConfirm'), t('basket.abandon'))) abandon.mutate(transactionId)
  }

  const busy = verb.isPending || submit.isPending || abandon.isPending
  const ordersReachable = screen.kind === 'basket' || screen.kind === 'existing' || screen.kind === 'submitted'

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-background text-foreground">
      <header className="sticky top-0 z-10 flex items-center gap-2 border-b border-border bg-card px-4 py-2">
        <span className="shrink-0 whitespace-nowrap font-semibold">{t('app.title')}</span>
        {user && <bdi className="min-w-0 truncate text-sm text-muted-foreground">{user.displayName ?? user.userId}</bdi>}
        <Button variant="ghost" className="ms-auto" title={t('app.switchLanguageLabel')} onClick={switchLanguage}>
          <Languages className="size-4" aria-hidden />
          {t('app.switchLanguage')}
        </Button>
        {user && ordersReachable && (
          <Button variant="ghost" title={t('orders.title')} disabled={busy} onClick={showOrders}>
            <ListOrdered className="size-4" aria-hidden />
            <span className="sr-only">{t('orders.title')}</span>
          </Button>
        )}
        {user && (
          <Button variant="ghost" className="whitespace-nowrap" onClick={signOut}>
            <LogOut className="size-4" aria-hidden />
            {t('app.signOut')}
          </Button>
        )}
      </header>

      <main className="flex flex-1 flex-col gap-4 px-4 py-4">
        {!online && screen.kind !== 'basket' && screen.kind !== 'orders' && <NoConnection />}

        {screen.kind === 'signIn' && <SignInScreen onSignedIn={signedIn} />}

        {screen.kind === 'starting' && <p className="py-10 text-center text-sm text-muted-foreground">{t('app.working')}</p>}

        {screen.kind === 'refused' && (
          <DoorRefusedScreen
            notAssigned={screen.notAssigned}
            refusal={screen.refusal}
            busy={start.isPending}
            onRetry={() => start.mutate()}
          />
        )}

        {screen.kind === 'unlock' && (
          <UnlockScreen refusal={refusal} busy={unlock.isPending} onCode={(read) => !unlock.isPending && unlock.mutate(read.value)} />
        )}

        {screen.kind === 'existing' && (
          <ExistingBasketScreen
            existing={screen.existing}
            busy={abandon.isPending}
            refusal={refusal}
            onResume={() => setScreen({ kind: 'basket', transactionId: screen.existing.transactionId, editing: null })}
            onStartNew={() => abandon.mutate(screen.existing.transactionId)}
          />
        )}

        {screen.kind === 'basket' && basket.data && basketView(basket.data) === 'customer' && (
          <CustomerScreen
            attaching={verb.isPending}
            refusal={refusal}
            noConnection={!online || noConnection}
            found={member}
            onMember={attach}
            onAbandon={() => void onAbandon()}
          />
        )}

        {screen.kind === 'basket' && basket.data && basketView(basket.data) === 'basket' && (
          <BasketScreen
            state={basket.data}
            busy={busy}
            refusal={refusal}
            belowStock={!!belowStock}
            editing={screen.editing}
            offline={!online}
            noConnection={noConnection}
            customerSlot={<CustomerSlot state={basket.data} member={member} />}
            onScan={onScan}
            onKeyed={onKeyed}
            onQty={onQty}
            onRemove={onRemove}
            onSubmit={onSubmit}
            onAbandon={() => void onAbandon()}
            onAddAnyway={() => belowStock && add(belowStock)}
            onDontAdd={() => setBelowStock(null)}
          />
        )}
        {screen.kind === 'basket' && basketWait(basket) === 'loading' && (
          <p className="py-10 text-center text-sm text-muted-foreground">{t('app.working')}</p>
        )}
        {screen.kind === 'basket' && (basketWait(basket) === 'noConnection' || basketWait(basket) === 'refused') && (
          <>
            {basketWait(basket) === 'noConnection' ? <NoConnection /> : refusal && <RefusalBanner refusal={refusal} />}
            <Button
              variant="secondary"
              className="h-11 w-full justify-center"
              disabled={basket.isFetching}
              onClick={() => {
                setRefusal(null)
                void basket.refetch()
              }}
            >
              {t('app.retry')}
            </Button>
          </>
        )}

        {screen.kind === 'orders' && (
          <OrdersScreen
            orders={orders.data ?? null}
            loading={orders.isFetching}
            refusal={ordersRefusal}
            noConnection={!online || noConnection}
            reopening={reopen.isPending ? (reopen.variables ?? null) : null}
            onReopen={(documentNo) => !reopen.isPending && reopen.mutate(documentNo)}
            onRefresh={() => {
              setOrdersRefusal(null)
              void orders.refetch()
            }}
            onBack={() => setScreen({ kind: 'starting' })}
          />
        )}

        {screen.kind === 'submitted' && (
          <SubmittedScreen
            documentNo={screen.documentNo}
            resubmitted={screen.resubmitted}
            onNewBasket={() => setScreen({ kind: 'starting' })}
            onMyOrders={showOrders}
          />
        )}
      </main>
    </div>
  )
}
