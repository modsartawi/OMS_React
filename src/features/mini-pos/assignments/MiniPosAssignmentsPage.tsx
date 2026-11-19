import { useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Loader2, Plus, RefreshCw, Search } from 'lucide-react'
import { apiErrorMessage } from '@/core/api'
import { canManageMiniPos, canViewMiniPos } from '@/core/mini-pos/access'
import type { MiniPosAssignment } from '@/core/models/mini-pos'
import { usePermissions } from '@/core/permissions'
import { notify } from '@/core/services/notify'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Field from '@/core/ui/Field'
import Input from '@/core/ui/Input'
import Modal from '@/core/ui/Modal'
import ScreenGate from '@/core/ui/ScreenGate'
import Select from '@/core/ui/Select'
import { fsi } from '@/core/util/bidi'
import { toIsoDate } from '@/core/util/date-format'
import { miniPosAssignmentsApi } from './api'
import { EMPTY_DRAFT, MAX_HOURS, draftProblem, overlapOf, promoterLabel, refusalKey, toRequest, type AssignmentDraft } from './assignments'
import { AssignmentTable, OverlapNotice, TodayView } from './AssignmentViews'

const NS = 'mini-pos-assignments'
const TODAY_KEY = ['mini-pos', 'assignments', 'today'] as const
const FIND_KEY = ['mini-pos', 'assignments', 'find'] as const

/**
 * Mini POS assignments (oms 915, BackOffice spec 4032, doors 4043): who is where today, add a row with its days and
 * planned hours, end one row, and "end this promoter now" (every current and future row, and the phone's sessions).
 * Overlaps are the server's to judge: its refusal names the clashing row and the screen shows it.
 *
 * Behind `canViewMiniPos` (`MiniPosAdmin:03`), failing closed; every change behind `canManageMiniPos` (`MiniPosAdmin:06`).
 */
export default function MiniPosAssignmentsPage() {
  const { t } = useTranslation(NS)
  return (
    <ScreenGate can={canViewMiniPos} ns={NS} title={t('title')} subtitle={t('subtitle')}>
      <Assignments />
    </ScreenGate>
  )
}

type Pending = { kind: 'end' | 'endPromoter'; row: MiniPosAssignment } | null

