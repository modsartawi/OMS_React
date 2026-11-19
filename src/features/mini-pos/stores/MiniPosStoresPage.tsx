import { useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Loader2, Plus, Printer, RefreshCw } from 'lucide-react'
import { apiErrorMessage } from '@/core/api'
import { canManageMiniPos, canViewMiniPos } from '@/core/mini-pos/access'
import { MINI_POS_TRIAL_ROLES, type MiniPosPrintedCode, type MiniPosStore, type MiniPosTrialRole } from '@/core/models/mini-pos'
import { usePermissions } from '@/core/permissions'
import { notify } from '@/core/services/notify'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Field from '@/core/ui/Field'
import Input from '@/core/ui/Input'
import ScreenGate from '@/core/ui/ScreenGate'
import Select from '@/core/ui/Select'
import { buttonClass } from '@/core/ui/control-classes'
import { fsi } from '@/core/util/bidi'
import { miniPosStoresApi } from './api'
import { addSteps, asTrialRole, printPath, storesShown, trialRoleKey } from './stores'
import { ReprintConfirm, StoresTable } from './StoreViews'

const NS = 'mini-pos-stores'
const LIST_KEY = ['mini-pos', 'stores', 'list'] as const

/**
 * Mini POS pharmacies (oms 915, BackOffice spec 4032, doors 4043): which pharmacies run Mini POS, each one's trial role
 * (Trial, Control or none), and its printed QR — print it, or reprint it, which retires every older print.
 *
 * Behind `canViewMiniPos` (`MiniPosAdmin:03`), failing closed; every change and the print behind `canManageMiniPos`
 * (`MiniPosAdmin:06`).
 */
export default function MiniPosStoresPage() {
  const { t } = useTranslation(NS)
  return (
    <ScreenGate can={canViewMiniPos} ns={NS} title={t('title')} subtitle={t('subtitle')}>
      <Stores />
    </ScreenGate>
  )
}

type Write = { storeCode: string; run: () => Promise<unknown>; done: string }

function Stores() {
  const { t } = useTranslation(NS)
  const queryClient = useQueryClient()
  const canManage = canManageMiniPos(usePermissions())
  const read = useQuery({ queryKey: LIST_KEY, queryFn: () => miniPosStoresApi.list(), retry: false })
  const [reprinting, setReprinting] = useState<MiniPosStore | null>(null)
  const [reprinted, setReprinted] = useState<MiniPosPrintedCode | null>(null)

  const refresh = () => void queryClient.invalidateQueries({ queryKey: LIST_KEY })

  const write = useMutation({
    mutationFn: (w: Write) => w.run(),
    onSuccess: (_, w) => {
      notify.success(w.done)
      refresh()
    },
    onError: (err, w) => notify.apiError(t('action.failed', { store: fsi(w.storeCode) }), err, t('failed')),
  })
  const reprint = useMutation({
    mutationFn: (store: MiniPosStore) => miniPosStoresApi.reprint(store.storeCode),
    onSuccess: (code) => {
      setReprinting(null)
      setReprinted(code)
      refresh()
    },
  })

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold">{t('list.title')}</h2>
        <Button variant="outlined" onClick={refresh} disabled={read.isFetching}>
          <RefreshCw className={`h-3.5 w-3.5 ${read.isFetching ? 'animate-spin' : ''}`} aria-hidden />
          {t('refresh')}
        </Button>
      </div>

      {reprinted && (
        <div
          role="status"
          className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-success-border bg-success-050 p-3 text-sm"
          data-minipos-reprinted={reprinted.storeCode}
        >
          <span>
            {t('reprint.done', { store: fsi(reprinted.storeCode), version: fsi(String(reprinted.version)) })}
          </span>
          <a href={printPath(reprinted.storeCode)} target="_blank" rel="noopener" className={buttonClass('primary')}>
            <Printer className="h-3.5 w-3.5" aria-hidden />
            {t('reprint.printNew')}
          </a>
        </div>
      )}

      {read.isError ? (
        <ErrorBanner className="p-2.5" title={t('list.failedTitle')} message={apiErrorMessage(read.error, t('failed'))} />
      ) : read.isPending ? (
        <p className="text-sm text-muted-foreground">{t('loading')}</p>
      ) : (
        <StoresTable
          stores={storesShown(read.data)}
          canManage={canManage}
          busyStore={write.isPending ? write.variables?.storeCode : reprint.isPending ? reprint.variables?.storeCode : null}
          onEnable={(s) =>
            write.mutate({ storeCode: s.storeCode, run: () => miniPosStoresApi.enable(s.storeCode), done: t('action.enabled', { store: fsi(s.storeCode) }) })
          }
          onDisable={(s) =>
            write.mutate({ storeCode: s.storeCode, run: () => miniPosStoresApi.disable(s.storeCode), done: t('action.disabled', { store: fsi(s.storeCode) }) })
          }
          onTrialRole={(s, role) =>
            write.mutate({
              storeCode: s.storeCode,
              run: () => miniPosStoresApi.setTrialRole(s.storeCode, role),
              done: t('action.roleSet', { store: fsi(s.storeCode), role: fsi(t(`trialRole.${trialRoleKey(role)}`)) }),
            })
          }
          onReprint={(s) => {
            reprint.reset()
            setReprinting(s)
          }}
        />
      )}

      {canManage && <AddStore onAdded={refresh} />}

      <ReprintConfirm
        store={reprinting}
        pending={reprint.isPending}
        error={reprint.isError ? apiErrorMessage(reprint.error, t('failed')) : ''}
        onConfirm={() => reprinting && !reprint.isPending && reprint.mutate(reprinting)}
        onClose={() => !reprint.isPending && setReprinting(null)}
      />
    </div>
  )
}

