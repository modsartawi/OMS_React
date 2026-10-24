import { useQuery } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import { apiErrorMessage } from '@/core/api'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Ltr from '@/core/ui/Ltr'
import { actionSyncAccessQuery, actionSyncFleetQuery, canOperateActionSync } from './api'
import {
  MIN_APPLY_REASON,
  reasonProblem,
  storesReadiness,
  type ApplyTableSplit,
  type StoreRefusal,
  type StoresReadiness,
} from './apply-helpers'
import type { CreateTargets } from './create-helpers'
import CodeWord from './CodeWord'
import { groupDigits } from './helpers'

/**
 * What the Apply side of the New campaign dialog needs from ActionSync (ticket 564): whether the
 * technician may pause (`ActionSync.Operate`), and each target store's readiness. Both are read
 * only while Apply is chosen.
 */
export function useApplyReadiness(applying: boolean, targets: CreateTargets) {
  const access = useQuery({ ...actionSyncAccessQuery(), enabled: applying })
  const fleet = useQuery({ ...actionSyncFleetQuery(), enabled: applying })
  const readiness: StoresReadiness | null = fleet.data ? storesReadiness(targets, fleet.data) : null
  return {
    accessPending: access.isPending,
    canPause: canOperateActionSync(access.data),
    fleetPending: fleet.isPending,
    fleetError: fleet.isError ? fleet.error : null,
    readiness,
  }
}

interface ApplyPanelProps {
  split: ApplyTableSplit
  reason: string
  onReason: (r: string) => void
  targets: CreateTargets
  check: ReturnType<typeof useApplyReadiness>
  pauseFirst: boolean
  onPauseFirst: (on: boolean) => void
  /** Removes the never-appliable stores from the pasted codes (stores targets only). */
  onDrop: (codes: string[]) => void
  busy: boolean
}

