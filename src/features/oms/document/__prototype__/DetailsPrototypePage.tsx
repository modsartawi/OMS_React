/* PROTOTYPE 371 — throwaway (branch prototype/371-delivery-details). Wayfinder map 358.
 *
 * Question: how is the Delivery details record page arranged on the 362 "Navy-led"
 * tokens — header (NOT a dark slab), 369's timeline, items, a Log+Jobs activity feed,
 * actions (no Retry; a banner per failed job, a slot left for Retry) — and does the
 * one-shot `open` intent land through the page's own gate?
 *
 * Sub-shape A: the LIVE route /oms/delivery/:deliveryNo renders this when `?variant=`
 * is present (DEV only). Three variants, `?variant=A|B|C`; the scenario arrows switch
 * the delivery (stub cases in core/theme/proto-371-stub.ts). The dialogs are the REAL
 * ones; confirming posts NOTHING (a toast says what would have posted).
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import PrototypeSwitcher from '@/core/ui/PrototypeSwitcher'
import { notify } from '@/core/services/notify'
import { CASES, CASE_NUMBERS } from '@/core/theme/proto-371-stub'
import { documentApi } from '../api'
import { commandBar } from '../commands'
import type { CommandKind } from '../actions'
import RescheduleDialog from '../RescheduleDialog'
import ChangeStoreDialog from '../ChangeStoreDialog'
import RequestCloseDialog from '../RequestCloseDialog'
import NoteDialog, { type NoteCommandKind } from '../NoteDialog'
import { timeline, type FeedItem } from './derive'
import { findCmd, type VariantProps } from './parts'
import VariantA, { NAME as NAME_A } from './VariantA'
import VariantB, { NAME as NAME_B } from './VariantB'
import VariantC, { NAME as NAME_C, NAME_D, VariantD } from './VariantC'

const VARIANTS = [
  { key: 'A', name: NAME_A, Component: VariantA, composer: true },
  { key: 'B', name: NAME_B, Component: VariantB, composer: false },
  { key: 'C', name: NAME_C, Component: VariantC, composer: true },
  { key: 'D', name: NAME_D, Component: VariantD, composer: true },
]

type Intent = 'reschedule' | 'request-close' | 'add-note'

export default function DetailsPrototypePage() {
  const { t } = useTranslation('document')
  const { deliveryNo = '' } = useParams()
  const [params] = useSearchParams()
  const location = useLocation()
  const navigate = useNavigate()
  const variant = VARIANTS.find((v) => v.key === params.get('variant')) ?? VARIANTS[0]
  const caseKey = Object.entries(CASE_NUMBERS).find(([, no]) => no === deliveryNo)?.[0] ?? 'out'

  const docQ = useQuery({ queryKey: ['p371', 'doc', deliveryNo], queryFn: () => documentApi.getDelivery(deliveryNo) })
  const doc = docQ.data ?? null
  const logsQ = useQuery({ queryKey: ['p371', 'logs', doc?.documentNo], queryFn: () => documentApi.getLogs(doc!.documentNo), enabled: !!doc })
  const jobsQ = useQuery({ queryKey: ['p371', 'jobs', doc?.documentNo], queryFn: () => documentApi.getOutbox(doc!.documentNo), enabled: !!doc })
  const logs = logsQ.data ?? null
  const jobs = jobsQ.data ?? null

  const [reschedule, setReschedule] = useState(false)
  const [changeStore, setChangeStore] = useState(false)
  const [requestClose, setRequestClose] = useState(false)
  const [noteCmd, setNoteCmd] = useState<NoteCommandKind | null>(null)
  const [refused, setRefused] = useState<CommandKind | null>(null)
  const [posted, setPosted] = useState<FeedItem[]>([])
  const [showRetrySlot, setShowRetrySlot] = useState(true)
  const composerRef = useRef<HTMLTextAreaElement | null>(null)

  const busy = reschedule || changeStore || requestClose || noteCmd !== null
  const bar = useMemo(
    () =>
      commandBar(
        {
          closeStatus: doc?.status?.closeStatus,
          documentCategory: doc?.documentCategory,
          openedAs: 'delivery',
          canReturn: doc?.canReturn,
          lines: doc?.lines,
          busy,
        },
        t,
      ),
    [doc, busy, t],
  )
  const steps = useMemo(() => (doc ? timeline(doc, logs) : []), [doc, logs])

  const onCommand = (kind: CommandKind) => {
    setRefused(null)
    switch (kind) {
      case 'reschedule':
        return setReschedule(true)
      case 'change-store':
        return setChangeStore(true)
      case 'request-close':
        return setRequestClose(true)
      case 'add-note':
        // A composer variant focuses the composer (365: N focuses it); B keeps 083's dialog.
        if (variant.composer && composerRef.current) return composerRef.current.focus()
        return setNoteCmd('add-note')
      case 'close':
      case 'force-close':
        return setNoteCmd(kind)
      default:
        notify.info('PROTOTYPE', `${kind} would open its dialog`)
    }
  }

  // ---- the one-shot `open` intent (367 §3) -----------------------------------------
  // Consumed ONCE, after the header has loaded, through the page's OWN gate: a disabled
  // command shows its reason (ring + tooltip + toast) instead of the dialog. The state is
  // then replaced away, so Back/refresh never re-pops it.
  const consumed = useRef<string | null>(null)
  useEffect(() => {
    const open = (location.state as { open?: Intent } | null)?.open
    if (!open || !doc || consumed.current === location.key) return
    consumed.current = location.key
    navigate(location.pathname + location.search, { replace: true, state: null })
    const cmd = findCmd(bar, open)
    if (!cmd) return
    if (cmd.reason) {
      setRefused(open)
      notify.warn(t(`actions.${open}`), cmd.reason)
      requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-cmd="${open}"]`)?.focus())
      return
    }
    onCommand(open)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.key, doc])

  const would = (what: string) => notify.info('PROTOTYPE — nothing posted', what)
  const postNote = (text: string) => {
    setPosted((p) => [
      ...p,
      { id: 'n' + p.length, at: new Date().toISOString().slice(0, 19), kind: 'note', title: 'Note added', by: 'you', detail: text, code: 'DADN' },
    ])
    would(`Add note (DADN): "${text}"`)
  }

  const go = (patch: { variant?: string; caseKey?: string; open?: Intent }) => {
    const no = patch.caseKey ? CASE_NUMBERS[patch.caseKey] : deliveryNo
    const sp = new URLSearchParams(params)
    if (patch.variant) sp.set('variant', patch.variant)
    if (patch.caseKey) setPosted([])
    setRefused(null)
    navigate(`/oms/delivery/${no}?${sp}`, { replace: !patch.open, state: patch.open ? { open: patch.open } : null })
  }

  const p: VariantProps | null = doc
    ? { doc, logs, jobs, steps, bar, onCommand, refused, composerRef, postedNotes: posted, onPostNote: postNote, showRetrySlot }
    : null
  const V = variant.Component

  return (
    <div className="pb-24">
      {docQ.isPending ? (
        <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Loading…
        </div>
      ) : !p ? (
        <div className="p-6 text-sm text-danger-800">Not a stub case — use the scenario arrows.</div>
      ) : (
        <V {...p} />
      )}

      {doc && (
        <>
          <RescheduleDialog open={reschedule} onClose={() => setReschedule(false)} document={doc} onConfirmed={() => (setReschedule(false), would('Reschedule'))} />
          <ChangeStoreDialog open={changeStore} onClose={() => setChangeStore(false)} document={doc} onConfirmed={() => (setChangeStore(false), would('Change store'))} />
          <RequestCloseDialog open={requestClose} onClose={() => setRequestClose(false)} onConfirmed={(r) => (setRequestClose(false), would(`Request cancellation: ${r}`))} />
          <NoteDialog kind={noteCmd} onClose={() => setNoteCmd(null)} onConfirmed={(k, text) => (setNoteCmd(null), k === 'add-note' ? postNote(text) : would(`${k}: ${text}`))} />
        </>
      )}

      {/* PROTOTYPE CHROME — arrive as the list's inspector / R·C·N would (367 §3). */}
      {import.meta.env.DEV && (
        <div className="fixed start-3 bottom-20 z-50 grid gap-1.5 rounded-xl border-2 border-black/70 bg-black/90 p-2 text-[11px] text-white shadow-2xl" style={{ fontFamily: 'system-ui, sans-serif' }}>
          <span className="opacity-60">371 · arrive from inspector with</span>
          <div className="flex gap-1">
            {(['reschedule', 'request-close', 'add-note'] as Intent[]).map((o) => (
              <button key={o} type="button" onClick={() => go({ open: o })} className="rounded-md border border-white/40 px-1.5 py-0.5 hover:bg-white/15">
                {o === 'reschedule' ? 'R' : o === 'request-close' ? 'C' : 'N'} · {o}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-1 opacity-80">
            <input type="checkbox" checked={showRetrySlot} onChange={(e) => setShowRetrySlot(e.target.checked)} />
            show reserved Retry slot
          </label>
        </div>
      )}

      <PrototypeSwitcher
        variants={VARIANTS.map(({ key, name }) => ({ key, name }))}
        variant={variant.key}
        onVariant={(k) => go({ variant: k })}
        scenarios={CASES.map(({ key, label, proves }) => ({ key, label, proves }))}
        scenario={caseKey}
        onScenario={(k) => go({ caseKey: k })}
      />
    </div>
  )
}
