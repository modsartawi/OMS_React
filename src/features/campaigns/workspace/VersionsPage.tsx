import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { Eye, EyeOff, History, Loader2 } from 'lucide-react'
import type { RuleCampaign, RuleCampaignVersion, RuleDraft } from '@/core/models/rule-campaign'
import { rememberSavedDraft, ruleCampaignApi, ruleCampaignVersionQuery, ruleCampaignVersionsQuery, ruleReadingCatalogueQuery } from '@/core/rules/api'
import { campaignPath } from '@/core/rules/campaign-state'
import type { SentenceContext } from '@/core/rules/sentence'
import { notify } from '@/core/services/notify'
import Button from '@/core/ui/Button'
import Ltr from '@/core/ui/Ltr'
import Modal from '@/core/ui/Modal'
import { fsi } from '@/core/util/bidi'
import { formatDateTime } from '@/core/util/date-format'
import { useWorkspace } from './context'
import { Refusal } from './settings-ui'
import VersionRuleCard from './VersionRuleCard'
import { newestFirst, restoreGuard, restoreHeld, versionMark } from './versions'

/**
 * The campaign's Versions (ticket 512): every published version, newest first, with its number,
 * who activated it, when (local) and the note, the live one marked. A version opens read-only as its
 * rules in sentences. Restore makes it the campaign's NEW draft — never an in-place rollback: tills
 * keep the live version until that draft is approved and activated. Restore always asks first
 * (`restoreGuard`): the draft it replaces may hold saved work not published, even on a live
 * campaign. HQ's refusal shows with its message and code.
 */
export default function VersionsPage() {
  const { t } = useTranslation('campaign-workspace')
  const { draft: d } = useWorkspace()
  const c = d.campaign
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const versions = useQuery(ruleCampaignVersionsQuery(c.id))
  const [opened, setOpened] = useState<ReadonlySet<number>>(() => new Set())
  /** The version waiting on the "replace the draft?" question. */
  const [asking, setAsking] = useState<number | null>(null)

  const restore = useMutation({
    mutationFn: (version: number) => ruleCampaignApi.restore(c.id, version),
    onSuccess: (next, version) => {
      // The restored draft is the campaign's draft now: every page of the workspace reads it, and
      // its checks, offline verdict and counters are read afresh, as after a builder Save.
      rememberSavedDraft(queryClient, next)
      setAsking(null)
      notify.success(t('versions.restored', { version: fsi(version) }))
      navigate(campaignPath(c.id))
    },
  })

  const toggle = (version: number) =>
    setOpened((prev) => {
      const next = new Set(prev)
      if (!next.delete(version)) next.add(version)
      return next
    })

  /** Closes the question; an abandoned restore leaves no refusal behind on the page. */
  const dismiss = () => {
    restore.reset()
    setAsking(null)
  }
  const held = restoreHeld(d)

  const start = (version: number) => {
    restore.reset()
    if (restoreGuard(d) === 'ask') setAsking(version)
  }

  let body
  if (versions.isPending) {
    body = (
      <div className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        {t('versions.loading')}
      </div>
    )
  } else if (versions.isError) {
    body = (
      <div data-versions-refusal="">
        <Refusal title={t('versions.failedTitle')} fallback={t('versions.failed')} error={versions.error} />
        <Button variant="outlined" className="mt-2" onClick={() => void versions.refetch()} disabled={versions.isFetching} data-versions-retry="">
          {t('versions.retry')}
        </Button>
      </div>
    )
  } else if (!versions.data.length) {
    body = (
      <p className="text-sm text-muted-foreground" data-versions-empty="">
        {t('versions.empty')}
      </p>
    )
  } else {
    body = (
      <ol className="flex flex-col gap-3" data-versions="">
        {newestFirst(versions.data).map((v) => (
          <VersionItem
            key={v.version}
            draft={d}
            v={v}
            open={opened.has(v.version)}
            onToggle={() => toggle(v.version)}
            onRestore={() => start(v.version)}
            restoring={restore.isPending && restore.variables === v.version}
            busy={restore.isPending}
          />
        ))}
      </ol>
    )
  }

  return (
    <section className="flex flex-col gap-4" data-versions-page="">
      <header>
        <h1 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
          <History className="h-4 w-4 text-muted-foreground" aria-hidden />
          {t('versions.title')}
        </h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{t('versions.intro')}</p>
      </header>
      {held && (
        <p className="rounded-md border border-border/60 bg-muted px-3 py-2 text-sm" data-versions-held={held}>
          {t(`versions.held.${held}`)}
        </p>
      )}
      {restore.isError && asking === null && (
        <div data-restore-refusal="">
          <Refusal title={t('versions.refusedTitle')} fallback={t('versions.refused')} error={restore.error} />
        </div>
      )}
      {body}
      {asking !== null && (
        <Modal
          open
          onClose={() => !restore.isPending && dismiss()}
          title={t('versions.ask.title')}
          width="32rem"
          footer={
            <>
              <Button variant="text" onClick={dismiss} disabled={restore.isPending} data-restore-cancel="">
                {t('versions.ask.cancel')}
              </Button>
              <Button variant="danger" onClick={() => restore.mutate(asking)} disabled={restore.isPending} data-restore-confirm="">
                {restore.isPending && <Loader2 className="size-3.5 animate-spin" aria-hidden />}
                {t('versions.ask.confirm')}
              </Button>
            </>
          }
        >
          <div className="flex flex-col gap-3" data-restore-dialog={asking}>
            <p className="text-sm">
              <Trans t={t} i18nKey="versions.ask.body" values={{ version: asking }} components={{ version: <Ltr /> }} />
            </p>
            {d.publishedVersionNo > 0 && (
              <p className="text-sm text-muted-foreground">
                <Trans t={t} i18nKey="versions.ask.live" values={{ version: d.publishedVersionNo }} components={{ version: <Ltr /> }} />
              </p>
            )}
            {restore.isError && (
              <div data-restore-refusal="">
                <Refusal title={t('versions.refusedTitle')} fallback={t('versions.refused')} error={restore.error} />
              </div>
            )}
          </div>
        </Modal>
      )}
    </section>
  )
}

