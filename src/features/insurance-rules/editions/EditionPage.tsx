import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'
import { ArrowLeft, Download, Loader2 } from 'lucide-react'

import { apiErrorMessage, isBareDenial } from '@/core/api'
import { guardRulePath } from '@/core/insurance-rules/model'
import SaysBoth from '@/core/rules/SaysBoth'
import { confirmAction } from '@/core/services/confirm'
import { notify } from '@/core/services/notify'
import { useSession } from '@/core/session'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Ltr from '@/core/ui/Ltr'
import { saveBlob } from '@/core/util/download-file'
import { fsi } from '@/core/util/bidi'
import { formatFigure } from '@/core/util/number-format'
import { EDITIONS_KEY, diffQuery, editionsApi, gapsQuery, historyQuery } from './api'
import {
  GAP_KINDS,
  diffCounts,
  editionsPath,
  gapCounts,
  gapsFileName,
  gapsOfKind,
  isEditionList,
  liveEdition,
  publishGate,
  unmatchedRows,
  type Edition,
  type EditionDiff,
  type GapKind,
} from './editions'
import { ByAt, DeniedCard, EditionStateBadge } from './parts'

/**
 * Insurance rules ▸ Editions ▸ one edition — `/insurance-rules/editions/:list/:id` (BackOffice 3138, oms 613).
 * Its diff against the live edition (rows added / dropped / changed, items newly unmatched) and the rules it
 * affects with their back-test fires; Publish, which a DIFFERENT user than the uploader does; and its gap
 * report (no match / junk code / GTIN mismatch / withdrawn) with an export for the master-file team. A live or
 * retired edition is read-only.
 *
 * The edition's own row is read from the list's history (`GET …/Editions?list=`): the brief has no per-edition
 * door, so the list is in the address beside the id (a guess recorded on the ticket).
 */
export default function EditionPage() {
  const { t } = useTranslation('insurance-editions')
  const { list = '', id = '' } = useParams()
  const known = isEditionList(list) ? list : 'sfda'
  const history = useQuery(historyQuery(known))
  const edition = history.data?.find((e) => e.id === id)

  let body
  if (history.isError && isBareDenial(history.error)) body = <DeniedCard hook="edition-denied" />
  else if (history.isError) body = <ErrorBanner className="p-3" message={apiErrorMessage(history.error, t('edition.failed'))} />
  else if (!history.data) body = <Loading text={t('edition.loading')} />
  else if (!isEditionList(list) || !edition)
    body = (
      <p className="rounded-md border border-border/60 p-4 text-sm" data-edition-not-found="">
        {t('edition.notFound')} <Ltr>{id}</Ltr>
      </p>
    )
  else body = <EditionBody edition={edition} live={liveEdition(history.data.filter((e) => e.id !== edition.id))} />

  return (
    <section className="flex h-full w-full flex-col gap-4" data-edition-page="">
      <Link to={editionsPath(known)} className="inline-flex w-fit items-center gap-1 text-sm text-primary hover:underline" data-back="">
        <ArrowLeft className="h-4 w-4 rtl:rotate-180" aria-hidden />
        {t('edition.back')}
      </Link>
      {body}
    </section>
  )
}

function Loading({ text }: { text: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground" role="status">
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
      {text}
    </div>
  )
}

function EditionBody({ edition, live }: { edition: Edition; live: Edition | null }) {
  const { t } = useTranslation('insurance-editions')
  return (
    <>
      <header className="flex flex-col gap-2" data-edition-header="">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-lg font-semibold tracking-tight" data-edition-id="">
            {t(`listName.${edition.list}`)} <Ltr>{edition.id}</Ltr>
          </h1>
          <EditionStateBadge state={edition.state} />
        </div>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-muted-foreground">{t('columns.file')}</dt>
          <dd data-edition-file="">
            <bdi>{edition.fileName ?? ''}</bdi>
          </dd>
          <dt className="text-muted-foreground">{t('columns.uploaded')}</dt>
          <dd data-edition-uploaded="">
            <ByAt by={edition.uploadedBy} at={edition.uploadedAt} />
          </dd>
          {edition.publishedBy && (
            <>
              <dt className="text-muted-foreground">{t('columns.published')}</dt>
              <dd data-edition-published="">
                <ByAt by={edition.publishedBy} at={edition.publishedAt} />
              </dd>
            </>
          )}
        </dl>
      </header>
      {edition.state === 'pending' ? (
        <PublishPanel edition={edition} />
      ) : (
        <p className="rounded-md border border-border/60 bg-muted/40 px-3 py-2 text-sm text-muted-foreground" data-read-only="">
          {t(`edition.readOnly.${edition.state}`)}
        </p>
      )}
      <DiffSection edition={edition} live={live} />
      <GapsSection edition={edition} />
    </>
  )
}

