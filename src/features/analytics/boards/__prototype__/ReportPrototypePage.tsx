/* PROTOTYPE — throwaway. Wayfinder ticket 798 (map 793). Never merge.
 *
 * Route: /analytics/prototype/report?variant=A|B|C&scenario=…
 *
 * "Three designers for one report, switchable via `?variant=`, on a throwaway route inside the
 * analytics area; `?scenario=` walks the author's and the runner's moments." The question is the
 * owner's (801 → 798): "how am I going to design the report and the components for filtering?"
 *
 *   A — The document is the editor: the report reads as it will be sent; every block carries its
 *       tools, and the one you pick opens in a side sheet.
 *   B — Outline · canvas · inspector: a tree of parameters and sections on the start side, the
 *       live report in the middle, the selection's editor fixed on the end side.
 *   C — Steps: parameters (with the binding matrix) → content → words → share → preview.
 *
 * The runner's page is one page in every variant — it is not the open question; the designer is.
 * Everything runs on stub figures in memory (report-proto-model.ts); nothing is saved.
 */
import { useMemo, useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router'
import { ArrowDown, ArrowUp, BarChart3, Check, Copy, Download, Eye, LayoutList, Plus, Save, Settings2, Share2, Sparkles, Trash2, Type } from 'lucide-react'
import Button from '@/core/ui/Button'
import Chip from '@/core/ui/Chip'
import Field from '@/core/ui/Field'
import IconButton from '@/core/ui/IconButton'
import Ltr from '@/core/ui/Ltr'
import PrototypeSwitcher from '@/core/ui/PrototypeSwitcher'
import Select from '@/core/ui/Select'
import SideSheet from '@/core/ui/SideSheet'
import { fsi } from '@/core/util/bidi'
import {
  SAVED_VIEWS,
  blankParam,
  canBind,
  defaultsOf,
  dimensionOf,
  measureOf,
  panelsOf,
  prefill,
  sampleReport,
  say,
  validate,
  type Audience,
  type Block,
  type Panel,
  type Param,
  type ParamValue,
  type Refusal,
  type Report,
  type Values,
  type Words,
} from './report-proto-model'
import {
  AudienceChip,
  NotShared,
  PanelEditor,
  ParamEditor,
  ParamStrip,
  RefusalList,
  ReportBody,
  ShareDialog,
  SummaryBlock,
  TextEditor,
  WordsFields,
  nameProblem,
  paramLabel,
  useProto,
} from './ReportProtoParts'

const VARIANTS = [
  { key: 'A', name: 'A — The document is the editor' },
  { key: 'B', name: 'B — Outline · canvas · inspector' },
  { key: 'C', name: 'C — Steps' },
]
const SCENARIOS = [
  { key: 'design', label: 'Author · designing the report', proves: 'The acceptance case built: 9 parameters (all 7 kinds), 4 sections, series, live figures, summary.' },
  { key: 'declare', label: 'Author · adding a parameter', proves: 'Kind → name (the URL key) → label → default → bindings pre-filled, with the reason a panel cannot take it.' },
  { key: 'panel', label: 'Author · a panel with named series', proves: 'HungerStation against QC as two series; copied-from-view provenance; which parameters reach it.' },
  { key: 'text', label: 'Author · text with live figures', proves: 'Insert a figure token from a panel; the preview fills it from this run.' },
  { key: 'share', label: 'Author · share with teams', proves: 'Audience = roles + people (794); a removed role is flagged; what a runner can and cannot do.' },
  { key: 'refused', label: 'Author · save refused (411)', proves: 'Panel p2 was deleted while a text block still names its figures: refused at save, never dropped.' },
  { key: 'run', label: 'Runner · running the shared report', proves: 'No edit control anywhere; change parameters, export, copy the link.' },
  { key: 'run-fallback', label: 'Runner · bad link value + summary unavailable', proves: 'A link value outside the list falls back and says so; a failed number check drops the summary only.' },
  { key: 'not-shared', label: 'Outside the audience · 413', proves: 'No title, no data; names the owner to ask.' },
]

type Sel = string | null

function setupFor(scenario: string) {
  const report = sampleReport()
  let selected: Sel = null
  let draft: Param | null = null
  let refusals: Refusal[] = []
  if (scenario === 'declare') {
    draft = blankParam('members', report.params.map((x) => x.name))
    draft.dimension = 'region'
    draft.label = { en: 'Region', ar: 'المنطقة' }
    draft.name = 'region'
    selected = 'new-param'
  }
  if (scenario === 'panel') selected = 'block:p3'
  if (scenario === 'text') selected = 'block:t2'
  if (scenario === 'refused') {
    report.sections = report.sections.map((s) => ({ ...s, blocks: s.blocks.filter((b) => b.id !== 'p2') }))
    refusals = validate(report)
  }
  return { report, selected, draft, refusals }
}

export default function ReportPrototypePage() {
  const [params, setParams] = useSearchParams()
  const variant = params.get('variant') ?? 'A'
  const scenario = params.get('scenario') ?? 'design'
  const setQ = (k: string, v: string) =>
    setParams((prev) => {
      const n = new URLSearchParams(prev)
      n.set(k, v)
      return n
    })
  return (
    <>
      {/* A new scenario starts from a fresh report. */}
      <Workbench key={scenario + variant} variant={variant} scenario={scenario} />
      <PrototypeSwitcher variants={VARIANTS} variant={variant} onVariant={(k) => setQ('variant', k)} scenarios={SCENARIOS} scenario={scenario} onScenario={(k) => setQ('scenario', k)} />
    </>
  )
}

// ── The working state, and every edit the designers make ────────────────────────────────────

function useReportState(scenario: string) {
  const init = useMemo(() => setupFor(scenario), [scenario])
  const [report, setReport] = useState<Report>(init.report)
  const [values, setValues] = useState<Values>(() => {
    const v = defaultsOf(init.report)
    if (scenario === 'run-fallback') v.channel = { kind: 'members', values: [] }
    return v
  })
  const [selected, setSelected] = useState<Sel>(init.selected)
  const [draft, setDraft] = useState<Param | null>(init.draft)
  const [draftBindings, setDraftBindings] = useState<Record<string, string | true>>(() => (init.draft ? prefill(init.draft, panelsOf(init.report)) : {}))
  const [refusals, setRefusals] = useState<Refusal[]>(init.refusals)
  const [saved, setSaved] = useState<number | null>(null)
  const [shareOpen, setShareOpen] = useState(scenario === 'share')

  const edit = (f: (r: Report) => Report) => {
    setReport((r) => f(structuredClone(r)))
    setSaved(null)
  }
  const ops = {
    setValue: (name: string, v: ParamValue) => setValues((x) => ({ ...x, [name]: v })),
    reset: () => setValues(defaultsOf(report)),
    updateParam: (original: string, next: Param) =>
      edit((r) => {
        r.params = r.params.map((x) => (x.name === original ? next : x))
        if (original !== next.name) {
          r.bindings[next.name] = r.bindings[original] ?? {}
          delete r.bindings[original]
          setValues((v) => {
            const n = { ...v, [next.name]: v[original] ?? next.default }
            delete n[original]
            return n
          })
          setSelected(`param:${next.name}`)
        }
        return r
      }),
    setDefault: (name: string, d: ParamValue) => setValues((v) => ({ ...v, [name]: d })),
    setBindings: (name: string, b: Record<string, string | true>) =>
      edit((r) => {
        r.bindings[name] = b
        return r
      }),
    deleteParam: (name: string) => {
      edit((r) => {
        r.params = r.params.filter((x) => x.name !== name)
        delete r.bindings[name]
        return r
      })
      setSelected(null)
    },
    startParam: () => {
      const d = blankParam('period', report.params.map((x) => x.name))
      setDraft(d)
      setDraftBindings(prefill(d, panelsOf(report)))
      setSelected('new-param')
    },
    draftChange: (d: Param) => {
      if (draft && d.kind !== draft.kind) setDraftBindings(prefill(d, panelsOf(report)))
      if (draft && d.kind === 'members' && d.dimension !== draft.dimension) setDraftBindings(prefill(d, panelsOf(report)))
      setDraft(d)
    },
    addDraft: () => {
      if (!draft) return
      const d = draft
      edit((r) => {
        r.params.push(d)
        r.bindings[d.name] = draftBindings
        return r
      })
      setValues((v) => ({ ...v, [d.name]: d.default }))
      setDraft(null)
      setSelected(`param:${d.name}`)
    },
    updatePanel: (p: Panel) =>
      edit((r) => {
        for (const s of r.sections) s.blocks = s.blocks.map((b) => (b.kind === 'panel' && b.panel.id === p.id ? { ...b, panel: p } : b))
        return r
      }),
    bind: (param: string, panelId: string, on: boolean) =>
      edit((r) => {
        const prm = r.params.find((x) => x.name === param)
        const panel = panelsOf(r).find((x) => x.id === panelId)
        if (!prm || !panel) return r
        r.bindings[param] = { ...(r.bindings[param] ?? {}) }
        if (on) {
          const c = canBind(prm, panel)
          if (c.ok) r.bindings[param][panelId] = c.target ?? true
        } else delete r.bindings[param][panelId]
        return r
      }),
    updateText: (blockId: string, text: Words) =>
      edit((r) => {
        for (const s of r.sections) s.blocks = s.blocks.map((b) => (b.id === blockId && b.kind === 'text' ? { ...b, text } : b))
        return r
      }),
    moveBlock: (sectionId: string, blockId: string, by: -1 | 1) =>
      edit((r) => {
        const s = r.sections.find((x) => x.id === sectionId)!
        const i = s.blocks.findIndex((b) => b.id === blockId)
        const j = i + by
        if (j < 0 || j >= s.blocks.length) return r
        ;[s.blocks[i], s.blocks[j]] = [s.blocks[j], s.blocks[i]]
        return r
      }),
    removeBlock: (sectionId: string, blockId: string) => {
      edit((r) => {
        const s = r.sections.find((x) => x.id === sectionId)!
        s.blocks = s.blocks.filter((b) => b.id !== blockId)
        for (const b of Object.values(r.bindings)) delete b[blockId]
        return r
      })
      setSelected(null)
    },
    addBlock: (sectionId: string, kind: 'model' | 'view' | 'text' | 'summary', viewId?: string) => {
      const ids = new Set(report.sections.flatMap((s) => s.blocks.map((b) => b.id)))
      const fresh = (pre: string) => {
        for (let i = 1; ; i++) if (!ids.has(`${pre}${i}`)) return `${pre}${i}`
      }
      let block: Block
      if (kind === 'text') block = { id: fresh('t'), kind: 'text', text: { en: '', ar: '' } }
      else if (kind === 'summary') block = { id: 'sum', kind: 'summary' }
      else {
        const id = fresh('p')
        const view = SAVED_VIEWS.find((v) => v.id === viewId)
        const panel: Panel = view
          ? { id, ...structuredClone(view.panel), from: { view: view.title, revision: view.revision, changed: false } }
          : { id, title: { en: '', ar: '' }, area: 'till', measures: ['net_value'], axis: 'channel', chart: 'bar', series: [] }
        block = { id, kind: 'panel', panel }
      }
      edit((r) => {
        r.sections.find((x) => x.id === sectionId)!.blocks.push(block)
        if (block.kind === 'panel') for (const prm of r.params) {
          const c = canBind(prm, block.panel)
          if (c.ok) r.bindings[prm.name] = { ...(r.bindings[prm.name] ?? {}), [block.id]: c.target ?? true }
        }
        return r
      })
      setSelected(`block:${block.id}`)
    },
    addSection: () => {
      const id = `s${Date.now() % 100000}`
      edit((r) => {
        r.sections.push({ id, heading: { en: '', ar: '' }, blocks: [] })
        return r
      })
      setSelected(`section:${id}`)
    },
    moveSection: (id: string, by: -1 | 1) =>
      edit((r) => {
        const i = r.sections.findIndex((s) => s.id === id)
        const j = i + by
        if (j < 0 || j >= r.sections.length) return r
        ;[r.sections[i], r.sections[j]] = [r.sections[j], r.sections[i]]
        return r
      }),
    removeSection: (id: string) => {
      edit((r) => {
        const gone = r.sections.find((s) => s.id === id)?.blocks.map((b) => b.id) ?? []
        r.sections = r.sections.filter((s) => s.id !== id)
        for (const b of Object.values(r.bindings)) for (const g of gone) delete b[g]
        return r
      })
      setSelected(null)
    },
    renameSection: (id: string, heading: Words) =>
      edit((r) => {
        r.sections = r.sections.map((s) => (s.id === id ? { ...s, heading } : s))
        return r
      }),
    setTitle: (title: Words) =>
      edit((r) => {
        r.title = title
        return r
      }),
    share: (a: Audience) => {
      edit((r) => {
        r.audience = a
        return r
      })
      setShareOpen(false)
    },
    save: () => {
      const found = validate(report)
      setRefusals(found)
      if (found.length === 0) {
        setReport((r) => ({ ...r, revision: r.revision + 1 }))
        setSaved(report.revision + 1)
      }
    },
  }
  return { report, values, selected, setSelected, draft, draftBindings, setDraftBindings, refusals, setRefusals, saved, shareOpen, setShareOpen, ops }
}
type State = ReturnType<typeof useReportState>

function Workbench({ variant, scenario }: { variant: string; scenario: string }) {
  const st = useReportState(scenario)
  const [preview, setPreview] = useState(false)
  if (scenario === 'not-shared') return <NotShared owner={st.report.owner} />
  if (scenario.startsWith('run') || preview) return <RunnerPage st={st} fallback={scenario === 'run-fallback'} onBack={preview ? () => setPreview(false) : undefined} />
  const Designer = variant === 'B' ? DesignerB : variant === 'C' ? DesignerC : DesignerA
  return (
    <>
      <Designer st={st} onPreview={() => setPreview(true)} />
      {st.shareOpen && <ShareDialog report={st.report} onClose={() => st.setShareOpen(false)} onShare={st.ops.share} />}
    </>
  )
}

// ── Shared author chrome ────────────────────────────────────────────────────────────────────

function AuthorBar({ st, onPreview, children }: { st: State; onPreview: () => void; children?: ReactNode }) {
  const { p, lang } = useProto()
  return (
    <header className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-primary-050 px-2 py-0.5 text-[11px] font-medium text-primary-800">{p('author.badge')}</span>
        <h1 className="text-xl font-semibold">
          <bdi>{say(st.report.title, lang) || p('author.untitled')}</bdi>
        </h1>
        <AudienceChip audience={st.report.audience} />
        <span className="text-xs text-muted-foreground">
          {p('author.revision')} <Ltr>{st.report.revision}</Ltr>
        </span>
        <div className="ms-auto flex items-center gap-2">
          {children}
          <Button variant="outlined" onClick={onPreview} data-proto-preview>
            <Eye className="size-3.5" />
            {p('author.preview')}
          </Button>
          <Button variant="outlined" onClick={() => st.setShareOpen(true)} data-proto-share-open>
            <Share2 className="size-3.5" />
            {p('author.share')}
          </Button>
          <Button onClick={st.ops.save} data-proto-save>
            <Save className="size-3.5" />
            {p('author.save')}
          </Button>
        </div>
      </div>
      {st.saved !== null && (
        <p role="status" className="text-xs text-success-800">
          {p('author.saved')} <Ltr>{st.saved}</Ltr>
        </p>
      )}
      {st.refusals.length > 0 && <RefusalList report={st.report} refusals={st.refusals} onClose={() => st.setRefusals([])} />}
    </header>
  )
}

/** Whatever is selected, edited. Each variant decides where this sits. */
function Inspector({ st, compact = false }: { st: State; compact?: boolean }) {
  const { p, lang } = useProto()
  const sel = st.selected
  if (!sel) return <p className="p-4 text-sm text-muted-foreground">{p('inspector.empty')}</p>
  if (sel === 'new-param' && st.draft) {
    const problem = nameProblem(st.report, st.draft, null)
    return (
      <div className="flex flex-col gap-3">
        <h2 className="text-base font-semibold">{p('inspector.newParam')}</h2>
        <ParamEditor report={st.report} param={st.draft} original={null} onParam={st.ops.draftChange} bindings={st.draftBindings} onBindings={st.setDraftBindings} compact={compact} />
        <div>
          <Button onClick={st.ops.addDraft} disabled={!!problem} data-proto-add-draft>
            <Plus className="size-3.5" />
            {p('inspector.addParam')}
          </Button>
        </div>
      </div>
    )
  }
  if (sel.startsWith('param:')) {
    const prm = st.report.params.find((x) => `param:${x.name}` === sel)
    if (!prm) return null
    return (
      <div className="flex flex-col gap-3">
        <h2 className="text-base font-semibold">{p('inspector.param', { name: fsi(paramLabel(prm, lang)) })}</h2>
        <ParamEditor
          report={st.report}
          param={prm}
          original={prm.name}
          onParam={(n) => st.ops.updateParam(prm.name, n)}
          bindings={st.report.bindings[prm.name] ?? {}}
          onBindings={(b) => st.ops.setBindings(prm.name, b)}
          onDelete={() => st.ops.deleteParam(prm.name)}
          compact={compact}
        />
      </div>
    )
  }
  if (sel.startsWith('section:')) {
    const s = st.report.sections.find((x) => `section:${x.id}` === sel)
    if (!s) return null
    return (
      <div className="flex flex-col gap-3">
        <h2 className="text-base font-semibold">{p('inspector.section')}</h2>
        <WordsFields label={p('section.heading')} value={s.heading} onChange={(h) => st.ops.renameSection(s.id, h)} />
        <AddBlock st={st} sectionId={s.id} />
      </div>
    )
  }
  const id = sel.replace('block:', '')
  const sec = st.report.sections.find((s) => s.blocks.some((b) => b.id === id))
  const block = sec?.blocks.find((b) => b.id === id)
  if (!block || !sec) return null
  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-base font-semibold">{p(`inspector.${block.kind}`)}</h2>
      {block.kind === 'panel' && <PanelEditor report={st.report} panel={block.panel} onPanel={st.ops.updatePanel} onBind={st.ops.bind} />}
      {block.kind === 'text' && <TextEditor report={st.report} values={st.values} text={block.text} onText={(w) => st.ops.updateText(block.id, w)} />}
      {block.kind === 'summary' && (
        <>
          <p className="text-sm text-muted-foreground">{p('summary.explain')}</p>
          <SummaryBlock report={st.report} values={st.values} failed={false} design />
        </>
      )}
      <div>
        <Button variant="danger-outlined" onClick={() => st.ops.removeBlock(sec.id, block.id)}>
          <Trash2 className="size-3.5" />
          {p('block.remove')}
        </Button>
      </div>
    </div>
  )
}

