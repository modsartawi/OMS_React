/* PROTOTYPE — throwaway. Ticket 135.
 *
 * Atoms only. Deliberately NOT a shared layout: the three variants disagree
 * about structure, which is the whole question. What is shared here is the
 * stuff that must read identically in all three so the comparison is fair —
 * money, ATP, key caps — plus the two full-screen non-console phases, which
 * are not part of the spatial argument.
 */
import type { ReactNode } from 'react'
import type { Atp } from './mock-state'
import { money } from './mock-state'

/** Basket money. VAT-INCLUSIVE, engine truth. Big, tabular, currency named. */
export function Money({ v, tone = 'ink', size = 'md' }: { v: number; tone?: 'ink' | 'muted' | 'good'; size?: 'md' | 'lg' | 'sm' }) {
  const t = tone === 'muted' ? 'text-muted-foreground' : tone === 'good' ? 'text-success-800' : 'text-foreground'
  const s = size === 'lg' ? 'text-xl font-semibold' : size === 'sm' ? 'text-xs' : 'text-sm font-medium'
  return (
    <span data-numeric className={`${t} ${s}`}>
      {money(v)}
      <span className="ms-1 text-[0.7em] font-normal text-ink-3">SAR</span>
    </span>
  )
}

/** The three ATP states. `unknown` must never read as `zero` — opposite decisions. */
export function AtpPill({ atp, compact = false }: { atp: Atp; compact?: boolean }) {
  if (!atp.known)
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-attention-border bg-attention-050 px-2 py-0.5 text-[11px] font-medium text-attention-800">
        <span aria-hidden>?</span> stock unknown
      </span>
    )
  if ((atp.qty ?? 0) <= 0)
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-danger-border bg-danger-050 px-2 py-0.5 text-[11px] font-medium text-danger-800">
        none at store
      </span>
    )
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-success-border bg-success-050 px-2 py-0.5 text-[11px] font-medium text-success-800">
      <span data-numeric>{atp.qty}</span>
      {compact ? '' : ' in stock'}
    </span>
  )
}

export function KeyCap({ children }: { children: ReactNode }) {
  return (
    <kbd className="rounded border border-border-strong bg-muted px-1.5 py-0.5 font-sans text-[10px] font-medium text-muted-foreground">
      {children}
    </kbd>
  )
}

export function Dot({ tone }: { tone: 'good' | 'warn' | 'bad' | 'idle' }) {
  const c = tone === 'good' ? 'bg-success' : tone === 'warn' ? 'bg-attention' : tone === 'bad' ? 'bg-danger' : 'bg-ink-3'
  return <span className={`inline-block size-1.5 rounded-full ${c}`} aria-hidden />
}

/** A blocking overlay used for the two pendingConfirmation kinds. */
export function Sheet({ title, tone = 'primary', children, footer }: { title: string; tone?: 'primary' | 'attention'; children: ReactNode; footer: ReactNode }) {
  const edge = tone === 'attention' ? 'border-attention-border' : 'border-primary-border'
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-foreground/25 p-6">
      <div className={`w-full max-w-2xl overflow-hidden rounded-lg border-2 ${edge} bg-card shadow-2xl`}>
        <div className="border-b border-divider px-5 py-3 text-sm font-semibold">{title}</div>
        <div className="max-h-[52vh] overflow-auto px-5 py-4">{children}</div>
        <div className="flex items-center justify-end gap-2 border-t border-divider bg-card-2 px-5 py-3">{footer}</div>
      </div>
    </div>
  )
}

export function Btn({
  children,
  kind = 'ghost',
  wide = false,
}: {
  children: ReactNode
  kind?: 'primary' | 'ghost' | 'danger'
  wide?: boolean
}) {
  const c =
    kind === 'primary'
      ? 'bg-primary text-primary-foreground hover:bg-primary-800'
      : kind === 'danger'
        ? 'border border-danger-border bg-danger-050 text-danger-800 hover:bg-danger-050'
        : 'border border-input bg-card text-foreground hover:bg-accent'
  return (
    <button type="button" className={`rounded-md px-3 py-1.5 text-sm font-medium ${c} ${wide ? 'w-full' : ''}`}>
      {children}
    </button>
  )
}

/* ---- the two non-console phases. Not part of the spatial argument, so shared. ---- */

export function RefusedExistingScreen({ e }: { e: { transactionId: string; customerName: string; lineCount: number; openedAt: string; plant: string } }) {
  return (
    <div className="flex h-full items-center justify-center bg-background p-8">
      <div className="w-full max-w-lg rounded-lg border border-attention-border bg-card p-6 shadow-sm">
        <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-attention-800">Order already in progress</div>
        <h1 className="mb-4 text-lg font-semibold">You have an open order for {e.customerName}</h1>
        <dl className="mb-5 grid grid-cols-3 gap-3 rounded-md bg-muted p-3 text-sm">
          <div>
            <dt className="text-xs text-muted-foreground">Lines</dt>
            <dd data-numeric className="font-medium">{e.lineCount}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Opened</dt>
            <dd data-numeric className="font-medium">{e.openedAt}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Store</dt>
            <dd data-numeric className="font-medium">{e.plant}</dd>
          </div>
        </dl>
        <p className="mb-5 text-sm text-muted-foreground">
          Nothing is resumed automatically. If this is a different caller, abandon it and start fresh — the basket above
          belongs to the previous call.
        </p>
        <div className="flex gap-2">
          <Btn kind="primary">Resume this order</Btn>
          <Btn kind="danger">Abandon and start fresh</Btn>
        </div>
      </div>
    </div>
  )
}

export function DeniedScreen() {
  return (
    <div className="flex h-full items-center justify-center bg-background p-8">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 text-center shadow-sm">
        <h1 className="mb-2 text-lg font-semibold">The call-center console isn&apos;t available to your account</h1>
        <p className="mb-5 text-sm text-muted-foreground">
          It needs the <span className="font-medium text-foreground">Call Centre Agent</span> role. Ask an administrator
          to add it, then sign in again.
        </p>
        {/* 134: chrome-less screen ⇒ a denial has no nav to leave by. It carries its own way home. */}
        <div className="flex justify-center gap-2">
          <Btn kind="primary">Back to the portal</Btn>
          <Btn>Sign out</Btn>
        </div>
      </div>
    </div>
  )
}
