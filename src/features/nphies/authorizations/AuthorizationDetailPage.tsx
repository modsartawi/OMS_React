import type { ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import {
  ArrowLeft,
  FileSearch,
  FileText,
  Loader2,
  MessageCircleQuestion,
  Paperclip,
  ShieldAlert,
} from 'lucide-react'

import { apiErrorMessage } from '@/core/api'
import ErrorBanner from '@/core/ui/ErrorBanner'
import StatusBadge from '@/core/ui/StatusBadge'
import { NPHIES_ACCESS_KEY, nphiesAccessApi } from '@/core/nphies/api'
import { formatAmount, formatStamp } from '@/core/nphies/format'
import { authVerdictSeverity, deriveAuthAxes, requestSeverity } from '@/core/nphies/status'
import { authorizationsApi } from './api'
import {
  failureMessage,
  projectAuthLines,
  refusedLines,
  submittedAttachments,
  type AuthAttachmentView,
  type AuthLineView,
} from './detail-view'

/**
 * One authorization, whole (ticket 216, spec 209 stories 77–79) — **and the
 * discovery that there is no separate rejection view to build.**
 *
 * The material was assumed expensive and is not. The payer's reason arrives
 * *already decoded into display text* alongside the per-line outcome, approved
 * quantity, rejected amount, benefit and copay, all inside the response this page
 * already fetches (§3.4). So the page carries them **always** — not only on a
 * rejection — which is also what covers the case the brief forgets: a **partial**
 * approval, where the header says approved and individual lines were refused.
 *
 * **A route, not a modal**, for 213's reason: a detail must survive a refresh and
 * be linkable. It is reached from the list's Open column.
 *
 * 🚩 **The one trap, and it is defused before this file.** A single field carries
 * *either* a transport error *or* the decoded adjudication display depending on
 * which kind of bad news occurred, and the rule is that the Request state picks
 * both the label and the source. `failureMessage` is the only reader of it in the
 * feature; on a completed authorization it answers `null` whatever the field
 * holds, and this page has no branch that could render it anyway.
 *
 * 🚩 **No dispensed marker.** `IsDispensed` is on the *list row* and is absent
 * from `AuthHeaderDto` (`.afk/HITL-216.md`) — a detail that showed one would be
 * sourcing it from a field the endpoint does not answer with.
 */
export default function AuthorizationDetailPage() {
  const { t } = useTranslation('authorizations')
  const { id = '' } = useParams<{ id: string }>()

  // The area's ONE probe, on the key the nav leaves and every Nphies screen share
  // → one network call for the whole area. Fails closed: pending and errored both
  // draw something other than the detail.
  const access = useQuery({
    queryKey: NPHIES_ACCESS_KEY,
    queryFn: () => nphiesAccessApi.access(),
  })
  const allowed = access.data?.canOpenNphies === true

  const detail = useQuery({
    queryKey: ['nphies', 'authorizations', 'response', id],
    queryFn: () => authorizationsApi.detail(id),
    enabled: allowed && id !== '',
    // 🚩 No `refetchInterval` (§3.6): the service's own `PollRequestWorker` sweeps
    // the exchange every 15 seconds, and this is the heaviest read on the door —
    // the response carries every attached megabyte.
  })

  if (access.isPending) {
    return (
      <div
        className="flex min-h-[60vh] items-center justify-center gap-2 text-sm text-muted-foreground"
        role="status"
      >
        <Loader2 className="h-4 w-4 animate-spin" />
        {t('access.checking')}
      </div>
    )
  }
  if (!allowed) {
    // The in-page backstop behind the hidden nav leaf, distinguishing the two
    // reasons: an unreachable probe is a retry, a refused one is an
    // administrator. Same rule as every other screen in the area.
    const unreachable = access.isError
    return (
      <div
        className="mx-auto mt-16 max-w-md rounded-lg border border-border/60 bg-card p-6 text-center"
        role="alert"
      >
        <ShieldAlert className="mx-auto mb-2 h-6 w-6 text-muted-foreground" aria-hidden />
        <div className="text-base font-semibold tracking-tight">
          {unreachable ? t('access.unreachableTitle') : t('access.deniedTitle')}
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          {unreachable
            ? apiErrorMessage(access.error, t('access.unreachableHint'))
            : t('access.deniedHint')}
        </p>
      </div>
    )
  }

  const response = detail.data
  const axes = response ? deriveAuthAxes(response) : null
  const lines = response ? projectAuthLines(response) : []
  const refused = refusedLines(lines)
  const attachments = response ? submittedAttachments(response.authSupportingInfos) : []
  // Read once, here, so the page has exactly one branch that can render it.
  const failure = response ? failureMessage(response) : null

  return (
    <section className="flex w-full flex-col gap-4">
      <header className="flex flex-col gap-1">
        <Link
          to="/nphies/authorizations"
          className="inline-flex w-fit items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          {/* Logical: rtl:rotate-180 mirrors the arrow with the text direction. */}
          <ArrowLeft className="h-3.5 w-3.5 rtl:rotate-180" aria-hidden />
          {t('detail.backToList')}
        </Link>
        <h1 className="text-lg font-semibold tracking-tight">{t('detail.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('detail.subtitle')}</p>
      </header>

      {detail.isError && (
        <ErrorBanner
          title={t('errors.detailTitle')}
          // §6 kind 2: a guardrail refusal — `AUTH_NOT_FOUND` on a mistyped id —
          // carries the server's own sentence, and it renders as that sentence.
          message={apiErrorMessage(detail.error, t('errors.detailFailed'))}
          className="p-3"
        />
      )}

      {detail.isPending && (
        <div className="flex flex-col gap-2" role="status" aria-label={t('detail.loading')}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-8 animate-pulse rounded-md bg-muted" />
          ))}
        </div>
      )}

      {response && axes && (
        <>
          {/* What was asked, and as whom. Read-only values rather than disabled
              controls (spec 209 story 24): this is a record of what was sent. */}
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 rounded-lg border border-border/60 bg-card/40 p-4 sm:grid-cols-3 lg:grid-cols-4">
            <Fact label={t('detail.patientName')} value={response.patientName} />
            <Fact label={t('detail.patientId')} value={response.patientId} />
            <Fact label={t('detail.memberId')} value={response.memberId} />
            <Fact label={t('detail.payerCode')} value={response.payerCode} />
            <Fact label={t('detail.providerCode')} value={response.providerCode} />
            <Fact label={t('detail.preAuthRef')} value={response.preAuthRef} />
            <Fact label={t('detail.policyNumber')} value={response.policyNumber} />
            <Fact label={t('detail.diagnosis')} value={response.diagnosis} />
            <Fact label={t('detail.serviceDate')} value={formatStamp(response.serviceDate)} />
            <Fact label={t('detail.raisedAt')} value={formatStamp(response.actionDateTime)} />
            <Fact label={t('detail.answeredAt')} value={formatStamp(response.responseDateTime)} />
          </dl>

          <section className="flex flex-col gap-4 rounded-lg border border-border/60 bg-card p-4">
            <div className="flex flex-wrap items-center gap-6">
              <div className="flex flex-col gap-1">
                <span className="text-xs font-medium text-muted-foreground">
                  {t('detail.request')}
                </span>
                <StatusBadge sev={requestSeverity(axes.request)}>
                  {t(`request.${axes.request}`)}
                </StatusBadge>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs font-medium text-muted-foreground">
                  {t('detail.verdict')}
                </span>
                {axes.verdict ? (
                  <StatusBadge sev={authVerdictSeverity(axes.verdict)}>
                    {t(`verdict.${axes.verdict}`)}
                  </StatusBadge>
                ) : (
                  // Blank until Complete — the honest rendering of "nothing to
                  // report yet", and never an implied refusal.
                  <span className="text-sm text-muted-foreground" aria-label={t('list.verdictBlank')}>
                    —
                  </span>
                )}
              </div>
              {/* 🚩 The marker, not an axis value: the payer raises a query
                  asynchronously, so it can sit on an authorization that already
                  has both. It is required rather than decorative — answering one
                  is out of v1, so this authorization now needs the till. */}
              {response.needComm && (
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-muted-foreground">
                    {t('list.columns.markers')}
                  </span>
                  <span title={t('list.markers.payerQueryHint')}>
                    <StatusBadge sev="warn">
                      <MessageCircleQuestion className="me-1 h-3 w-3" aria-hidden />
                      {t('list.markers.payerQuery')}
                    </StatusBadge>
                  </span>
                </div>
              )}
            </div>

            {/* 🚩 THE dual-meaning field, in the ONE branch that may read it, and
                labelled for it. `failureMessage` has already answered `null` on a
                completed authorization whatever the field holds — so there is no
                path from here to a neutral "Message" label, which would
                re-conflate exactly what the two axes exist to keep apart. */}
            {failure && (
              <div>
                <div className="text-xs font-medium text-muted-foreground">
                  {t('detail.failureLabel')}
                </div>
                <p className="text-sm text-foreground">{failure}</p>
                <p className="mt-1 text-xs text-muted-foreground">{t('detail.failureHint')}</p>
              </div>
            )}

            {/* 🚩 The refusal's own act, where the agent reads the refusal
                (ticket 221). The list offers it too, but this detail is what they
                open *before* deciding to reopen — sending them back to the grid to
                find the row again would be the screen forgetting why they came.
                It reaches the same form route as the row's act: a REPLAY of what
                was submitted, into a genuinely new request. */}
            {axes.request === 'failed' && (
              <div>
                <Link
                  to={`/nphies/authorizations/new?copyOf=${encodeURIComponent(response.id)}`}
                  className="inline-flex h-8 items-center gap-1.5 rounded-full border border-border px-3 text-xs font-medium hover:bg-accent"
                >
                  <FileSearch className="h-3.5 w-3.5" aria-hidden />
                  {t('acts.openRefusal')}
                </Link>
                <p className="mt-1 text-xs text-muted-foreground">{t('detail.reopenHint')}</p>
              </div>
            )}

            {/* The payer's own words. Single-meaning fields, unlike the one above,
                so presence is the whole condition (`.afk/HITL-216.md`). Server
                text passes through as data — the label around it is what is
                keyed. */}
            {response.disposition && (
              <div>
                <div className="text-xs font-medium text-muted-foreground">
                  {t('detail.disposition')}
                </div>
                <p className="text-sm text-foreground">{response.disposition}</p>
              </div>
            )}
            {response.processNote && (
              <div>
                <div className="text-xs font-medium text-muted-foreground">
                  {t('detail.processNote')}
                </div>
                <p className="text-sm text-foreground">{response.processNote}</p>
              </div>
            )}
          </section>

          <LineTable lines={lines} refusedCount={refused.length} t={t} />
          <AttachmentList attachments={attachments} t={t} />
        </>
      )}
    </section>
  )
}