function Assignments() {
  const { t } = useTranslation(NS)
  const queryClient = useQueryClient()
  const canManage = canManageMiniPos(usePermissions())
  // Local wall-clock day (no-utc-time): rows start today or later, and a past row offers no End.
  const today = toIsoDate(new Date())
  const [pending, setPending] = useState<Pending>(null)
  const [filter, setFilter] = useState({ promoter: '', store: '', includeHistory: false })
  const [asked, setAsked] = useState<typeof filter | null>(null)

  const todayRead = useQuery({ queryKey: TODAY_KEY, queryFn: () => miniPosAssignmentsApi.today(), retry: false })
  const found = useQuery({
    queryKey: [...FIND_KEY, asked],
    queryFn: () => miniPosAssignmentsApi.find(asked!),
    enabled: asked !== null,
    retry: false,
  })

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: TODAY_KEY })
    void queryClient.invalidateQueries({ queryKey: FIND_KEY })
  }

  const end = useMutation({
    mutationFn: (row: MiniPosAssignment) => miniPosAssignmentsApi.end(row.assignmentId),
    onSuccess: (_, row) => {
      notify.success(t('end.done.title'), t('end.done.detail', { promoter: fsi(promoterLabel(row)), store: fsi(row.storeCode) }))
      setPending(null)
      refresh()
    },
  })
  const endPromoter = useMutation({
    mutationFn: (row: MiniPosAssignment) => miniPosAssignmentsApi.endPromoterNow(row.promoterLoginId),
    onSuccess: (result, row) => {
      notify.success(
        t('endPromoter.done.title', { promoter: fsi(promoterLabel(row)) }),
        t('endPromoter.done.detail', {
          rows: fsi(String(result?.endedAssignmentIds?.length ?? 0)),
          sessions: fsi(String(result?.revokedSessions ?? 0)),
        }),
      )
      setPending(null)
      refresh()
    },
  })
  const confirming = pending?.kind === 'end' ? end : endPromoter
  const actions = {
    canManage,
    today,
    busy: end.isPending || endPromoter.isPending,
    onEnd: (row: MiniPosAssignment) => {
      end.reset()
      setPending({ kind: 'end', row })
    },
    onEndPromoter: (row: MiniPosAssignment) => {
      endPromoter.reset()
      setPending({ kind: 'endPromoter', row })
    },
  }

  return (
    <div className="flex flex-col gap-4">
      <section className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold">{t('today.title')}</h2>
          <Button variant="outlined" onClick={refresh} disabled={todayRead.isFetching} data-minipos-refresh="">
            <RefreshCw className={`h-3.5 w-3.5 ${todayRead.isFetching ? 'animate-spin' : ''}`} aria-hidden />
            {t('refresh')}
          </Button>
        </div>
        {todayRead.isError ? (
          <ErrorBanner className="p-2.5" title={t('today.failedTitle')} message={apiErrorMessage(todayRead.error, t('failed'))} />
        ) : todayRead.isPending ? (
          <p className="text-sm text-muted-foreground">{t('loading')}</p>
        ) : (
          <TodayView rows={todayRead.data} {...actions} />
        )}
      </section>

      {canManage && <AddForm today={today} onAdded={refresh} />}

      <section className="flex flex-col gap-2" data-minipos-find="">
        <h2 className="text-base font-semibold">{t('find.title')}</h2>
        <form
          className="flex flex-wrap items-end gap-3 rounded-lg border border-border/60 bg-card/40 p-3"
          onSubmit={(e) => {
            e.preventDefault()
            setAsked({ ...filter, promoter: filter.promoter.trim(), store: filter.store.trim().toUpperCase() })
          }}
        >
          <Field id="minipos-find-promoter" label={t('find.promoter')}>
            <Input value={filter.promoter} onChange={(e) => setFilter({ ...filter, promoter: e.target.value })} className="w-40" />
          </Field>
          <Field id="minipos-find-store" label={t('find.store')}>
            <Input value={filter.store} onChange={(e) => setFilter({ ...filter, store: e.target.value })} className="w-32" />
          </Field>
          <Field id="minipos-find-history" label={t('find.which')}>
            <Select
              value={filter.includeHistory ? 'all' : 'current'}
              onChange={(e) => setFilter({ ...filter, includeHistory: e.target.value === 'all' })}
              className="w-44"
            >
              <option value="current">{t('find.current')}</option>
              <option value="all">{t('find.all')}</option>
            </Select>
          </Field>
          <Button type="submit" variant="secondary" disabled={!filter.promoter.trim() && !filter.store.trim()}>
            <Search className="h-3.5 w-3.5" aria-hidden />
            {t('find.go')}
          </Button>
        </form>
        {asked &&
          (found.isError ? (
            <ErrorBanner className="p-2.5" title={t('find.failedTitle')} message={apiErrorMessage(found.error, t('failed'))} />
          ) : found.isPending ? (
            <p className="text-sm text-muted-foreground">{t('loading')}</p>
          ) : found.data.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('find.empty')}</p>
          ) : (
            <AssignmentTable rows={found.data} {...actions} />
          ))}
      </section>

      <Modal
        open={pending !== null}
        onClose={() => setPending(null)}
        title={pending?.kind === 'endPromoter' ? t('endPromoter.title') : t('end.title')}
        footer={
          <>
            <Button variant="text" onClick={() => setPending(null)} disabled={confirming.isPending}>
              {t('cancel')}
            </Button>
            <Button
              variant="danger"
              disabled={confirming.isPending}
              onClick={() => pending && (pending.kind === 'end' ? end.mutate(pending.row) : endPromoter.mutate(pending.row))}
              data-minipos-confirm={pending?.kind ?? ''}
            >
              {confirming.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
              {pending?.kind === 'endPromoter' ? t('endPromoter.confirm') : t('end.confirm')}
            </Button>
          </>
        }
      >
        {pending && (
          <div className="flex flex-col gap-2 p-3 text-sm">
            <p>
              {pending.kind === 'endPromoter'
                ? t('endPromoter.body', { promoter: fsi(promoterLabel(pending.row)) })
                : t('end.body', { promoter: fsi(promoterLabel(pending.row)), store: fsi(pending.row.storeCode) })}
            </p>
            {confirming.isError && (
              <ErrorBanner
                className="p-2.5"
                title={t('end.failedTitle')}
                message={refusalMessage(t, confirming.error)}
              />
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}

/** A refusal in the screen's words when it has them, else the server's sentence. */
function refusalMessage(t: (key: string) => string, err: unknown): string {
  const key = refusalKey(err)
  return key ? t(`refusal.${key}`) : apiErrorMessage(err, t('failed'))
}

function AddForm({ today, onAdded }: { today: string; onAdded: () => void }) {
  const { t } = useTranslation(NS)
  const [draft, setDraft] = useState<AssignmentDraft>(() => EMPTY_DRAFT(today))
  const [tried, setTried] = useState(false)
  const inFlight = useRef(false)
  const problem = draftProblem(draft, today)
  const set = (patch: Partial<AssignmentDraft>) => setDraft((d) => ({ ...d, ...patch }))

  const add = useMutation({
    mutationFn: () => miniPosAssignmentsApi.add(toRequest(draft)),
    onSettled: () => {
      inFlight.current = false
    },
    onSuccess: (row) => {
      notify.success(
        t('add.done.title'),
        t('add.done.detail', { promoter: fsi(row ? promoterLabel(row) : draft.promoterLoginId), store: fsi(row?.storeCode ?? draft.storeCode) }),
      )
      setDraft(EMPTY_DRAFT(today))
      setTried(false)
      onAdded()
    },
  })
  const clash = add.isError ? overlapOf(add.error) : null

  return (
    <section className="flex flex-col gap-2" data-minipos-add="">
      <h2 className="text-base font-semibold">{t('add.title')}</h2>
      <form
        className="flex flex-col gap-3 rounded-lg border border-border/60 bg-card/40 p-3"
        onSubmit={(e) => {
          e.preventDefault()
          setTried(true)
          if (inFlight.current || problem) return
          inFlight.current = true
          add.mutate()
        }}
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Field id="minipos-add-promoter" label={t('add.promoter')} hint={t('add.promoterHint')}>
            <Input value={draft.promoterLoginId} onChange={(e) => set({ promoterLoginId: e.target.value })} className="w-full" />
          </Field>
          <Field id="minipos-add-staff" label={t('add.staff')}>
            <Input value={draft.promoterStaffId} onChange={(e) => set({ promoterStaffId: e.target.value })} className="w-full" />
          </Field>
          <Field id="minipos-add-store" label={t('add.store')}>
            <Input value={draft.storeCode} onChange={(e) => set({ storeCode: e.target.value })} className="w-full" />
          </Field>
          <Field id="minipos-add-from" label={t('add.from')}>
            <Input type="date" min={today} value={draft.fromDate} onChange={(e) => set({ fromDate: e.target.value })} className="w-full" />
          </Field>
          <Field id="minipos-add-to" label={t('add.to')}>
            <Input
              type="date"
              min={draft.fromDate || today}
              value={draft.toDate}
              onChange={(e) => set({ toDate: e.target.value })}
              className="w-full"
            />
          </Field>
          <Field id="minipos-add-hours" label={t('add.hours')}>
            <Input
              type="number"
              inputMode="decimal"
              min={0.5}
              max={MAX_HOURS}
              step={0.5}
              value={draft.hours}
              onChange={(e) => set({ hours: e.target.value })}
              className="w-full"
            />
          </Field>
        </div>
        {tried && problem && (
          <p className="text-xs text-attention-800" data-minipos-add-problem={problem}>
            {t(`add.problem.${problem}`)}
          </p>
        )}
        {clash ? (
          <OverlapNotice clash={clash} message={apiErrorMessage(add.error, '')} />
        ) : (
          add.isError && <ErrorBanner className="p-2.5" title={t('add.failedTitle')} message={refusalMessage(t, add.error)} />
        )}
        <div className="flex justify-end">
          <Button type="submit" variant="primary" disabled={add.isPending} data-minipos-add-commit="">
            {add.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Plus className="h-3.5 w-3.5" aria-hidden />}
            {t('add.commit')}
          </Button>
        </div>
      </form>
    </section>
  )
}