/** One version: its number and mark, who and when, the note; View opens its rules, Restore. */
function VersionItem({
  draft: d,
  v,
  open,
  onToggle,
  onRestore,
  restoring,
  busy,
}: {
  draft: RuleDraft
  v: RuleCampaignVersion
  open: boolean
  onToggle: () => void
  onRestore: () => void
  restoring: boolean
  busy: boolean
}) {
  const { t } = useTranslation('campaign-workspace')
  const mark = versionMark(d, v.version)
  const guard = restoreGuard(d)
  const detailId = `version-${v.version}-rules`
  return (
    <li
      className={'flex flex-col gap-2 rounded-lg border bg-card p-4 ' + (mark === 'live' ? 'border-primary/40' : 'border-border/60')}
      data-version={v.version}
      data-version-mark={mark ?? undefined}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h2 className="text-sm font-semibold" data-version-number="">
          <Trans t={t} i18nKey="versions.number" values={{ version: v.version }} components={{ version: <Ltr /> }} />
        </h2>
        {mark && (
          <span
            className={'rounded-full px-2 py-0.5 text-xs font-medium ' + (mark === 'live' ? 'bg-primary-050 text-primary-800' : 'bg-muted text-muted-foreground')}
            data-version-marker={mark}
          >
            {t(`versions.mark.${mark}`)}
          </span>
        )}
        <span className="text-xs text-muted-foreground" data-version-stamp="">
          <Trans t={t} i18nKey="dashboard.stamp" values={{ at: formatDateTime(v.at), by: v.by }} components={{ at: <Ltr />, by: <bdi /> }} />
        </span>
        <span className="ms-auto flex flex-wrap gap-2">
          <Button variant="ghost" onClick={onToggle} aria-expanded={open} aria-controls={open ? detailId : undefined} data-version-view="">
            {open ? <EyeOff className="h-3.5 w-3.5" aria-hidden /> : <Eye className="h-3.5 w-3.5" aria-hidden />}
            {t(open ? 'versions.hide' : 'versions.view')}
          </Button>
          {guard === 'ask' && (
            <Button variant="outlined" onClick={onRestore} disabled={busy} data-version-restore="">
              {restoring && <Loader2 className="size-3.5 animate-spin" aria-hidden />}
              {t('versions.restore')}
            </Button>
          )}
        </span>
      </div>
      {v.note ? (
        <p className="text-sm" data-version-note="">
          <bdi>{v.note}</bdi>
        </p>
      ) : (
        <p className="text-sm text-muted-foreground" data-version-note="">
          {t('versions.noNote')}
        </p>
      )}
      {open && (
        <div id={detailId}>
          <VersionRules campaign={d.campaign} version={v.version} />
        </div>
      )}
    </li>
  )
}

/** A version's rules as published, read-only, read through the block catalogue as sentences. */
function VersionRules({ campaign: c, version }: { campaign: RuleCampaign; version: number }) {
  const { t, i18n } = useTranslation('campaign-workspace')
  const detail = useQuery(ruleCampaignVersionQuery(c.id, version))
  const catalogue = useQuery(ruleReadingCatalogueQuery())
  /** The rules the reader closed; every rule opens expanded. */
  const [shut, setShut] = useState<ReadonlySet<string>>(() => new Set())

  if (detail.isPending || catalogue.isPending) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        {t('versions.rulesLoading')}
      </div>
    )
  }
  if (detail.isError || catalogue.isError) {
    const failed = detail.isError ? detail : catalogue
    return (
      <div data-version-rules-refusal="">
        <Refusal title={t('versions.rulesFailedTitle')} fallback={t('versions.rulesFailed')} error={failed.error} />
        <Button variant="outlined" className="mt-2" onClick={() => void failed.refetch()} disabled={failed.isFetching} data-version-rules-retry="">
          {t('versions.retry')}
        </Button>
      </div>
    )
  }

  const has = (key: string, count?: number) => i18n.exists(key, { ns: 'campaign-workspace', ...(count === undefined ? {} : { count }) })
  const rules = detail.data.rules
  return (
    <div className="flex flex-col gap-2 border-t border-border/60 pt-3" data-version-rules={version}>
      {rules.length ? (
        rules.map((rule, i) => {
          // Budgets and audience are the campaign's as they are now — a version carries its rules only.
          const ctx: SentenceContext = { campaign: c, rule, catalogue: catalogue.data, has }
          return (
            <VersionRuleCard
              key={rule.id}
              rule={rule}
              index={i}
              open={!shut.has(rule.id)}
              onToggle={() =>
                setShut((prev) => {
                  const next = new Set(prev)
                  if (!next.delete(rule.id)) next.add(rule.id)
                  return next
                })
              }
              ctx={ctx}
              idPrefix={`version-${version}`}
            />
          )
        })
      ) : (
        <p className="text-sm text-muted-foreground">{t('versions.noRules')}</p>
      )}
    </div>
  )
}
