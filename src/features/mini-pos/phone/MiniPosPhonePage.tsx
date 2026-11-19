import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Languages, LogOut } from 'lucide-react'
import { setUnauthorizedHandler } from '@/core/api'
import Button from '@/core/ui/Button'
import { applyState } from '@/core/engine-session/session-state'
import { newRequestId } from '@/core/engine-session/request-id'
import { readSessionFault } from '@/core/engine-session/session-fault'
import { confirmAction } from '@/core/services/confirm'
import type { ExistingOrder, OpenResult, SessionLine, SessionState } from '@/core/models/callcenter'
import { miniPosApi, type AddItemInput } from './api'
import BasketScreen from './BasketScreen'
import CustomerSlot from './CustomerSlot'
import { DoorRefusedScreen, ExistingBasketScreen, UnlockScreen } from './DoorScreens'
import { addItemCode } from './gs1'
import type { KeyedCode } from './KeyedCodeField'
import { switchLanguage } from './language'
import { clearPhoneSession, phoneSession, savePhoneSession, type PhoneSession } from './phone-session'
import { doorScreenFor, readRefusal, type ShownRefusal } from './refusal'
import type { ScanRead } from './scanner'
import SignInScreen from './SignInScreen'
import SubmittedScreen from './SubmittedScreen'

/**
 * The Mini POS phone app (BackOffice spec 4063, oms ticket 916): sign in → (not assigned today | unlock) → basket →
 * submitted. 🚩 THE PHONE DECIDES NOTHING. Which screen comes next is the door's answer (`doorScreenFor`): the phone
 * asks to open a basket, and the server says whether this promoter is assigned today, has unlocked at the pharmacy, or
 * may sell. The store, the promoter and every price are the server's.
 *
 * Seam for oms 917: the customer step sits between unlock and the basket (`CustomerSlot` today), and "my orders today"
 * and reopen/resubmit join the screens below.
 */

type Screen =
  | { kind: 'signIn' }
  | { kind: 'starting' }
  | { kind: 'refused'; notAssigned: boolean; refusal: ShownRefusal | null }
  | { kind: 'unlock' }
  | { kind: 'existing'; existing: ExistingOrder }
  | { kind: 'basket'; transactionId: string }
  | { kind: 'submitted'; documentNo: string }

const basketKey = (transactionId: string) => ['minipos', 'basket', transactionId] as const

/** Basket verbs run one at a time, in the order they were asked: two scans never race on the session's claim. */
const BASKET_SCOPE = { id: 'minipos-basket' }

