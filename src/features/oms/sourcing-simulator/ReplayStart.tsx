import { useTranslation } from 'react-i18next'
import type { AdviseReply } from '@/core/models/sourcing-run'
import { usePermissions } from '@/core/permissions'
import { canSeeCustomerPoint } from '@/core/sourcing-advisor/access'
import Field from '@/core/ui/Field'
import Input from '@/core/ui/Input'
import Ltr from '@/core/ui/Ltr'
import { TD, TH } from '@/core/ui/sheet-table'
import { formatFigure } from '@/core/util/number-format'
import type { ReplayForm } from './replay'

/** When the replayed order's first delivery came in: the reply's nearest fact to when it was placed. */
const firstCameIn = (reply: AdviseReply): string | null => (reply.whatHappened ?? []).map((d) => d.cameInAt).sort()[0] ?? null

/**
 * Replay an order (ticket 964, SIMT decision 6): the order number and the customer-point switch; once run, the order's
 * lines, channel and time as the reply read them from the order.
 */
export default function ReplayStart({ form, onChange, reply }: { form: ReplayForm; onChange: (form: ReplayForm) => void; reply: AdviseReply | null }) {
  const { t } = useTranslation('sourcing-simulator')
  // The order the reply replayed, when it is this one.
  const order = reply && reply.orderNumber && reply.orderNumber === form.orderNumber.trim() ? reply : null
  // BackOffice 4381: only a holder of the customer-point grant gets the real point back; the server says NO_GRANT otherwise.
  const pointGranted = canSeeCustomerPoint(usePermissions())
  return (
    <div className="flex flex-col gap-3" data-sim-replay="">
      <Field label={t('replay.orderNumber')} hint={t('replay.orderHint')}>
        <Input
          dir="ltr"
          inputMode="numeric"
          className="w-full font-mono"
          value={form.orderNumber}
          onChange={(e) => onChange({ ...form, orderNumber: e.target.value, movedTo: null })}
          data-sim-field="orderNumber"
        />
      </Field>
      <label className="flex items-start gap-2 text-xs">
        <input
          type="checkbox"
          className="mt-0.5"
          checked={form.withPoint}
          onChange={(e) => onChange({ ...form, withPoint: e.target.checked })}
          data-sim-field="withCustomerPoint"
        />
        <span className="flex flex-col">
          <span className="font-medium">{t('replay.withPoint')}</span>
          <span className="text-muted-foreground">{t('replay.withPointHint')}</span>
          {form.withPoint && !pointGranted && (
            <span className="text-attention-800" data-sim-point-no-grant="">
              {t('replay.withPointNoGrant')}
            </span>
          )}
        </span>
      </label>

      <div className="flex flex-col gap-2" data-sim-order="">
        <h3 className="text-xs font-semibold text-muted-foreground">{t('replay.order.title')}</h3>
        {order ? (
          <>
            <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
              <div className="flex flex-col">
                <dt className="text-muted-foreground">{t('replay.order.channel')}</dt>
                <dd data-sim-order-channel={order.channel}>{t(`cart.channels.${order.channel}`, { defaultValue: order.channel })}</dd>
              </div>
              <div className="flex flex-col">
                <dt className="text-muted-foreground">{t('replay.order.placed')}</dt>
                <dd data-sim-order-placed="">
                  {/* SERVER GAP (spec 4354): the reply sends no time the order was placed; its first delivery's coming in stands for it. */}
                  <Ltr>{firstCameIn(order) ?? t('dash')}</Ltr>
                </dd>
              </div>
            </dl>
            <table className="w-full border-collapse text-xs" data-sim-order-lines="">
              <thead>
                <tr>
                  <th className={TH} scope="col">
                    {t('replay.order.item')}
                  </th>
                  <th className={`${TH} text-end`} scope="col">
                    {t('replay.order.quantity')}
                  </th>
                  <th className={TH} scope="col">
                    {t('replay.order.namedStore')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {order.lines.map((l) => (
                  <tr key={l.lineNo} data-sim-order-line={l.lineNo}>
                    <td className={`${TD} font-mono`}>
                      <Ltr>{l.item}</Ltr>
                    </td>
                    <td className={`${TD} text-end tabular-nums`}>
                      <Ltr>{formatFigure(l.quantity)}</Ltr>
                    </td>
                    <td className={`${TD} font-mono`}>{l.namedStore ? <Ltr>{l.namedStore}</Ltr> : t('dash')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        ) : (
          <p className="text-xs text-muted-foreground">{t('replay.order.none')}</p>
        )}
      </div>
    </div>
  )
}