function PublishPanel({ edition }: { edition: Edition }) {
  const { t } = useTranslation('insurance-editions')
  const queryClient = useQueryClient()
  const userId = useSession((s) => s.userId)
  const gate = publishGate(edition, userId)
  const publish = useMutation({
    mutationFn: () => editionsApi.publish(edition.id),
    onSuccess: async () => {
      notify.success(t('publish.done'), t('publish.doneDetail', { id: fsi(edition.id) }))
      await queryClient.invalidateQueries({ queryKey: EDITIONS_KEY })
    },
  })
  const onPublish = async () => {
    if (!gate.can || publish.isPending) return
    if (await confirmAction(t('publish.confirmBody', { id: fsi(edition.id), list: t(`listName.${edition.list}`) }), t('publish.confirmTitle'))) publish.mutate()
  }
  return (
    <div className="flex flex-col gap-2 rounded-md border border-border/60 bg-card p-3" data-publish="">
      <div className="text-sm font-medium">{t('publish.title')}</div>
      <p className="text-xs text-muted-foreground">{t('publish.hint')}</p>
      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="primary"
          data-publish-submit=""
          aria-disabled={!gate.can || publish.isPending}
          title={gate.why ? t(`publish.why.${gate.why}`) : undefined}
          onClick={onPublish}
        >
          {publish.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
          {t('publish.submit')}
        </Button>
        {gate.why && (
          <span className="text-xs text-muted-foreground" data-publish-why={gate.why}>
            {t(`publish.why.${gate.why}`)}
          </span>
        )}
      </div>
      {publish.isError && (
        <div data-publish-refused="">
          <ErrorBanner message={apiErrorMessage(publish.error, t('publish.failed'))} />
        </div>
      )}
    </div>
  )
}

const COUNT_KEYS = ['added', 'dropped', 'changed', 'newlyUnmatched'] as const

function DiffSection({ edition, live }: { edition: Edition; live: Edition | null }) {
  const { t } = useTranslation('insurance-editions')
  const diff = useQuery(diffQuery(edition.id))
  return (
    <section className="flex flex-col gap-3" data-diff="">
      <div>
        <h2 className="text-base font-semibold tracking-tight">{t('diff.title')}</h2>
        <p className="text-xs text-muted-foreground" data-diff-against="">
          {t('diff.against')} {live ? <Ltr>{live.id}</Ltr> : t('diff.noLive')}
        </p>
      </div>
      {diff.isError ? (
        isBareDenial(diff.error) ? (
          <DeniedCard hook="diff-denied" />
        ) : (
          <ErrorBanner message={apiErrorMessage(diff.error, t('diff.failed'))} />
        )
      ) : !diff.data ? (
        <Loading text={t('diff.loading')} />
      ) : (
        <DiffBody diff={diff.data} />
      )}
    </section>
  )
}

function DiffBody({ diff }: { diff: EditionDiff }) {
  const { t } = useTranslation('insurance-editions')
  const counts = diffCounts(diff)
  const unmatched = unmatchedRows(diff)
  return (
    <>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {COUNT_KEYS.map((k) => (
          <div key={k} className="rounded-md border border-border/60 bg-card p-3" data-diff-count={k}>
            <div className="text-xs text-muted-foreground">{t(`diff.${k}`)}</div>
            <div className="text-lg font-semibold">
              <Ltr>{formatFigure(counts[k])}</Ltr>
            </div>
          </div>
        ))}
      </div>
      {unmatched.length > 0 && (
        <div className="flex flex-col gap-1">
          <h3 className="text-sm font-medium">{t('diff.unmatchedTitle')}</h3>
          <div className="overflow-x-auto rounded-md border border-border/60">
            <table className="w-full text-sm" data-unmatched="">
              <thead className="bg-muted/50 text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-start font-medium">{t('columns.item')}</th>
                  <th className="px-3 py-2 text-start font-medium">{t('columns.itemName')}</th>
                  <th className="px-3 py-2 text-start font-medium">{t('columns.sfdaCode')}</th>
                </tr>
              </thead>
              <tbody>
                {unmatched.map((u) => (
                  <tr key={u.item} className="border-t border-border/60" data-unmatched-row={u.item}>
                    <td className="px-3 py-2" data-col="item">
                      <Ltr>{u.item}</Ltr>
                    </td>
                    <td className="px-3 py-2">{u.itemName && <SaysBoth says={u.itemName} />}</td>
                    <td className="px-3 py-2" data-col="sfdaCode">
                      {u.sfdaCode && <Ltr>{u.sfdaCode}</Ltr>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <div className="flex flex-col gap-1">
        <h3 className="text-sm font-medium">{t('diff.rulesTitle')}</h3>
        <p className="text-xs text-muted-foreground">{t('diff.rulesHint')}</p>
        {diff.rulesAffected.length === 0 ? (
          <p className="text-sm text-muted-foreground" data-rules-none="">
            {t('diff.rulesNone')}
          </p>
        ) : (
          <div className="overflow-x-auto rounded-md border border-border/60">
            <table className="w-full text-sm" data-rules-affected="">
              <thead className="bg-muted/50 text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-start font-medium">{t('columns.rule')}</th>
                  <th className="px-3 py-2 text-end font-medium">{t('columns.backtestFires')}</th>
                </tr>
              </thead>
              <tbody>
                {diff.rulesAffected.map((r) => (
                  <tr key={r.ruleId} className="border-t border-border/60" data-rule-affected={r.ruleId}>
                    <td className="px-3 py-2">
                      <Link to={guardRulePath(r.ruleId)} className="text-primary hover:underline">
                        <Ltr>{r.ruleId}</Ltr>
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-end" data-col="fires">
                      <Ltr>{formatFigure(r.backtestFires)}</Ltr>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )
}

function GapsSection({ edition }: { edition: Edition }) {
  const { t } = useTranslation('insurance-editions')
  const gaps = useQuery(gapsQuery(edition.id))
  const [kind, setKind] = useState<GapKind | null>(null)
  const [exporting, setExporting] = useState(false)
  const rows = useMemo(() => gapsOfKind(gaps.data ?? [], kind), [gaps.data, kind])
  const counts = useMemo(() => gapCounts(gaps.data ?? []), [gaps.data])

  const onExport = async () => {
    setExporting(true)
    try {
      const file = await editionsApi.exportGaps(edition.id)
      saveBlob(file.filename ?? gapsFileName(edition.id), file.blob)
    } catch (err) {
      notify.apiError(t('gaps.exportFailed'), err, t('gaps.exportFailed'))
    } finally {
      setExporting(false)
    }
  }

  return (
    <section className="flex flex-col gap-3" data-gaps="">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold tracking-tight">{t('gaps.title')}</h2>
          <p className="text-xs text-muted-foreground">{t('gaps.hint')}</p>
        </div>
        <Button variant="outlined" data-gaps-export="" disabled={exporting || !gaps.data || gaps.data.length === 0} onClick={onExport}>
          {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Download className="h-3.5 w-3.5" aria-hidden />}
          {t('gaps.export')}
        </Button>
      </div>
      {gaps.isError ? (
        isBareDenial(gaps.error) ? (
          <DeniedCard hook="gaps-denied" />
        ) : (
          <ErrorBanner message={apiErrorMessage(gaps.error, t('gaps.failed'))} />
        )
      ) : !gaps.data ? (
        <Loading text={t('gaps.loading')} />
      ) : gaps.data.length === 0 ? (
        <p className="rounded-md border border-border/60 py-6 text-center text-sm text-muted-foreground" data-gaps-empty="">
          {t('gaps.empty')}
        </p>
      ) : (
        <>
          <div className="flex flex-wrap gap-1" role="group" aria-label={t('gaps.filter')}>
            <KindChip label={t('gaps.all')} count={gaps.data.length} pressed={kind === null} hook="" onClick={() => setKind(null)} />
            {GAP_KINDS.map((k) => (
              <KindChip key={k} label={t(`gapKind.${k}`)} count={counts[k]} pressed={kind === k} hook={k} onClick={() => setKind(k)} />
            ))}
          </div>
          <div className="overflow-x-auto rounded-md border border-border/60">
            <table className="w-full text-sm" data-gaps-table="">
              <thead className="bg-muted/50 text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-start font-medium">{t('columns.kind')}</th>
                  <th className="px-3 py-2 text-start font-medium">{t('columns.item')}</th>
                  <th className="px-3 py-2 text-start font-medium">{t('columns.itemName')}</th>
                  <th className="px-3 py-2 text-start font-medium">{t('columns.sfdaCode')}</th>
                  <th className="px-3 py-2 text-start font-medium">{t('columns.gtin')}</th>
                  <th className="px-3 py-2 text-start font-medium">{t('columns.sfdaGtin')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((g, i) => (
                  <tr key={`${g.kind}-${g.item ?? ''}-${i}`} className="border-t border-border/60" data-gap-row={g.kind} data-item={g.item ?? ''}>
                    <td className="px-3 py-2">{t(`gapKind.${g.kind}`, { defaultValue: g.kind })}</td>
                    <td className="px-3 py-2" data-col="item">
                      {g.item && <Ltr>{g.item}</Ltr>}
                    </td>
                    <td className="px-3 py-2">{g.itemName && <SaysBoth says={g.itemName} />}</td>
                    <td className="px-3 py-2" data-col="sfdaCode">
                      {g.sfdaCode && <Ltr>{g.sfdaCode}</Ltr>}
                    </td>
                    <td className="px-3 py-2" data-col="gtin">
                      {g.gtin && <Ltr>{g.gtin}</Ltr>}
                    </td>
                    <td className="px-3 py-2" data-col="detail">
                      {g.detail && <Ltr>{g.detail}</Ltr>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  )
}

function KindChip({ label, count, pressed, hook, onClick }: { label: string; count: number; pressed: boolean; hook: string; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      data-gap-kind={hook}
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs ${pressed ? 'border-primary bg-primary-050 text-foreground' : 'border-border/60 text-muted-foreground hover:text-foreground'}`}
    >
      {label}
      <span data-count="">
        <Ltr>{formatFigure(count)}</Ltr>
      </span>
    </button>
  )
}
