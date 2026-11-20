import { useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Ban, Loader2, Plus } from 'lucide-react'
import { apiErrorMessage } from '@/core/api'
import { canManageMiniPos, canViewMiniPos } from '@/core/mini-pos/access'
import type { MiniPosAllowedCategory, MiniPosRefusedItem } from '@/core/models/mini-pos'
import { usePermissions } from '@/core/permissions'
import { notify } from '@/core/services/notify'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Field from '@/core/ui/Field'
import Input from '@/core/ui/Input'
import ScreenGate from '@/core/ui/ScreenGate'
import { fsi } from '@/core/util/bidi'
import { miniPosItemsApi } from './api'
import { CategoryList, RefusedList } from './ItemViews'
import { WIDTHS, categoryKey, categoryProblem, refusalProblem, refusedKey, withRow, withoutRow } from './items'

const NS = 'mini-pos-items'
const CATEGORIES_KEY = ['mini-pos', 'items', 'categories'] as const
const REFUSED_KEY = ['mini-pos', 'items', 'refused'] as const

/**
 * Mini POS items (oms 927, BackOffice spec 4063, doors 4074): which A-level categories a promoter may sell, and the items
 * refused whatever their category, each with its reason.
 *
 * Behind `canViewMiniPos` (`MiniPosAdmin:03`), failing closed; adds and removals behind `canManageMiniPos`
 * (`MiniPosAdmin:06`).
 */
export default function MiniPosItemsPage() {
  const { t } = useTranslation(NS)
  return (
    <ScreenGate can={canViewMiniPos} ns={NS} title={t('title')} subtitle={t('subtitle')}>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Categories />
        <Refused />
      </div>
    </ScreenGate>
  )
}

const SECTION = 'flex min-w-0 flex-col gap-2 rounded-lg border border-border/60 bg-card/40 p-3'

function Categories() {
  const { t } = useTranslation(NS)
  const queryClient = useQueryClient()
  const canManage = canManageMiniPos(usePermissions())
  const read = useQuery({ queryKey: CATEGORIES_KEY, queryFn: () => miniPosItemsApi.categories(), retry: false })
  const [code, setCode] = useState('')
  const [tried, setTried] = useState(false)
  const inFlight = useRef(false)
  const problem = categoryProblem(code)
  const update = (f: (list: MiniPosAllowedCategory[]) => MiniPosAllowedCategory[]) =>
    queryClient.setQueryData<MiniPosAllowedCategory[]>(CATEGORIES_KEY, (list) => f(list ?? []))

  const add = useMutation({
    mutationFn: (aCode: string) => miniPosItemsApi.addCategory(aCode),
    onSettled: () => {
      inFlight.current = false
    },
    onSuccess: (row, aCode) => {
      if (row) update((list) => withRow(list, row, categoryKey))
      notify.success(t('category.added', { code: fsi(row?.aCode ?? aCode) }))
      setCode('')
      setTried(false)
    },
  })
  const remove = useMutation({
    mutationFn: (aCode: string) => miniPosItemsApi.removeCategory(aCode),
    onSuccess: (_, aCode) => {
      update((list) => withoutRow(list, aCode, categoryKey))
      notify.success(t('category.removed', { code: fsi(aCode) }))
    },
    onError: (err) => notify.apiError(t('removeFailed'), err, t('failed')),
  })

  return (
    <section className={SECTION} data-minipos-categories="">
      <h2 className="text-base font-semibold">{t('category.title')}</h2>
      <p className="text-xs text-muted-foreground">{t('category.hint')}</p>
      {canManage && (
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            setTried(true)
            if (inFlight.current || problem) return
            inFlight.current = true
            add.mutate(code.trim().toUpperCase())
          }}
        >
          <Field id="minipos-category-code" label={t('category.code')}>
            <Input value={code} onChange={(e) => setCode(e.target.value)} maxLength={WIDTHS.aCode} className="w-32" />
          </Field>
          <Button type="submit" variant="primary" disabled={add.isPending} data-minipos-category-add="">
            {add.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Plus className="h-3.5 w-3.5" aria-hidden />}
            {t('category.add')}
          </Button>
          {tried && problem && <p className="basis-full text-xs text-attention-800">{t(`category.problem.${problem}`)}</p>}
        </form>
      )}
      {add.isError && <ErrorBanner className="p-2.5" title={t('addFailed')} message={apiErrorMessage(add.error, t('failed'))} />}
      {read.isError ? (
        <ErrorBanner className="p-2.5" title={t('readFailed')} message={apiErrorMessage(read.error, t('failed'))} />
      ) : read.isPending ? (
        <p className="text-sm text-muted-foreground">{t('loading')}</p>
      ) : (
        <CategoryList
          rows={read.data}
          canManage={canManage}
          busyKey={remove.isPending ? remove.variables : null}
          onRemove={(aCode) => remove.mutate(aCode)}
        />
      )}
    </section>
  )
}