export default function MiniPosPhonePage() {
  const { t } = useTranslation('mini-pos-phone')
  const queryClient = useQueryClient()
  const [screen, setScreen] = useState<Screen>(() => (phoneSession() ? { kind: 'starting' } : { kind: 'signIn' }))
  const [refusal, setRefusal] = useState<ShownRefusal | null>(null)
  const [belowStock, setBelowStock] = useState<AddItemInput | null>(null)
  const [user, setUser] = useState(() => phoneSession())

  const signOut = () => {
    clearPhoneSession()
    queryClient.clear()
    setUser(null)
    setRefusal(null)
    setBelowStock(null)
    setScreen({ kind: 'signIn' })
  }

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

  /** A refusal of the door moves the phone; any other is shown where it happened. */
  const refused = (err: unknown) => {
    const shown = readRefusal(err, t('app.failed'))
    switch (doorScreenFor(err)) {
      case 'signIn':
        signOut()
        return
      case 'notAssigned':
        setScreen({ kind: 'refused', notAssigned: true, refusal: shown })
        return
      case 'blocked':
        setScreen({ kind: 'refused', notAssigned: false, refusal: shown })
        return
      case 'unlock':
        setRefusal(null)
        setScreen({ kind: 'unlock' })
        return
      default:
        setRefusal(shown)
    }
  }

  const opened = (result: OpenResult) => {
    setRefusal(null)
    if (result.outcome === 'opened' && result.state) {
      put(result.state, 'read')
      setScreen({ kind: 'basket', transactionId: result.state.transactionId })
    } else if (result.existing) {
      setScreen({ kind: 'existing', existing: result.existing })
    }
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
    onSuccess: (state) => put(state),
    onError: (err) => {
      // The order is over or not this sign-in's (submitted elsewhere, swept): back to the door, which opens anew.
      if (readSessionFault(err)) {
        setRefusal(readRefusal(err, t('app.failed')))
        setScreen({ kind: 'starting' })
        return
      }
      refused(err)
    },
  })

  const add = (input: AddItemInput) =>
    verb.mutate(async () => {
      const state = await miniPosApi.addItem(input)
      // Below the pharmacy's stock: the add waits for "add anyway", re-sent as the SAME action with its token.
      const pending = state.pendingConfirmation
      setBelowStock(pending?.kind === 'belowAtp' ? { ...input, confirmToken: pending.confirmToken } : null)
      return state
    })

  const addCode = (value: string, entry: Pick<AddItemInput, 'entryMode' | 'reader' | 'msToRead'>) => {
    if (!transactionId) return
    const { code, serial } = addItemCode(value)
    add({ transactionId, requestId: newRequestId(), code, qty: 1, serial, ...entry })
  }

  const onScan = (read: ScanRead) => addCode(read.value, { entryMode: 'camera', reader: read.reader, msToRead: read.msToRead })
  const onKeyed = (keyed: KeyedCode) =>
    addCode(keyed.value, { entryMode: keyed.entryMode, reader: keyed.reader, msToRead: keyed.msToRead })
  const onQty = (line: SessionLine, qty: number) => transactionId && verb.mutate(() => miniPosApi.changeQty(transactionId, line.lineId, qty))
  const onRemove = (line: SessionLine) => transactionId && verb.mutate(() => miniPosApi.voidLine(transactionId, line.lineId))

  const submit = useMutation({
    scope: BASKET_SCOPE,
    mutationFn: (id: string) => miniPosApi.submit(id, newRequestId()),
    onMutate: () => setRefusal(null),
    onSuccess: (result, id) => {
      queryClient.removeQueries({ queryKey: basketKey(id) })
      setBelowStock(null)
      setScreen({ kind: 'submitted', documentNo: result.documentNo })
    },
    onError: refused,
  })

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

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-background text-foreground">
      <header className="sticky top-0 z-10 flex items-center gap-2 border-b border-border bg-card px-4 py-2">
        <span className="font-semibold">{t('app.title')}</span>
        {user && <bdi className="truncate text-sm text-muted-foreground">{user.displayName ?? user.userId}</bdi>}
        <Button variant="ghost" className="ms-auto" title={t('app.switchLanguageLabel')} onClick={switchLanguage}>
          <Languages className="size-4" aria-hidden />
          {t('app.switchLanguage')}
        </Button>
        {user && (
          <Button variant="ghost" onClick={signOut}>
            <LogOut className="size-4" aria-hidden />
            {t('app.signOut')}
          </Button>
        )}
      </header>

      <main className="flex flex-1 flex-col gap-4 px-4 py-4">
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
            onResume={() => setScreen({ kind: 'basket', transactionId: screen.existing.transactionId })}
            onStartNew={() => abandon.mutate(screen.existing.transactionId)}
          />
        )}

        {screen.kind === 'basket' && basket.data && (
          <BasketScreen
            state={basket.data}
            busy={busy}
            refusal={refusal}
            belowStock={!!belowStock}
            customerSlot={<CustomerSlot state={basket.data} />}
            onScan={onScan}
            onKeyed={onKeyed}
            onQty={onQty}
            onRemove={onRemove}
            onSubmit={() => submit.mutate(screen.transactionId)}
            onAbandon={() => void onAbandon()}
            onAddAnyway={() => belowStock && add(belowStock)}
            onDontAdd={() => setBelowStock(null)}
          />
        )}
        {screen.kind === 'basket' && !basket.data && !basket.error && (
          <p className="py-10 text-center text-sm text-muted-foreground">{t('app.working')}</p>
        )}

        {screen.kind === 'submitted' && (
          <SubmittedScreen documentNo={screen.documentNo} onNewBasket={() => setScreen({ kind: 'starting' })} />
        )}
      </main>
    </div>
  )
}