function AddBlock({ st, sectionId, inline = false }: { st: State; sectionId: string; inline?: boolean }) {
  const { p, lang } = useProto()
  const hasSummary = st.report.sections.some((s) => s.blocks.some((b) => b.kind === 'summary'))
  return (
    <div className={`flex flex-wrap items-end gap-2 ${inline ? 'rounded-md border border-dashed border-border p-2' : ''}`} data-proto-add-block={sectionId}>
      <Button variant="outlined" onClick={() => st.ops.addBlock(sectionId, 'model')}>
        <BarChart3 className="size-3.5" />
        {p('add.model')}
      </Button>
      <Field label={p('add.view')} hideLabel className="w-56">
        <Select value="" onChange={(e) => e.target.value && st.ops.addBlock(sectionId, 'view', e.target.value)}>
          <option value="">{p('add.view')}</option>
          {SAVED_VIEWS.map((v) => (
            <option key={v.id} value={v.id}>
              {say(v.title, lang)}
            </option>
          ))}
        </Select>
      </Field>
      <Button variant="outlined" onClick={() => st.ops.addBlock(sectionId, 'text')}>
        <Type className="size-3.5" />
        {p('add.text')}
      </Button>
      <Button variant="outlined" aria-disabled={hasSummary} title={hasSummary ? p('add.summaryOne') : undefined} onClick={() => !hasSummary && st.ops.addBlock(sectionId, 'summary')}>
        <Sparkles className="size-3.5" />
        {p('add.summary')}
      </Button>
    </div>
  )
}