function Refused() {
  const { t } = useTranslation(NS)
  const queryClient = useQueryClient()
  const canManage = canManageMiniPos(usePermissions())
  const read = useQuery({ queryKey: REFUSED_KEY, queryFn: () => miniPosItemsApi.refusedItems(), retry: false })
  const [item, setItem] = useState('')
  const [reason, setReason] = useState('')
  const [tried, setTried] = useState(false)
  const inFlight = useRef(false)
  const problem = refusalProblem(item, reason)
  const update = (f: (list: MiniPosRefusedItem[]) => MiniPosRefusedItem[]) =>
    queryClient.setQueryData<MiniPosRefusedItem[]>(REFUSED_KEY, (list) => f(list ?? []))

  const add = useMutation({
    mutationFn: () => miniPosItemsApi.addRefusedItem(item.trim(), reason.trim()),
    onSettled: () => {
      inFlight.current = false
    },
    onSuccess: (row) => {
      if (row) update((list) => withRow(list, row, refusedKey))
      notify.success(t('refused.added', { item: fsi(row?.itemNumber ?? item.trim()) }))
      setItem('')
      setReason('')
      setTried(false)
    },
  })
  const remove = useMutation({
    mutationFn: (itemNumber: string) => miniPosItemsApi.removeRefusedItem(itemNumber),
    onSuccess: (_, itemNumber) => {
      update((list) => withoutRow(list, itemNumber, refusedKey))
      notify.success(t('refused.removed', { item: fsi(itemNumber) }))
    },
    onError: (err) => notify.apiError(t('removeFailed'), err, t('failed')),
  })

  return (
    <section className={SECTION} data-minipos-refused-list="">
      <h2 className="text-base font-semibold">{t('refused.title')}</h2>
      <p className="text-xs text-muted-foreground">{t('refused.hint')}</p>
      {canManage && (
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            setTried(true)
            if (inFlight.current || problem) return
            inFlight.current = true
            add.mutate()
          }}
        >
          <Field id="minipos-refused-item" label={t('refused.item')}>
            <Input value={item} onChange={(e) => setItem(e.target.value)} maxLength={WIDTHS.itemNumber} className="w-36" />
          </Field>
          <Field id="minipos-refused-reason" label={t('refused.reason')} className="min-w-0 flex-1">
            <Input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={WIDTHS.reasonNote} className="w-full" />
          </Field>
          <Button type="submit" variant="primary" disabled={add.isPending} data-minipos-refused-add="">
            {add.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Ban className="h-3.5 w-3.5" aria-hidden />}
            {t('refused.add')}
          </Button>
          {tried && problem && <p className="basis-full text-xs text-attention-800">{t(`refused.problem.${problem}`)}</p>}
        </form>
      )}
      {add.isError && <ErrorBanner className="p-2.5" title={t('addFailed')} message={apiErrorMessage(add.error, t('failed'))} />}
      {read.isError ? (
        <ErrorBanner className="p-2.5" title={t('readFailed')} message={apiErrorMessage(read.error, t('failed'))} />
      ) : read.isPending ? (
        <p className="text-sm text-muted-foreground">{t('loading')}</p>
      ) : (
        <RefusedList
          rows={read.data}
          canManage={canManage}
          busyKey={remove.isPending ? remove.variables : null}
          onRemove={(itemNumber) => remove.mutate(itemNumber)}
        />
      )}
    </section>
  )
}
