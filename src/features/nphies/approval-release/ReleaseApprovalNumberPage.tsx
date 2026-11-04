import { useState, type FormEvent, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { SearchX, Unlock } from 'lucide-react'

import { apiErrorMessage } from '@/core/api'
import type { AuthDetail, NphiesAccessResult } from '@/core/models/nphies'
import { NPHIES_ACCESS_KEY, nphiesAccessApi } from '@/core/nphies/api'
import { authVerdictSeverity, deriveAuthAxes, requestSeverity } from '@/core/nphies/status'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Field from '@/core/ui/Field'
import Input from '@/core/ui/Input'
import Ltr from '@/core/ui/Ltr'
import ScreenGate from '@/core/ui/ScreenGate'
import StatusBadge from '@/core/ui/StatusBadge'
import { fsi } from '@/core/util/bidi'
import { approvalReleaseApi, releaseAuthKey, releaseHistoryKey } from './api'
import ReleaseDialog from './ReleaseDialog'
import ReleaseHistory from './ReleaseHistory'
import { lookupState, refusalKey, releaseBody, releaseOffer } from './release-rules'

/**
 * **Release approval number** (ticket 751, BackOffice spec 3342) — support finds one authorization
 * by its bundle Id and frees its approval number, so a pharmacist's new approval on that number is
 * no longer refused as a duplicate.
 *
 * The bundle Id lives in the URL (`?id=`), so a refresh re-reads the same authorization and a
 * support agent can paste the link into a ticket. The read runs on Search only; nothing here polls.
 *
 * 🚩 Two grants, one probe. The Nphies grant fences the page (the `ScreenGate`, on the area's ONE
 * key); `canReleaseApprovalNumber` on the same answer shows or hides the button. Neither is the
 * gate — the release POST's own filter is.
 */
const nphiesAccessQuery = {
  queryKey: NPHIES_ACCESS_KEY,
  queryFn: () => nphiesAccessApi.access(),
  staleTime: Infinity,
  retry: false,
} as const

const canOpenNphies = (r: NphiesAccessResult | null | undefined) => r?.canOpenNphies === true

const CLAIM_TYPES = new Set([0, 1, 2, 3, 4, 6])

export default function ReleaseApprovalNumberPage() {
  const { t } = useTranslation('approval-release')
  return (
    <ScreenGate
      query={nphiesAccessQuery}
      can={canOpenNphies}
      ns="approval-release"
      title={t('title')}
      subtitle={t('subtitle')}
    >
      <ReleaseBody />
    </ScreenGate>
  )
}

function ReleaseBody() {
  const { t } = useTranslation('approval-release')
  const queryClient = useQueryClient()
  const [params, setParams] = useSearchParams()
  const id = (params.get('id') ?? '').trim()
  const [draft, setDraft] = useState(id)
  const [dialogOpen, setDialogOpen] = useState(false)

  const access = useQuery(nphiesAccessQuery)

  const auth = useQuery({
    queryKey: releaseAuthKey(id),
    queryFn: () => approvalReleaseApi.authorization(id),
    enabled: id !== '',
    // A refusal is an answer: an unknown id must not be asked three more times.
    retry: false,
  })

  const state = lookupState({ id, isPending: auth.isPending, error: auth.error, hasData: auth.data !== undefined })

  const release = useMutation({
    mutationFn: (note: string) => approvalReleaseApi.release(releaseBody(id, note)),
    onSuccess: (result) => {
      // The summary shows the new value at once, from the act's own answer — the detail is the
      // door's heaviest read and re-reading it would fetch every attachment again.
      queryClient.setQueryData<AuthDetail>(releaseAuthKey(id), (old) =>
        old ? { ...old, preAuthRef: result.after } : old,
      )
      void queryClient.invalidateQueries({ queryKey: releaseHistoryKey(id) })
      setDialogOpen(false)
      toast.success(t('done.title'), { description: t('done.detail', { after: fsi(result.after) }) })
    },
    onError: (err) => {
      // Someone else may have released it, or dispensed it, since this page read it: the row on
      // screen is stale, so it is read again (and the history with it) behind the open dialog.
      if (refusalKey(err) !== null) {
        void queryClient.invalidateQueries({ queryKey: releaseAuthKey(id) })
        void queryClient.invalidateQueries({ queryKey: releaseHistoryKey(id) })
      }
    },
  })

  const onSearch = (e: FormEvent) => {
    e.preventDefault()
    const next = draft.trim()
    if (next === '') return
    release.reset()
    if (next === id) void auth.refetch()
    else setParams({ id: next })
  }

  const detail = auth.data
  const offer = detail ? releaseOffer(access.data?.canReleaseApprovalNumber, detail) : null

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={onSearch} className="flex flex-wrap items-end gap-2">
        <Field label={t('search.label')} className="w-80 max-w-full">
          <Input
            type="search"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={t('search.placeholder')}
            dir="ltr"
            className="font-mono"
            data-testid="bundle-id"
          />
        </Field>
        <Button type="submit" disabled={draft.trim() === ''} data-testid="bundle-search">
          {t('search.submit')}
        </Button>
      </form>

      {state === 'loading' && (
        <div className="flex flex-col gap-2" role="status" aria-label={t('lookup.loading')}>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-8 animate-pulse rounded-md bg-muted" />
          ))}
        </div>
      )}

      {state === 'notFound' && (
        <div
          className="flex items-start gap-3 rounded-lg border border-border/60 bg-card p-4"
          role="alert"
          data-testid="not-found"
        >
          <SearchX className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
          <div>
            <div className="text-sm font-semibold">{t('lookup.notFoundTitle')}</div>
            <p className="text-sm text-muted-foreground">
              {t('lookup.notFoundHint')} <Ltr>{id}</Ltr>
            </p>
          </div>
        </div>
      )}

      {state === 'error' && (
        <ErrorBanner
          title={t('lookup.errorTitle')}
          message={apiErrorMessage(auth.error, t('lookup.errorFallback'))}
          className="p-3"
        />
      )}

      {state === 'found' && detail && offer && (
        <>
          <Summary detail={detail} />

          <section className="flex flex-col gap-2" data-testid="release-act">
            {offer.offered ? (
              <div>
                <Button variant="danger" onClick={() => setDialogOpen(true)} data-testid="release-open">
                  <Unlock className="h-3.5 w-3.5" aria-hidden />
                  {t('act.release')}
                </Button>
                {detail.isDispensed === undefined && (
                  <p className="mt-1 text-xs text-muted-foreground">{t('act.dispensedUnknown')}</p>
                )}
              </div>
            ) : (
              offer.reason && (
                <p className="text-sm text-muted-foreground" data-testid="release-withheld">
                  {t(`act.withheld.${offer.reason}`)}
                </p>
              )
            )}
          </section>

          <ReleaseHistory authId={detail.id || id} />

          <ReleaseDialog
            approvalNumber={dialogOpen ? detail.preAuthRef : null}
            busy={release.isPending}
            error={release.error}
            onClose={() => {
              setDialogOpen(false)
              release.reset()
            }}
            onConfirm={(note) => release.mutate(note)}
          />
        </>
      )}
    </div>
  )
}