function MoveTools({ onUp, onDown, onRemove, onEdit, what }: { onUp: () => void; onDown: () => void; onRemove: () => void; onEdit?: () => void; what: string }) {
  const { p } = useProto()
  return (
    <span className="flex items-center gap-0.5">
      {onEdit && (
        <IconButton label={p('tools.edit', { what: fsi(what) })} size="compact" onClick={onEdit}>
          <Settings2 className="size-3.5" />
        </IconButton>
      )}
      <IconButton label={p('tools.up', { what: fsi(what) })} size="compact" onClick={onUp}>
        <ArrowUp className="size-3.5" />
      </IconButton>
      <IconButton label={p('tools.down', { what: fsi(what) })} size="compact" onClick={onDown}>
        <ArrowDown className="size-3.5" />
      </IconButton>
      <IconButton label={p('tools.remove', { what: fsi(what) })} size="compact" variant="danger" onClick={onRemove}>
        <Trash2 className="size-3.5" />
      </IconButton>
    </span>
  )
}

const blockName = (b: Block, lang: string, p: (k: string) => string) => (b.kind === 'panel' ? say(b.panel.title, lang) || p('block.untitledPanel') : p(`block.${b.kind}`))

// ── Variant A — the document is the editor ──────────────────────────────────────────────────

