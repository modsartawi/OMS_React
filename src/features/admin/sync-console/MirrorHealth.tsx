import { Trans, useTranslation } from 'react-i18next'
import Ltr from '@/core/ui/Ltr'
import { MIRROR_STATES, type StoreDetail, type StoreState } from '@/core/models/sync-console'
import { figure } from './helpers'
import { isOnMirror } from './store-helpers'
import StateBadges from './StateBadges'
import { Block, Fact, Time } from './StoreHealth'
import TillClockTime from './TillClockTime'

const isMirrorState = (s: StoreState): boolean => (MIRROR_STATES as readonly StoreState[]).includes(s)

/**
 * A store's mirror lane on its page (spec 2563, ticket 457): the mirror's own
 * reachability, its last pull and last good pull, the till backlog (count and oldest,
 * on the till's clock), the inbox pending and deferred, the open dead letters, and the
 * mirror states the door sent — every value as the door sent it.
 *
 * Drawn for every store, a WPF one included: the rails are independent (ADR 0073). A
 * store the mirror rail does not sweep reads "not on mirror" and shows no state.
 */
export default function MirrorHealth({ row }: { row: StoreDetail }) {
  const { t } = useTranslation('sync-console')
  const lane = row.mirror
  const onMirror = isOnMirror(row)
  const states = row.states.filter(isMirrorState)

  return (
    <div
      className="flex flex-col gap-3 border-t border-border/60 pt-3"
      role="group"
      aria-label={t('mirrorHealth.label')}
      data-mirror-health={onMirror ? 'onMirror' : 'notOnMirror'}
    >
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{t('mirrorHealth.title')}</h3>
        {onMirror &&
          (states.length > 0 ? (
            <StateBadges states={states} />
          ) : (
            <span className="text-xs text-muted-foreground" data-mirror-no-state="">
              {t('mirror.healthy')}
            </span>
          ))}
      </div>
      {!onMirror ? (
        <p className="text-sm text-muted-foreground" data-mirror-not-on="">
          {t('mirrorHealth.notOnMirror')}
        </p>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(14rem,1fr))] gap-4">
          <Block title={t('mirrorHealth.reachable')} data="mirror-reachable">
            <Fact label={t('mirrorHealth.lastConnectOk')}>
              <Time value={lane.lastConnectOkAt} />
            </Fact>
            <Fact label={t('mirrorHealth.lastConnectFail')}>
              <Time value={lane.lastConnectFailAt} />
            </Fact>
            {lane.lastConnectError && (
              <bdi className="block text-sm break-words text-danger-800" data-mirror-connect-error="">
                {lane.lastConnectError}
              </bdi>
            )}
          </Block>
          <Block title={t('mirrorHealth.pull')} data="mirror-pull">
            <Fact label={t('mirrorHealth.lastPull')}>
              <Time value={lane.lastPullAt} />
            </Fact>
            <Fact label={t('mirrorHealth.lastPullOk')}>
              <Time value={lane.lastPullOkAt} />
            </Fact>
          </Block>
          <Block title={t('mirrorHealth.tillBacklog')} data="mirror-till-backlog">
            {/* `null` is "never measured", which must not read as an empty till. */}
            {lane.tillBacklogCount === null ? (
              <p className="text-sm text-muted-foreground" data-till-not-measured="">
                {t('mirrorHealth.notMeasured')}
              </p>
            ) : (
              <p className="text-sm tabular-nums">
                <Trans
                  t={t}
                  i18nKey="mirrorHealth.tillBacklogCount"
                  count={lane.tillBacklogCount}
                  values={{ n: figure(lane.tillBacklogCount) }}
                  components={{ n: <Ltr /> }}
                />
              </p>
            )}
            {lane.tillBacklogOldestAt && (
              <Fact label={t('mirrorHealth.oldest')}>
                <TillClockTime value={lane.tillBacklogOldestAt} />
              </Fact>
            )}
          </Block>
          <Block title={t('mirrorHealth.inbox')} data="mirror-inbox">
            <Fact label={t('mirrorHealth.inboxPending')}>
              <Ltr>{figure(lane.inboxPending)}</Ltr>
            </Fact>
            <Fact label={t('mirrorHealth.inboxDeferred')}>
              <Ltr>{figure(lane.inboxDeferred)}</Ltr>
            </Fact>
            {lane.oldestDeferredAt && (
              <Fact label={t('mirrorHealth.oldestDeferred')}>
                <TillClockTime value={lane.oldestDeferredAt} />
              </Fact>
            )}
          </Block>
          <Block title={t('mirrorHealth.deadLetters')} data="mirror-dead-letters">
            <Fact label={t('mirrorHealth.openDeadLetters')}>
              <Ltr>{figure(lane.openDeadLetters)}</Ltr>
            </Fact>
          </Block>
        </div>
      )}
    </div>
  )
}
