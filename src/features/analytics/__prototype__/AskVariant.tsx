/* PROTOTYPE — throwaway. Ticket 747. The "Ask" variant: a typed HQ question → a structured plan
 * (./ask-matcher, the AI stand-in) → MBQL → `POST /api/card` (a SAVED view, created by API — the
 * door 746's `create_view` would use) → the user lands on it, interactive, and can change or re-save.
 * Raw fetch through the Vite `/mbapi` proxy is a prototype exception to the api-envelope rule.
 */
import { useState } from 'react'
import { InteractiveQuestion } from '@metabase/embedding-sdk-react'
import { Sparkles } from 'lucide-react'
import Button from '@/core/ui/Button'
import Input from '@/core/ui/Input'
import { plan as makePlan, SEED_QUESTIONS, toMbql, type Plan } from './ask-matcher'

const env = import.meta.env
const FIELDS = JSON.parse(env.VITE_MB_FIELDS)
const TABLES = JSON.parse(env.VITE_MB_TABLES)

type Asked = { question: string; plan: Plan; cardId: number }

async function createView(p: Plan): Promise<number> {
  const body = { name: p.title, display: p.display, collection_id: Number(env.VITE_MB_COLLECTION_ID), type: 'question', description: 'Created by Ask (prototype 747).', ...toMbql(p, FIELDS, TABLES, Number(env.VITE_MB_DATABASE_ID)) }
  const res = await fetch('/mbapi/card', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': env.VITE_MB_API_KEY }, body: JSON.stringify(body) })
  if (!res.ok) throw new Error(await res.text())
  return (await res.json()).id
}

export default function AskVariant() {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [history, setHistory] = useState<Asked[]>([])
  const current = history[0]

  const ask = async (q: string) => {
    if (!q.trim()) return
    setBusy(true)
    setError(null)
    try {
      const p = makePlan(q)
      const cardId = await createView(p)
      setHistory((h) => [{ question: q, plan: p, cardId }, ...h])
      setText('')
    } catch (e) {
      setError(String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid h-full min-h-[70vh] grid-cols-[1fr_280px] gap-3">
      <section className="flex min-w-0 flex-col gap-3">
        <form
          className="flex items-center gap-2 rounded-2xl border border-border bg-card p-3"
          onSubmit={(e) => {
            e.preventDefault()
            void ask(text)
          }}
        >
          <Sparkles className="size-4 shrink-0 text-gold" aria-hidden />
          <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Ask about sales, orders or delivery speed — e.g. HungerStation orders in Riyadh by day" wrapperClassName="flex-1" className="w-full" />
          <Button type="submit" disabled={busy}>
            {busy ? 'Building the view…' : 'Ask'}
          </Button>
        </form>

        {!current && (
          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="mb-2 text-xs font-semibold text-muted-foreground">Try one of HQ's questions</div>
            <div className="flex flex-wrap gap-2">
              {SEED_QUESTIONS.map((q) => (
                <Button key={q} variant="secondary" onClick={() => void ask(q)} disabled={busy}>
                  {q}
                </Button>
              ))}
            </div>
          </div>
        )}
        {error && <div className="rounded-xl border border-danger-border bg-danger-050 p-3 text-xs text-danger-800">{error}</div>}

        {current && (
          <div className="flex min-h-0 flex-1 flex-col gap-2 rounded-2xl border border-border bg-card p-3">
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <span className="font-semibold text-muted-foreground">I understood:</span>
              <Pill tone="measure">{current.plan.measure.label}</Pill>
              {current.plan.by.map((b) => (
                <Pill key={b.col + b.unit} tone="by">by {b.label.toLowerCase()}</Pill>
              ))}
              {current.plan.filters.filter((f) => f.col !== 'delivered').map((f) => (
                <Pill key={f.col} tone="filter"><bdi>{f.label}: {String(f.value)}</bdi></Pill>
              ))}
              <Pill tone="filter">{current.plan.period.label}</Pill>
              {current.plan.topN && <Pill tone="filter">top {current.plan.topN}</Pill>}
              <span className="ms-auto text-[11px] text-ink-3">Saved to HQ analytics · view #{current.cardId} · change anything below and save again</span>
            </div>
            <InteractiveQuestion key={current.cardId} questionId={current.cardId} isSaveEnabled targetCollection={Number(env.VITE_MB_COLLECTION_ID)} height="62vh" />
          </div>
        )}
      </section>

      <aside className="rounded-2xl border border-border bg-card p-3">
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Asked this session</div>
        {history.length === 0 && <p className="text-xs text-ink-3">Every answer is saved as a view you can re-run tomorrow.</p>}
        <ul className="flex flex-col gap-1">
          {history.map((h, i) => (
            <li key={h.cardId}>
              <Button variant={i === 0 ? 'primary' : 'secondary'} className="w-full justify-start text-start" onClick={() => setHistory((all) => [h, ...all.filter((x) => x.cardId !== h.cardId)])}>
                {h.question}
              </Button>
            </li>
          ))}
        </ul>
      </aside>
    </div>
  )
}

function Pill({ tone, children }: { tone: 'measure' | 'by' | 'filter'; children: React.ReactNode }) {
  const cls = tone === 'measure' ? 'bg-primary text-primary-foreground' : tone === 'by' ? 'bg-success-050 text-success-800 border border-success-border' : 'bg-post-050 text-post-800 border border-post-border'
  return <span className={`rounded-full px-2 py-0.5 font-medium ${cls}`}>{children}</span>
}
