import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import type { ReactNode } from 'react'
import type { AdviseReply } from '@/core/models/sourcing-run'
import { KEPT_RUNS_PATH } from '@/core/sourcing-advisor/simulator-path'
import Ltr from '@/core/ui/Ltr'
import { fsi } from '@/core/util/bidi'
import { keptRunsQuery } from './api'
import CopyRunLink from './CopyRunLink'

/**
 * A stored run opened by its link (ticket 969, spec 4354 §12; BackOffice 4380 `GET SourcingAdvisor/Runs/Open`): which
 * run it is, who kept it and when, and whether today's engine, solving again from the stored copy, answers differently
 * (`openedAgain.samePlans`) — the stored plans stay the truth.
 *
 * The open door answers the record alone: a kept run's name, keeper and time are read off the kept-run list (which holds
 * every kept run). A comparison run is not on that list, and says so by its kind.
 */
export default function StoredRunBanner({ record }: { record: AdviseReply }) {
  const { t } = useTranslation('sourcing-simulator')
  const list = useQuery(keptRunsQuery())
  const kept = list.data?.find((r) => r.runId === record.runId) ?? null
  const state = record.kind === 'COMPARISON' ? 'COMPARISON' : 'KEPT'
  const again = record.openedAgain
  return (
    <section className="flex flex-col gap-2 rounded-lg border border-primary/40 bg-card px-3 py-2.5 text-xs" data-stored-run={record.runId} data-stored-state={state}>
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex flex-col gap-0.5">
          <span className="font-semibold text-muted-foreground">{t(`stored.title.${state}`)}</span>
          {kept && (
            <b className="text-sm" data-stored-name="">
              <bdi>{kept.name}</bdi>
            </b>
          )}
        </div>
        <span className="ms-auto flex flex-wrap items-center gap-2">
          <CopyRunLink runId={record.runId} />
          <Link to={KEPT_RUNS_PATH} className="text-primary underline underline-offset-2" data-kept-runs-link="">
            {t('kept.link')}
          </Link>
        </span>
      </div>
      <dl className="flex flex-wrap gap-x-5 gap-y-1">
        {kept && (
          <>
            <Fact label={t('stored.keptBy')}>
              <bdi>{kept.keptBy}</bdi>
            </Fact>
            <Fact label={t('stored.keptAt')}>
              <Ltr>{kept.keptAt}</Ltr>
            </Fact>
          </>
        )}
        <Fact label={t('stored.ranAt')}>
          <Ltr>{record.ranAt}</Ltr>
        </Fact>
        <Fact label={t('stored.engine')}>
          <Ltr>{record.engine.version}</Ltr>
        </Fact>
      </dl>
      {again && !again.samePlans ? (
        <p className="rounded-md border border-attention-border bg-attention-050 px-3 py-2 text-attention-800" data-stored-engine-differs={again.engine.version}>
          {t('stored.engineDiffers', { now: fsi(again.engine.version), then: fsi(record.engine.version) })}
        </p>
      ) : (
        <p className="text-muted-foreground" data-stored-same-engine="">
          {t('stored.sameEngine')}
        </p>
      )}
      <p className="text-muted-foreground" data-stored-set-back="">
        {record.orderNumber ? t('stored.setBackOrder') : t('stored.setBackCart')}
      </p>
    </section>
  )
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex gap-1">
      <dt className="text-muted-foreground">{label}</dt>
      <dd>{children}</dd>
    </div>
  )
}
