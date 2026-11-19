import { useTranslation } from 'react-i18next'
import QRCode from 'react-qr-code'
import { Loader2, Power, PowerOff, Printer, RotateCw } from 'lucide-react'
import { MINI_POS_TRIAL_ROLES, type MiniPosStore, type MiniPosTrialRole } from '@/core/models/mini-pos'
import Button from '@/core/ui/Button'
import Ltr from '@/core/ui/Ltr'
import Modal from '@/core/ui/Modal'
import Select from '@/core/ui/Select'
import StatusBadge from '@/core/ui/StatusBadge'
import { buttonClass } from '@/core/ui/control-classes'
import { TD, TH } from '@/core/ui/sheet-table'
import { fsi } from '@/core/util/bidi'
import { formatDateTime } from '@/core/util/date-format'
import { asTrialRole, canPrint, nextVersion, printPath, trialRoleKey } from './stores'

/**
 * The pharmacies screen's drawn parts (oms 915): the store table, the reprint confirm and the printed sheet. Props in,
 * markup out, so the component tests render them as static markup; the page owns the calls.
 *
 * Every change (enable, disable, trial role, print, reprint) is drawn only with `canManage` (`MiniPosAdmin:06`).
 */

const NS = 'mini-pos-stores'

export interface StoreActions {
  canManage: boolean
  /** The store a call is in flight for: its row's actions wait. */
  busyStore?: string | null
  onEnable: (store: MiniPosStore) => void
  onDisable: (store: MiniPosStore) => void
  onTrialRole: (store: MiniPosStore, role: MiniPosTrialRole) => void
  onReprint: (store: MiniPosStore) => void
}