function DesignerA({ st, onPreview }: { st: State; onPreview: () => void }) {
  const { p, lang } = useProto()
  const [adding, setAdding] = useState<string | null>(null)
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4 p-4 pb-28" data-proto-designer="A">
      <AuthorBar st={st} onPreview={onPreview} />
      <WordsFields label={p('author.title')} value={st.report.title} onChange={st.ops.setTitle} />
      <ParamStrip report={st.report} values={st.values} onValue={st.ops.setValue} design={{ selected: st.selected, onEdit: (n) => st.setSelected(`param:${n}`), onAdd: st.ops.startParam }} />
      <article className="rounded-lg bg-card p-6 shadow-sm">
        <ReportBody
          report={st.report}
          values={st.values}
          failedSummary={false}
          design
          sectionTools={(sid) => (
            <span className="ms-auto">
              <MoveTools
                what={say(st.report.sections.find((s) => s.id === sid)?.heading, lang)}
                onEdit={() => st.setSelected(`section:${sid}`)}
                onUp={() => st.ops.moveSection(sid, -1)}
                onDown={() => st.ops.moveSection(sid, 1)}
                onRemove={() => st.ops.removeSection(sid)}
              />
            </span>
          )}
          blockFrame={(sid, b, rendered) => (
            <div className={`group relative rounded-lg ${st.selected === `block:${b.id}` ? 'ring-2 ring-primary ring-offset-4 ring-offset-card' : 'hover:ring-1 hover:ring-border hover:ring-offset-4 hover:ring-offset-card'}`}>
              <div className="absolute -top-3 end-2 z-10 hidden rounded-md border border-border bg-card px-1 shadow-sm group-hover:block group-focus-within:block">
                <MoveTools
                  what={blockName(b, lang, p)}
                  onEdit={() => st.setSelected(`block:${b.id}`)}
                  onUp={() => st.ops.moveBlock(sid, b.id, -1)}
                  onDown={() => st.ops.moveBlock(sid, b.id, 1)}
                  onRemove={() => st.ops.removeBlock(sid, b.id)}
                />
              </div>
              {rendered}
            </div>
          )}
          afterSection={(sid) =>
            adding === sid ? (
              <AddBlock st={st} sectionId={sid} inline />
            ) : (
              <div>
                <Button variant="text" onClick={() => setAdding(sid)} data-proto-open-add={sid}>
                  <Plus className="size-3.5" />
                  {p('add.toSection')}
                </Button>
              </div>
            )
          }
        />
        <div className="mt-6">
          <Button variant="outlined" onClick={st.ops.addSection}>
            <Plus className="size-3.5" />
            {p('add.section')}
          </Button>
        </div>
      </article>
      {st.selected && (
        <SideSheet onClose={() => st.setSelected(null)} width="w-[42rem]" aria-label={p('inspector.label')}>
          <div className="flex h-full flex-col overflow-y-auto p-5">
            <div className="mb-2 flex justify-end">
              <Button variant="text" onClick={() => st.setSelected(null)}>
                {p('inspector.done')}
              </Button>
            </div>
            <Inspector st={st} />
          </div>
        </SideSheet>
      )}
    </div>
  )
}