/** One read-only fact. A value, not a disabled control (spec 209 story 24). */
function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="text-sm text-foreground">{value || '—'}</dd>
    </div>
  )
}

/**
 * The lines, with the payer's answer beside each.
 *
 * A plain table rather than AG Grid: an authorization's lines are a handful, they
 * are never sorted or filtered, and one of them wraps a 250-character sentence —
 * which is the column that matters most and the one a fixed-height grid row would
 * clip.
 *
 * 🚩 **Nothing here is totalled.** Every figure is a field the server sent (law 1
 * — amounts are one-way, engine → client, display only). The only computed number
 * on the screen is a *count of refused lines*, which is the ticket's own headline.
 */
function LineTable({
  lines,
  refusedCount,
  t,
}: {
  lines: AuthLineView[]
  refusedCount: number
  t: (key: string, options?: Record<string, unknown>) => string
}) {
  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border/60 bg-card p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold tracking-tight">
          {t('detail.lines.title', { count: lines.length })}
        </h2>
        {/* 🚩 The partial, said out loud. A header that reads "Approved" over a
            line the payer refused is the case the brief forgets, and counting the
            refused lines is what stops an agent having to scan for them. */}
        {refusedCount > 0 && (
          <span className="text-xs font-medium text-attention-800">
            {t('detail.lines.refusedCount', { count: refusedCount })}
          </span>
        )}
      </div>

      {lines.length === 0 ? (
        // 🚩 The header-only refusal (§3.9): the service's own guards throw before
        // the lines are built, so a failed authorization really can have none —
        // and saying so is different from rendering an empty table.
        <p className="text-sm text-muted-foreground">{t('detail.lines.none')}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/60 text-xs text-muted-foreground">
                <Th className="text-start">{t('detail.lines.sequence')}</Th>
                <Th className="text-start">{t('detail.lines.item')}</Th>
                <Th className="text-end">{t('detail.lines.quantity')}</Th>
                <Th className="text-start">{t('detail.lines.verdict')}</Th>
                <Th className="text-end">{t('detail.lines.approvedQuantity')}</Th>
                <Th className="text-end">{t('detail.lines.rejected')}</Th>
                <Th className="text-end">{t('detail.lines.benefit')}</Th>
                <Th className="text-end">{t('detail.lines.copay')}</Th>
                <Th className="text-start">{t('detail.lines.benefitReason')}</Th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => (
                <tr
                  key={line.id || line.sequence}
                  className={
                    'border-b border-border/40 align-top ' +
                    (line.refused ? 'bg-attention-050' : '')
                  }
                >
                  <Td className="tabular-nums">{line.sequence}</Td>
                  <Td>
                    <span className="font-medium">{line.itemNumber}</span>
                    <span className="block text-xs text-muted-foreground">
                      {line.itemDescription}
                    </span>
                  </Td>
                  <Td className="text-end tabular-nums">{line.quantity}</Td>
                  <Td>
                    {line.verdict ? (
                      <StatusBadge sev={authVerdictSeverity(line.verdict)}>
                        {t(`verdict.${line.verdict}`)}
                      </StatusBadge>
                    ) : (
                      // Blank until the HEADER's request is Complete — the line
                      // carries an outcome whatever happened to the request.
                      <span
                        className="text-muted-foreground"
                        aria-label={t('list.verdictBlank')}
                      >
                        —
                      </span>
                    )}
                  </Td>
                  <Td className="text-end tabular-nums">{line.approvedQuantity}</Td>
                  <Td className="text-end tabular-nums">{formatAmount(line.rejected)}</Td>
                  <Td className="text-end tabular-nums">{formatAmount(line.benefit)}</Td>
                  <Td className="text-end tabular-nums">{formatAmount(line.copay)}</Td>
                  <Td>
                    {/* 🚩 The payer's reason, in words, already decoded server-side
                        against the NPHIES `AdjudicationReason` code system. No
                        client lookup table exists and none may be added — a raw
                        code arriving here is a server-side mapping gap. Server
                        text, so it passes through as data. */}
                    {line.benefitReason ? (
                      <span className="text-foreground">{line.benefitReason}</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

function Th({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <th className={'px-2 py-2 font-medium ' + className}>{children}</th>
}

function Td({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <td className={'px-2 py-2 ' + className}>{children}</td>
}

/**
 * The attachments **as submitted**.
 *
 * They cost nothing: the response already carries the base64 whether they are
 * rendered or not (§3.4), so an agent chasing a rejection can see what the payer
 * was actually given without opening the till application. No upload endpoint, no
 * second fetch, no server change.
 *
 * An image renders inline; a PDF is a link, because a browser's own viewer is
 * better than anything this screen could build. **No modal** — spec 209 line 55,
 * and the lightbox it does permit belongs to the *form* (219), not here.
 */
function AttachmentList({
  attachments,
  t,
}: {
  attachments: AuthAttachmentView[]
  t: (key: string, options?: Record<string, unknown>) => string
}) {
  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border/60 bg-card p-4">
      <h2 className="flex items-center gap-1.5 text-sm font-semibold tracking-tight">
        <Paperclip className="h-3.5 w-3.5" aria-hidden />
        {t('detail.attachments.title', { count: attachments.length })}
      </h2>

      {attachments.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('detail.attachments.none')}</p>
      ) : (
        <ul className="flex flex-wrap gap-3">
          {attachments.map((attachment) => (
            <li
              key={attachment.id || attachment.sequence}
              className="flex w-48 flex-col gap-2 rounded-md border border-border/60 p-2"
            >
              {attachment.isImage ? (
                <a
                  href={attachment.dataUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="block overflow-hidden rounded bg-muted"
                >
                  <img
                    src={attachment.dataUrl}
                    // Server-supplied title, passed through as data.
                    alt={attachment.title}
                    className="h-28 w-full object-cover"
                  />
                </a>
              ) : (
                <a
                  href={attachment.dataUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex h-28 items-center justify-center gap-1.5 rounded bg-muted text-sm text-primary hover:underline"
                >
                  <FileText className="h-4 w-4" aria-hidden />
                  {t('detail.attachments.open')}
                </a>
              )}
              <div className="flex flex-col gap-0.5">
                <span className="truncate text-sm font-medium" title={attachment.title}>
                  {attachment.title || t('detail.attachments.untitled')}
                </span>
                <span className="text-xs text-muted-foreground">{attachment.contentType}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