export function StoresTable({ stores, ...actions }: { stores: readonly MiniPosStore[] } & StoreActions) {
  const { t } = useTranslation(NS)
  if (stores.length === 0)
    return (
      <p className="rounded-lg border border-border/60 bg-card/40 p-3 text-sm text-muted-foreground" data-minipos-stores-empty="">
        {t('list.empty')}
      </p>
    )
  const { canManage, busyStore, onEnable, onDisable, onTrialRole, onReprint } = actions
  return (
    <div className="overflow-x-auto rounded-lg border border-border/60">
      <table className="w-full text-[0.8125rem]">
        <thead className="text-xs text-muted-foreground">
          <tr>
            <th className={TH}>{t('list.store')}</th>
            <th className={TH}>{t('list.state')}</th>
            <th className={TH}>{t('list.trialRole')}</th>
            <th className={TH}>{t('list.version')}</th>
            <th className={TH}>{t('list.updated')}</th>
            {canManage && <th className={TH}>{t('list.actions')}</th>}
          </tr>
        </thead>
        <tbody>
          {stores.map((store) => {
            const busy = busyStore === store.storeCode
            return (
              <tr key={store.storeCode} className="border-t border-border/40" data-minipos-store={store.storeCode}>
                <td className={`${TD} font-mono`}>
                  <Ltr>{store.storeCode}</Ltr>
                </td>
                <td className={TD}>
                  {store.isEnabled ? (
                    <StatusBadge sev="go">{t('state.enabled')}</StatusBadge>
                  ) : (
                    <StatusBadge sev="mute">{t('state.disabled')}</StatusBadge>
                  )}
                  {store.isEnabled && !store.hasKey && (
                    <div className="mt-1 text-xs text-attention-800">{t('state.noKey')}</div>
                  )}
                </td>
                <td className={TD}>
                  {canManage ? (
                    <Select
                      value={store.trialRole ?? ''}
                      disabled={busy}
                      onChange={(e) => onTrialRole(store, asTrialRole(e.target.value))}
                      aria-label={t('list.trialRole')}
                      className="w-32"
                      data-minipos-trial-role={store.storeCode}
                    >
                      {MINI_POS_TRIAL_ROLES.map((role) => (
                        <option key={role} value={role}>
                          {t(`trialRole.${trialRoleKey(role)}`)}
                        </option>
                      ))}
                    </Select>
                  ) : (
                    t(`trialRole.${trialRoleKey(store.trialRole)}`)
                  )}
                </td>
                <td className={`${TD} tabular-nums`}>
                  <Ltr>{store.printedCodeVersion > 0 ? String(store.printedCodeVersion) : ''}</Ltr>
                </td>
                <td className={TD}>
                  <Ltr>{formatDateTime(store.updatedAt)}</Ltr>
                  <div className="font-mono text-[12px] text-muted-foreground">
                    <Ltr>{store.updatedBy}</Ltr>
                  </div>
                </td>
                {canManage && (
                  <td className={TD}>
                    <div className="flex flex-wrap gap-1.5">
                      {store.isEnabled ? (
                        <Button variant="outlined" disabled={busy} onClick={() => onDisable(store)} data-minipos-disable={store.storeCode}>
                          <PowerOff className="h-3.5 w-3.5" aria-hidden />
                          {t('action.disable')}
                        </Button>
                      ) : (
                        <Button variant="secondary" disabled={busy} onClick={() => onEnable(store)} data-minipos-enable={store.storeCode}>
                          <Power className="h-3.5 w-3.5" aria-hidden />
                          {t('action.enable')}
                        </Button>
                      )}
                      {canPrint(store) && (
                        <>
                          <a
                            href={printPath(store.storeCode)}
                            target="_blank"
                            rel="noopener"
                            className={buttonClass('outlined')}
                            data-minipos-print={store.storeCode}
                          >
                            <Printer className="h-3.5 w-3.5" aria-hidden />
                            {t('action.print')}
                          </a>
                          <Button
                            variant="danger-outlined"
                            disabled={busy}
                            onClick={() => onReprint(store)}
                            data-minipos-reprint={store.storeCode}
                          >
                            <RotateCw className="h-3.5 w-3.5" aria-hidden />
                            {t('action.reprint')}
                          </Button>
                        </>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

/**
 * The reprint confirm. A reprint makes a new version and every older print is refused from then on, so the pharmacy's
 * paper on the wall stops working until the new one is up: the dialog says so, naming the store and both versions, before
 * the call is made.
 */
export function ReprintConfirm({
  store,
  pending,
  error,
  onConfirm,
  onClose,
}: {
  store: MiniPosStore | null
  pending: boolean
  /** The refusal, already in words, or ''. */
  error: string
  onConfirm: () => void
  onClose: () => void
}) {
  const { t } = useTranslation(NS)
  return (
    <Modal
      open={store !== null}
      onClose={onClose}
      dismissable={!pending}
      title={t('reprint.title')}
      footer={
        <>
          <Button variant="text" onClick={onClose} disabled={pending}>
            {t('reprint.cancel')}
          </Button>
          <Button variant="danger" onClick={onConfirm} disabled={pending} data-minipos-reprint-confirm="">
            {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <RotateCw className="h-3.5 w-3.5" aria-hidden />}
            {t('reprint.confirm')}
          </Button>
        </>
      }
    >
      {store && (
        <div className="flex flex-col gap-2 p-3 text-sm" data-minipos-reprint-body={store.storeCode}>
          <p>
            {t('reprint.body', {
              store: fsi(store.storeCode),
              current: fsi(String(store.printedCodeVersion)),
              next: fsi(String(nextVersion(store))),
            })}
          </p>
          <p className="font-semibold text-danger-800">{t('reprint.warning')}</p>
          {error && (
            <p role="alert" className="text-danger-800">
              <bdi>{error}</bdi>
            </p>
          )}
        </div>
      )}
    </Modal>
  )
}

/** The printed sheet: the store, the QR drawn from the signed code, its version and what to do with it. */
export function QrSheet({ storeCode, version, code }: { storeCode: string; version: number; code: string }) {
  const { t } = useTranslation(NS)
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 p-6 text-center" data-minipos-qr-sheet={storeCode}>
      <h1 className="text-2xl font-bold">{t('print.heading')}</h1>
      <p className="text-xl font-semibold">
        {t('print.store')} <Ltr>{storeCode}</Ltr>
      </p>
      {/* react-qr-code paints its own light ground inside the SVG, so it reads dark on light whatever the theme. */}
      <div className="rounded-lg border border-border p-3" data-minipos-qr="">
        <QRCode value={code} level="M" size={288} />
      </div>
      <p className="text-sm">{t('print.howTo')}</p>
      <p className="text-xs text-muted-foreground">{t('print.version', { version: fsi(String(version)) })}</p>
    </div>
  )
}