// ── Variant B — outline · canvas · inspector ────────────────────────────────────────────────

function DesignerB({ st, onPreview }: { st: State; onPreview: () => void }) {
  const { p, lang } = useProto()
  const row = (key: string, icon: ReactNode, label: ReactNode, tools?: ReactNode, depth = 0) => (
    <div key={key} className={`flex items-center gap-1 rounded-md ${st.selected === key ? 'bg-primary-050 text-primary-800' : 'hover:bg-muted'}`} style={{ paddingInlineStart: `${depth * 12}px` }}>
      <Button variant="ghost" className="min-w-0 flex-1 justify-start" onClick={() => st.setSelected(key)} data-proto-outline={key}>
        {icon}
        <span className="truncate">{label}</span>
      </Button>
      {tools}
    </div>
  )
  return (
    <div className="flex flex-col gap-3 p-4 pb-28" data-proto-designer="B">
      <AuthorBar st={st} onPreview={onPreview} />
      <div className="grid min-h-[70vh] grid-cols-[17rem_minmax(0,1fr)_28rem] gap-3">
        <nav className="flex flex-col gap-3 overflow-y-auto rounded-lg border border-border bg-card p-2" aria-label={p('outline.label')}>
          <div>
            <p className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{p('outline.params')}</p>
            {st.report.params.map((prm) =>
              row(
                `param:${prm.name}`,
                <Settings2 className="size-3.5 shrink-0" />,
                <>
                  {paramLabel(prm, lang)} <span className="text-[10px] text-muted-foreground">{p(`kind.${prm.kind}`)}</span>
                </>,
              ),
            )}
            <Button variant="text" onClick={st.ops.startParam} data-proto-add-param>
              <Plus className="size-3.5" />
              {p('strip.add')}
            </Button>
          </div>
          <div>
            <p className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{p('outline.sections')}</p>
            {st.report.sections.map((s) => (
              <div key={s.id}>
                {row(
                  `section:${s.id}`,
                  <LayoutList className="size-3.5 shrink-0" />,
                  <bdi>{say(s.heading, lang) || p('section.untitled')}</bdi>,
                  <span className="flex">
                    <IconButton label={p('tools.up', { what: fsi(say(s.heading, lang)) })} size="compact" onClick={() => st.ops.moveSection(s.id, -1)}>
                      <ArrowUp className="size-3" />
                    </IconButton>
                    <IconButton label={p('tools.down', { what: fsi(say(s.heading, lang)) })} size="compact" onClick={() => st.ops.moveSection(s.id, 1)}>
                      <ArrowDown className="size-3" />
                    </IconButton>
                  </span>,
                )}
                {s.blocks.map((b) =>
                  row(
                    `block:${b.id}`,
                    b.kind === 'panel' ? <BarChart3 className="size-3.5 shrink-0" /> : b.kind === 'text' ? <Type className="size-3.5 shrink-0" /> : <Sparkles className="size-3.5 shrink-0" />,
                    <bdi>{blockName(b, lang, p)}</bdi>,
                    <span className="flex">
                      <IconButton label={p('tools.up', { what: fsi(blockName(b, lang, p)) })} size="compact" onClick={() => st.ops.moveBlock(s.id, b.id, -1)}>
                        <ArrowUp className="size-3" />
                      </IconButton>
                      <IconButton label={p('tools.down', { what: fsi(blockName(b, lang, p)) })} size="compact" onClick={() => st.ops.moveBlock(s.id, b.id, 1)}>
                        <ArrowDown className="size-3" />
                      </IconButton>
                    </span>,
                    1,
                  ),
                )}
              </div>
            ))}
            <Button variant="text" onClick={st.ops.addSection}>
              <Plus className="size-3.5" />
              {p('add.section')}
            </Button>
          </div>
        </nav>
        <main className="flex min-w-0 flex-col gap-3 overflow-y-auto rounded-lg border border-border bg-muted/30 p-3">
          <ParamStrip report={st.report} values={st.values} onValue={st.ops.setValue} />
          <article className="rounded-lg bg-card p-5 shadow-sm">
            <ReportBody
              report={st.report}
              values={st.values}
              failedSummary={false}
              design
              blockFrame={(_sid, b, rendered) => <div className={`rounded-lg ${st.selected === `block:${b.id}` ? 'ring-2 ring-primary ring-offset-4 ring-offset-card' : ''}`}>{rendered}</div>}
            />
          </article>
        </main>
        <aside className="overflow-y-auto rounded-lg border border-border bg-card p-4" aria-label={p('inspector.label')} data-proto-inspector>
          <Inspector st={st} compact />
        </aside>
      </div>
    </div>
  )
}

