import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { loyGroupRefusal } from '@/core/loy-groups/refusal'
import type { LoyGroupDetail } from '@/core/models/loy-groups'
import { notify } from '@/core/services/notify'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Ltr from '@/core/ui/Ltr'
import Modal from '@/core/ui/Modal'
import { deactivateConfirm, setActiveRequest } from './activate'
import { groupActiveApi, loyGroupKey } from './api'
import RefusalLine from './RefusalLine'

/**
 * Deactivate / reactivate one group (oms ticket 631; door `POST LoyGroupWeb/Groups/SetActive`, 3174).
 * Deactivate asks first, in a `Modal` naming every live bonus-buy that uses the group (`liveBonusBuys`,
 * 3179) — or saying plainly that it stops no live offer. Reactivate needs no list (the members are
 * intact), so it goes straight through. Either way the page and the list re-fetch.
 *
 * Rendered only under the maintain grant (the caller decides). 🚩 There is no delete control, anywhere.
 */
export default function ActiveToggle({ group }: { group: LoyGroupDetail }) {
  const { t, i18n } = useTranslation('loy-groups')
  const queryClient = useQueryClient()
  const [confirming, setConfirming] = useState(false)

  const setActive = useMutation({
    mutationFn: (isActive: boolean) => groupActiveApi.setActive(setActiveRequest(group.groupId, isActive)),
    onSuccess: async (_, isActive) => {
      setConfirming(false)
      notify.success(t(isActive ? 'activate.reactivated' : 'activate.deactivated'))
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: loyGroupKey(group.groupId) }),
        queryClient.invalidateQueries({ queryKey: ['loy', 'groups', 'list'] }),
      ])
    },
  })
  const refusal = setActive.isError ? loyGroupRefusal(setActive.error, i18n.language, t('activate.failed')) : null
  const refusalBanner = refusal && (
    <ErrorBanner className="p-3" title={t('activate.refused')} message={refusal.message}>
      <RefusalLine code={refusal.code} />
    </ErrorBanner>
  )

  if (!group.isActive) {
    return (
      <div className="flex flex-col gap-2">
        <Button variant="secondary" onClick={() => setActive.mutate(true)} disabled={setActive.isPending} data-loy-group-reactivate="">
          {setActive.isPending ? t('activate.reactivating') : t('activate.reactivate')}
        </Button>
        {refusalBanner}
      </div>
    )
  }

  const confirm = deactivateConfirm(group)
  const close = () => {
    if (setActive.isPending) return
    setConfirming(false)
    setActive.reset()
  }

  return (
    <>
      <Button variant="secondary" onClick={() => setConfirming(true)} data-loy-group-deactivate="">
        {t('activate.deactivate')}
      </Button>
      <Modal
        open={confirming}
        onClose={close}
        title={t('activate.confirm.title')}
        width="34rem"
        footer={
          <>
            <Button variant="secondary" onClick={close} disabled={setActive.isPending}>
              {t('activate.confirm.cancel')}
            </Button>
            <Button
              variant="danger"
              onClick={() => setActive.mutate(false)}
              disabled={setActive.isPending}
              data-loy-group-deactivate-confirm=""
            >
              {setActive.isPending ? t('activate.deactivating') : t('activate.confirm.submit')}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3 text-sm" data-loy-group-deactivate-dialog="">
          <p data-loy-group-deactivate-sentence={confirm.lines.length > 0 ? 'stops' : 'none'}>{t(confirm.sentence)}</p>
          {confirm.lines.length > 0 && (
            <ul className="flex flex-col gap-1.5">
              {confirm.lines.map((b) => (
                <li key={b.promoNumber} className="flex flex-wrap items-baseline gap-x-2" data-loy-group-deactivate-bby={b.promoNumber}>
                  <span className="font-mono tabular-nums">
                    <Ltr>{b.promoNumber}</Ltr>
                  </span>
                  <bdi>{b.description}</bdi>
                </li>
              ))}
            </ul>
          )}
          <p className="text-muted-foreground">{t('activate.confirm.after')}</p>
          {refusalBanner}
        </div>
      </Modal>
    </>
  )
}