/** The Apply-only part of the dialog: what gets written, the reason, the stores' readiness, the pause toggle. */
export default function ApplyPanel({ split, reason, onReason, targets, check, pauseFirst, onPauseFirst, onDrop, busy }: ApplyPanelProps) {
  const { t } = useTranslation('data-sync')
  const problem = reasonProblem(reason)
  const r = check.readiness
  return (
    <div className="flex flex-col gap-4" data-apply-panel="">
      {/* ── What gets written ── */}
      <div className="flex flex-col gap-1" data-apply-tables="">
        <span className="text-xs font-medium">{t('apply.tables')}</span>
        <div className="grid grid-cols-2 gap-3 rounded-md border border-border/60 p-2 text-xs">
          <div>
            <p className="font-medium">{t('apply.written')}</p>
            <ul className="mt-1 flex flex-col gap-0.5 font-mono">
              {split.written.map((tb) => (
                <li key={tb} data-apply-written={tb}>
                  <Ltr>{tb}</Ltr>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="font-medium text-muted-foreground">{t('apply.reported')}</p>
            <ul className="mt-1 flex flex-col gap-0.5 font-mono text-muted-foreground">
              {split.reported.map((tb) => (
                <li key={tb} data-apply-reported={tb}>
                  <Ltr>{tb}</Ltr>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* ── Reason ── */}
      <label className="flex flex-col gap-1 text-xs font-medium">
        {t('apply.reason')}
        <textarea
          value={reason}
          onChange={(e) => onReason(e.target.value)}
          rows={2}
          disabled={busy}
          maxLength={500}
          className="rounded-md border border-border/60 bg-background px-2 py-1.5 text-sm font-normal text-foreground outline-none focus:border-primary/60"
          data-apply-reason=""
        />
      </label>
      <p className="-mt-3 text-xs text-muted-foreground">
        <Trans t={t} i18nKey="apply.reasonHint" values={{ min: MIN_APPLY_REASON }} components={{ n: <Ltr /> }} />
      </p>
      {problem && (
        <p className="-mt-3 text-xs text-danger-800" data-apply-reason-problem={problem}>
          {problem === 'required' ? (
            t('apply.reasonRequired')
          ) : (
            <Trans
              t={t}
              i18nKey="apply.reasonTooShort"
              values={{ min: MIN_APPLY_REASON, have: reason.trim().length }}
              components={{ n: <Ltr /> }}
            />
          )}
        </p>
      )}

      {/* ── Store readiness on ActionSync ── */}
      <div className="flex flex-col gap-1 text-xs" data-apply-readiness="">
        <span className="font-medium">{t('apply.readiness.title')}</span>
        {check.fleetPending && (
          <span className="inline-flex items-center gap-1 text-muted-foreground" role="status">
            <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
            {t('apply.readiness.loading')}
          </span>
        )}
        {check.fleetError != null && (
          <ErrorBanner className="p-2" message={apiErrorMessage(check.fleetError, t('apply.readiness.failed'))}>
            {pauseFirst && check.canPause && (
              <p className="mt-1 text-xs" data-apply-pause-no-fleet="">
                {t('apply.pauseNoFleet')}
              </p>
            )}
          </ErrorBanner>
        )}
        {r && (
          <>
            <p data-apply-ready={r.ready.length}>
              <Trans
                t={t}
                i18nKey="apply.readiness.ready"
                count={r.ready.length}
                values={{ figure: groupDigits(r.ready.length) }}
                components={{ n: <Ltr /> }}
              />
            </p>
            {/* Ruling 2026-10-24: a store someone else paused is never paused again, so it keeps that pause afterwards. */}
            {r.ready.length > 0 && (
              <p className="text-attention-800" data-apply-ready-kept="">
                {t('apply.readiness.readyKept')}
              </p>
            )}
            <p data-apply-will-pause={r.willPause.length}>
              <Trans
                t={t}
                i18nKey="apply.readiness.willPause"
                count={r.willPause.length}
                values={{ figure: groupDigits(r.willPause.length) }}
                components={{ n: <Ltr /> }}
              />
            </p>
            {r.never.length > 0 && (
              <div className="rounded-md border border-attention-border bg-attention-050 px-3 py-2" data-apply-never={r.never.length}>
                <p className="font-medium">{t('apply.readiness.neverTitle')}</p>
                <ul className="mt-1 flex flex-col gap-0.5">
                  {r.never.map((n) => (
                    <li key={n.code} data-apply-never-store={n.code} data-why={n.why}>
                      <span className="font-mono">
                        <Ltr>{n.code}</Ltr>
                      </span>{' '}
                      <span className="text-muted-foreground">{t(`apply.readiness.${n.why}`)}</span>
                    </li>
                  ))}
                </ul>
                {targets.kind === 'stores' ? (
                  <Button
                    variant="text"
                    className="mt-1"
                    disabled={busy}
                    onClick={() => onDrop(r.never.map((n) => n.code))}
                    data-apply-drop=""
                  >
                    {t('apply.readiness.drop')}
                  </Button>
                ) : (
                  <p className="mt-1 text-muted-foreground">{t('apply.readiness.fleetNever')}</p>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Pause ActionSync first ── */}
      <div className="flex flex-col gap-1 text-xs">
        <label className="inline-flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={pauseFirst && check.canPause}
            onChange={(e) => onPauseFirst(e.target.checked)}
            disabled={busy || !check.canPause}
            data-apply-pause-first=""
          />
          {t('apply.pauseFirst')}
        </label>
        {!check.accessPending && !check.canPause ? (
          <p className="text-attention-800" data-apply-pause-needs-grant="">
            {t('apply.pauseNeedsGrant')}
          </p>
        ) : pauseFirst ? (
          <p className="text-muted-foreground">{t('apply.pauseFirstHint')}</p>
        ) : (
          <p className="text-attention-800" data-apply-pause-off="">
            {t('apply.pauseOff')}
          </p>
        )}
      </div>
    </div>
  )
}

/** Codes listed one per line, each a machine value isolated on its own, with an optional note. */
export function StoreList({ codes, attr }: { codes: readonly string[]; attr: string }) {
  return (
    <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 font-mono">
      {codes.map((c) => (
        <li key={c} {...{ [attr]: c }}>
          <Ltr>{c}</Ltr>
        </li>
      ))}
    </ul>
  )
}

/** ActionSync's per-store refusals, each code with its word (raw code when unknown). */
export function RefusalList({ refused }: { refused: readonly StoreRefusal[] }) {
  return (
    <ul className="mt-1 flex flex-col gap-0.5">
      {refused.map((x) => (
        <li key={x.code} data-apply-refused={x.code} data-error={x.error}>
          <span className="font-mono">
            <Ltr>{x.code}</Ltr>
          </span>{' '}
          <span className="text-muted-foreground">
            <CodeWord prefix="apply.refused" code={x.error} className="font-mono" />
          </span>
        </li>
      ))}
    </ul>
  )
}