function Summary({ detail }: { detail: AuthDetail }) {
  const { t } = useTranslation('approval-release')
  const axes = deriveAuthAxes(detail)
  const yesNo = (v: boolean | undefined) =>
    v === undefined ? t('summary.unknown') : v ? t('summary.yes') : t('summary.no')
  const claimType = CLAIM_TYPES.has(detail.claimType)
    ? t(`claimType.${detail.claimType}`)
    : t('claimType.other', { code: fsi(detail.claimType) })

  return (
    <dl
      className="grid grid-cols-2 gap-x-6 gap-y-3 rounded-lg border border-border/60 bg-card/40 p-4 sm:grid-cols-3 lg:grid-cols-4"
      data-testid="release-summary"
    >
      <Fact label={t('summary.id')}>
        <Ltr>{detail.id}</Ltr>
      </Fact>
      <Fact label={t('summary.approvalNumber')}>
        {detail.preAuthRef ? (
          <span className="font-mono" data-testid="approval-number">
            <Ltr>{detail.preAuthRef}</Ltr>
          </span>
        ) : (
          <span className="text-muted-foreground">{t('summary.empty')}</span>
        )}
      </Fact>
      <Fact label={t('summary.payer')}>
        <Ltr>{detail.payerCode}</Ltr>
      </Fact>
      <Fact label={t('summary.patient')}>
        <span className="flex flex-col">
          <bdi>{detail.patientName}</bdi>
          <span className="text-xs text-muted-foreground">
            <Ltr>{detail.patientId}</Ltr>
          </span>
        </span>
      </Fact>
      <Fact label={t('summary.claimType')}>{claimType}</Fact>
      <Fact label={t('summary.request')}>
        <StatusBadge sev={requestSeverity(axes.request)}>{t(`request.${axes.request}`)}</StatusBadge>
      </Fact>
      <Fact label={t('summary.verdict')}>
        {axes.verdict ? (
          <StatusBadge sev={authVerdictSeverity(axes.verdict)}>{t(`verdict.${axes.verdict}`)}</StatusBadge>
        ) : (
          <span className="text-muted-foreground">{t('summary.verdictBlank')}</span>
        )}
      </Fact>
      <Fact label={t('summary.dispensed')}>{yesNo(detail.isDispensed)}</Fact>
      <Fact label={t('summary.cancelled')}>{yesNo(detail.cancelled)}</Fact>
    </dl>
  )
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="text-sm text-foreground">{children}</dd>
    </div>
  )
}