// ── Variant C — steps ───────────────────────────────────────────────────────────────────────

const STEPS = ['params', 'content', 'words', 'share'] as const

function DesignerC({ st, onPreview }: { st: State; onPreview: () => void }) {
  const { p } = useProto()
  const initial = st.selected?.startsWith('block:t') ? 'words' : st.selected?.startsWith('block:') ? 'content' : 'params'
  const [step, setStep] = useState<(typeof STEPS)[number]>(st.shareOpen ? 'share' : initial)
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4 p-4 pb-28" data-proto-designer="C">
      <AuthorBar st={st} onPreview={onPreview} />
      <div role="tablist" className="flex gap-1" aria-label={p('steps.label')}>
        {STEPS.map((s, i) => (
          <Chip key={s} variant="tab" on={step === s} onClick={() => setStep(s)} data-proto-step={s}>
            <Ltr>{i + 1}</Ltr> {p(`steps.${s}`)}
          </Chip>
        ))}
      </div>
      {step === 'params' && <StepParams st={st} />}
      {step === 'content' && <StepContent st={st} />}
      {step === 'words' && <StepWords st={st} />}
      {step === 'share' && <StepShare st={st} />}
      <div className="flex justify-between">
        <Button variant="text" disabled={step === STEPS[0]} onClick={() => setStep(STEPS[Math.max(0, STEPS.indexOf(step) - 1)])}>
          {p('steps.back')}
        </Button>
        {step === 'share' ? (
          <Button onClick={onPreview}>{p('author.preview')}</Button>
        ) : (
          <Button onClick={() => setStep(STEPS[STEPS.indexOf(step) + 1])}>{p('steps.next')}</Button>
        )}
      </div>
    </div>
  )
}

