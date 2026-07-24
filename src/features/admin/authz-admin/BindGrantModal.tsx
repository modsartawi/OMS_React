import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, Loader2, Search } from 'lucide-react'
import { apiErrorMessage } from '@/core/api'
import Modal from '@/core/ui/Modal'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import { notify } from '@/core/services/notify'
import type { GrantCatalogEntry } from '@/core/models/authz-admin'
import { authzAdminApi } from './api'
import { grantText } from './helpers'

interface Props {
  open: boolean
  onClose: () => void
  roleName: string
  /** Grants already bound to the role (excluded from the picker). */
  boundIds: string[]
  onBound: () => void
}

/**
 * Bind a grant to a single role from the EXISTING catalog only — grants aren't created
 * here (they're code+SQL-seeded; a grant only means something if code checks it). A
 * wildcard grant (any field value is `*`, or the object is `*`) requires a strong
 * confirmation before binding — the server binds it as-is, so the confirm IS the
 * guardrail (spec / story 17).
 */
export default function BindGrantModal({ open, onClose, roleName, boundIds, onBound }: Props) {
  const { t } = useTranslation('authz-admin')
  const [term, setTerm] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirming, setConfirming] = useState<GrantCatalogEntry | null>(null)

  const catalog = useQuery({
    queryKey: ['authz-admin', 'grants'],
    queryFn: () => authzAdminApi.bindableGrants(),
    enabled: open,
  })

  useEffect(() => {
    if (open) {
      setTerm('')
      setBusy(false)
      setConfirming(null)
    }
  }, [open])

  const bound = useMemo(() => new Set(boundIds), [boundIds])
  const q = term.trim().toLowerCase()
  const choices = useMemo(() => {
    const rows = (catalog.data ?? []).filter((g) => !bound.has(g.authorizationId))
    if (!q) return rows
    return rows.filter(
      (g) => grantText(g).text.toLowerCase().includes(q) || g.authorizationId.toLowerCase().includes(q),
    )
  }, [catalog.data, bound, q])

  async function bind(g: GrantCatalogEntry) {
    setBusy(true)
    try {
      await authzAdminApi.bindGrant(roleName, g.authorizationId)
      notify.success(t('bindGrant.bound'), t('bindGrant.boundDetail', { grant: grantText(g).text }))
      onBound()
    } catch (err) {
      notify.apiError(t('toast.failed'), err)
    } finally {
      setBusy(false)
      setConfirming(null)
    }
  }

  // Wildcard grant → confirm before binding; ordinary grant → bind straight away.
  function onBindClick(g: GrantCatalogEntry) {
    if (grantText(g).wildcard) setConfirming(g)
    else bind(g)
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('bindGrant.title', { role: roleName })}
      width="36rem"
      footer={
        <Button variant="text" onClick={onClose}>
          {t('common.done')}
        </Button>
      }
    >
      {confirming ? (
        <div className="flex flex-col gap-3">
          <div className="flex items-start gap-2 rounded-lg border border-danger-border bg-danger-050 p-3 text-sm text-danger-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <span>
              {t('bindGrant.wildcardBody', { grant: grantText(confirming).text, role: roleName })}
            </span>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setConfirming(null)} disabled={busy}>
              {t('bindGrant.back')}
            </Button>
            <Button variant="danger" onClick={() => bind(confirming)} disabled={busy}>
              {busy ? t('bindGrant.binding') : t('bindGrant.bindWildcard')}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">{t('bindGrant.intro')}</p>
          <div className="flex items-center gap-2 rounded-full border border-input bg-background px-3">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            <input
              className="min-w-0 flex-1 bg-transparent py-2 text-sm outline-none"
              placeholder={t('bindGrant.searchPlaceholder')}
              value={term}
              onChange={(e) => setTerm(e.target.value)}
            />
          </div>

          {catalog.isPending ? (
            <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground" role="status">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t('bindGrant.loading')}
            </div>
          ) : catalog.isError ? (
            <ErrorBanner message={apiErrorMessage(catalog.error, t('toast.failed'))} className="p-4" />
          ) : choices.length === 0 ? (
            <p className="rounded-lg border border-border/60 bg-muted/40 p-4 text-sm text-muted-foreground">
              {t('bindGrant.empty')}
            </p>
          ) : (
            <div className="flex max-h-[18rem] flex-col gap-1.5 overflow-y-auto">
              {choices.map((g) => {
                const { text, wildcard } = grantText(g)
                return (
                  <div
                    key={g.authorizationId}
                    className="flex items-center gap-2 rounded-lg border border-border/60 px-3 py-2"
                  >
                    <span className="min-w-0 flex-1 font-mono text-xs tabular-nums">{text}</span>
                    {wildcard && (
                      <span className="rounded-full bg-danger-050 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-danger-800">
                        {t('effective.wildcard')}
                      </span>
                    )}
                    <Button
                      variant={wildcard ? 'danger' : 'primary'}
                      onClick={() => onBindClick(g)}
                      disabled={busy}
                    >
                      {t('bindGrant.bind')}
                    </Button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </Modal>
  )
}