/** Add a pharmacy by its code: enable it (a trial or plain pharmacy) or only mark it a control. */
function AddStore({ onAdded }: { onAdded: () => void }) {
  const { t } = useTranslation(NS)
  const [code, setCode] = useState('')
  const [role, setRole] = useState<MiniPosTrialRole>('')
  const inFlight = useRef(false)
  const storeCode = code.trim().toUpperCase()

  const add = useMutation({
    mutationFn: async () => {
      for (const step of addSteps(role)) {
        if (step === 'enable') await miniPosStoresApi.enable(storeCode)
        else await miniPosStoresApi.setTrialRole(storeCode, role)
      }
    },
    onSettled: () => {
      inFlight.current = false
      onAdded()
    },
    onSuccess: () => {
      notify.success(t('add.done', { store: fsi(storeCode) }))
      setCode('')
      setRole('')
    },
  })

  return (
    <section className="flex flex-col gap-2" data-minipos-add-store="">
      <h2 className="text-base font-semibold">{t('add.title')}</h2>
      <form
        className="flex flex-wrap items-end gap-3 rounded-lg border border-border/60 bg-card/40 p-3"
        onSubmit={(e) => {
          e.preventDefault()
          if (inFlight.current || !storeCode) return
          inFlight.current = true
          add.mutate()
        }}
      >
        <Field id="minipos-add-store-code" label={t('add.store')}>
          <Input value={code} onChange={(e) => setCode(e.target.value)} className="w-32" />
        </Field>
        <Field id="minipos-add-store-role" label={t('list.trialRole')}>
          <Select value={role} onChange={(e) => setRole(asTrialRole(e.target.value))} className="w-36">
            {MINI_POS_TRIAL_ROLES.map((r) => (
              <option key={r} value={r}>
                {t(`trialRole.${trialRoleKey(r)}`)}
              </option>
            ))}
          </Select>
        </Field>
        <Button type="submit" variant="primary" disabled={!storeCode || add.isPending}>
          {add.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Plus className="h-3.5 w-3.5" aria-hidden />}
          {role === 'Control' ? t('add.markControl') : t('add.enable')}
        </Button>
        <p className="basis-full text-xs text-muted-foreground">{t('add.hint')}</p>
      </form>
      {add.isError && <ErrorBanner className="p-2.5" title={t('add.failedTitle')} message={apiErrorMessage(add.error, t('failed'))} />}
    </section>
  )
}