/** The binding matrix: parameters down, panels across — every cell bound, unbound, or why not. */
function StepParams({ st }: { st: State }) {
  const { p, lang } = useProto()
  const panels = panelsOf(st.report)
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">{p('steps.paramsHint')}</p>
      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full text-sm" data-proto-matrix>
          <thead>
            <tr className="border-b border-border text-xs text-muted-foreground">
              <th className="p-2 text-start font-medium">{p('matrix.param')}</th>
              <th className="p-2 text-start font-medium">{p('matrix.default')}</th>
              {panels.map((pn) => (
                <th key={pn.id} className="max-w-36 p-2 text-start font-medium">
                  <bdi className="line-clamp-2">{say(pn.title, lang)}</bdi>
                </th>
              ))}
              <th />
            </tr>
          </thead>
          <tbody>
            {st.report.params.map((prm) => (
              <tr key={prm.name} className={`border-b border-border/50 ${st.selected === `param:${prm.name}` ? 'bg-primary-050' : ''}`}>
                <td className="p-2">
                  <span className="font-medium">{paramLabel(prm, lang)}</span>
                  <span className="ms-1 text-[11px] text-muted-foreground">{p(`kind.${prm.kind}`)}</span>
                </td>
                <td className="p-2 text-xs">
                  <DefaultText prm={prm} />
                </td>
                {panels.map((pn) => {
                  const bound = st.report.bindings[prm.name]?.[pn.id] !== undefined
                  const c = canBind(prm, pn)
                  return (
                    <td key={pn.id} className="p-2">
                      {c.ok || bound ? (
                        <Chip on={bound} onClick={() => st.ops.bind(prm.name, pn.id, !bound)} aria-label={p('matrix.cell', { param: fsi(paramLabel(prm, lang)), panel: fsi(say(pn.title, lang)) })}>
                          {bound ? <Check className="size-3.5" /> : <span className="size-3.5" />}
                        </Chip>
                      ) : (
                        <span className="text-[11px] text-muted-foreground" title={p(`reason.${c.reason}`)}>
                          {p('matrix.cannot')}
                        </span>
                      )}
                    </td>
                  )
                })}
                <td className="p-2">
                  <IconButton label={p('strip.edit', { name: fsi(prm.name) })} size="compact" onClick={() => st.setSelected(`param:${prm.name}`)}>
                    <Settings2 className="size-3.5" />
                  </IconButton>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div>
        <Button variant="outlined" onClick={st.ops.startParam} data-proto-add-param>
          <Plus className="size-3.5" />
          {p('strip.add')}
        </Button>
      </div>
      {(st.selected === 'new-param' || st.selected?.startsWith('param:')) && (
        <div className="rounded-lg border border-border bg-card p-4">
          <Inspector st={st} />
        </div>
      )}
      <div>
        <p className="mb-1 text-xs font-medium text-muted-foreground">{p('steps.stripPreview')}</p>
        <ParamStrip report={st.report} values={st.values} onValue={st.ops.setValue} />
      </div>
    </div>
  )
}

function DefaultText({ prm }: { prm: Param }) {
  const { t, p, lang } = useProto()
  const d = prm.default
  if (d.kind === 'period') return <>{t(`editor.periodName.${d.token}`)}</>
  if (d.kind === 'members') return <>{d.values.length ? d.values.length : p('default.all')}</>
  if (d.kind === 'grain') return <>{p(`grain.${d.grain}`)}</>
  if (d.kind === 'threshold') return <>{d.op === 'off' ? p('op.off', { measure: '' }) : <Ltr>{`${d.op} ${d.value}`}</Ltr>}</>
  if (d.kind === 'topN') return <Ltr>{d.n}</Ltr>
  if (d.kind === 'measure') return <>{say(measureOf(d.key)?.label, lang)}</>
  return <>{say(dimensionOf(d.key)?.label, lang)}</>
}

function StepContent({ st }: { st: State }) {
  const { p, lang } = useProto()
  return (
    <div className="flex flex-col gap-4">
      {st.report.sections.map((s) => (
        <section key={s.id} className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3">
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <WordsFields label={p('section.heading')} value={s.heading} onChange={(h) => st.ops.renameSection(s.id, h)} />
            </div>
            <MoveTools what={say(s.heading, lang)} onUp={() => st.ops.moveSection(s.id, -1)} onDown={() => st.ops.moveSection(s.id, 1)} onRemove={() => st.ops.removeSection(s.id)} />
          </div>
          {s.blocks.map((b) => (
            <div key={b.id} className="rounded-md border border-border/70">
              <div className="flex items-center gap-2 p-2">
                {b.kind === 'panel' ? <BarChart3 className="size-3.5" /> : b.kind === 'text' ? <Type className="size-3.5" /> : <Sparkles className="size-3.5" />}
                <bdi className="flex-1 truncate text-sm">{blockName(b, lang, p)}</bdi>
                <MoveTools
                  what={blockName(b, lang, p)}
                  onEdit={() => st.setSelected(st.selected === `block:${b.id}` ? null : `block:${b.id}`)}
                  onUp={() => st.ops.moveBlock(s.id, b.id, -1)}
                  onDown={() => st.ops.moveBlock(s.id, b.id, 1)}
                  onRemove={() => st.ops.removeBlock(s.id, b.id)}
                />
              </div>
              {st.selected === `block:${b.id}` && b.kind === 'panel' && (
                <div className="grid grid-cols-2 gap-4 border-t border-border p-3">
                  <PanelEditor report={st.report} panel={b.panel} onPanel={st.ops.updatePanel} onBind={st.ops.bind} />
                  <div className="sticky top-2 self-start">
                    <ReportBody report={{ ...st.report, sections: [{ ...s, blocks: [b] }] }} values={st.values} failedSummary={false} design />
                  </div>
                </div>
              )}
            </div>
          ))}
          <AddBlock st={st} sectionId={s.id} inline />
        </section>
      ))}
      <div>
        <Button variant="outlined" onClick={st.ops.addSection}>
          <Plus className="size-3.5" />
          {p('add.section')}
        </Button>
      </div>
    </div>
  )
}

function StepWords({ st }: { st: State }) {
  const { p, lang } = useProto()
  const blocks = st.report.sections.flatMap((s) => s.blocks.filter((b) => b.kind !== 'panel').map((b) => ({ s, b })))
  return (
    <div className="flex flex-col gap-4">
      <WordsFields label={p('author.title')} value={st.report.title} onChange={st.ops.setTitle} />
      {blocks.map(({ s, b }) => (
        <div key={b.id} className={`rounded-lg border bg-card p-3 ${st.selected === `block:${b.id}` ? 'border-primary' : 'border-border'}`}>
          <p className="mb-2 text-xs text-muted-foreground">
            <bdi>{say(s.heading, lang)}</bdi>
          </p>
          {b.kind === 'text' ? (
            <TextEditor report={st.report} values={st.values} text={b.text} onText={(w) => st.ops.updateText(b.id, w)} />
          ) : (
            <>
              <p className="mb-2 text-sm text-muted-foreground">{p('summary.explain')}</p>
              <SummaryBlock report={st.report} values={st.values} failed={false} design />
            </>
          )}
        </div>
      ))}
    </div>
  )
}

function StepShare({ st }: { st: State }) {
  const { p } = useProto()
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
      <AudienceChip audience={st.report.audience} />
      <div>
        <Button variant="outlined" onClick={() => st.setShareOpen(true)}>
          <Share2 className="size-3.5" />
          {p('author.share')}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">{p('steps.scheduleLater')}</p>
    </div>
  )
}

// ── The runner's page (794 §3) — the same in every variant ──────────────────────────────────

function permalinkOf(r: Report, values: Values): string {
  const q = new URLSearchParams()
  for (const prm of r.params) {
    const v = values[prm.name] ?? prm.default
    if (JSON.stringify(v) === JSON.stringify(prm.default)) continue
    if (v.kind === 'period') q.set(prm.name, v.token)
    if (v.kind === 'members') v.values.length ? v.values.forEach((x) => q.append(prm.name, x)) : q.set(prm.name, '')
    if (v.kind === 'grain') q.set(prm.name, v.grain)
    if (v.kind === 'threshold') q.set(prm.name, v.op === 'off' ? '' : `${v.op}:${v.value}`)
    if (v.kind === 'topN') q.set(prm.name, String(v.n))
    if (v.kind === 'measure' || v.kind === 'breakdown') q.set(prm.name, v.key)
  }
  const s = q.toString()
  return `/analytics/report/${r.id}${s ? `?${s}` : ''}`
}

function RunnerPage({ st, fallback, onBack }: { st: State; fallback: boolean; onBack?: () => void }) {
  const { p, lang } = useProto()
  const [copied, setCopied] = useState(false)
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4 p-4 pb-28" data-proto-runner>
      <header className="flex flex-wrap items-center gap-2">
        {onBack && (
          <Button variant="text" onClick={onBack} data-proto-back>
            {p('runner.back')}
          </Button>
        )}
        <h1 className="text-xl font-semibold">
          <bdi>{say(st.report.title, lang)}</bdi>
        </h1>
        <AudienceChip audience={st.report.audience} />
        <span className="text-xs text-muted-foreground">
          {p('runner.owner', { owner: fsi(st.report.owner) })} · {p('runner.asOf')} <Ltr>06:40</Ltr>
        </span>
        <div className="ms-auto flex gap-2">
          <Button variant="outlined" onClick={() => setCopied(true)} data-proto-copy-link>
            <Copy className="size-3.5" />
            {p('runner.copyLink')}
          </Button>
          <Button variant="outlined" aria-disabled title={p('runner.exportProto')}>
            <Download className="size-3.5" />
            {p('runner.export')}
          </Button>
        </div>
      </header>
      {copied && (
        <p className="text-xs text-muted-foreground">
          {p('runner.copied')} <Ltr>{permalinkOf(st.report, st.values)}</Ltr>
        </p>
      )}
      {fallback && (
        <div role="status" className="rounded-md border border-attention-border bg-attention-050 p-2 text-xs text-attention-800" data-proto-fallback>
          {p('runner.fallback', { value: fsi('jahez'), param: fsi(p('runner.channel')) })}
        </div>
      )}
      <ParamStrip report={st.report} values={st.values} onValue={st.ops.setValue} onReset={st.ops.reset} />
      <article className="rounded-lg bg-card p-6 shadow-sm">
        <ReportBody report={st.report} values={st.values} failedSummary={fallback} />
      </article>
    </div>
  )
}
