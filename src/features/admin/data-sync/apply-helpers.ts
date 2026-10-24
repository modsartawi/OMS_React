/**
 * The Apply dialog's pure logic (spec 558, ticket 564): the reason check, what gets written, each
 * store's ActionSync readiness, the ActionSync control batches with their campaign tag, and the
 * order of the whole apply flow. No React, no network (the flow takes its calls injected) — pinned
 * by `apply-helpers.test.ts`.
 *
 * 🔌 565 (hand-back) reuses `campaignControlReason`, `storeControlBatches` and `runStoreControl`
 * to resume the resumable stores with the same tag.
 */
import type { ApiEnvelope, GeneralErrorResponse } from '@/core/api'
import type { Campaign, CreateCampaignRequest, TableSpec } from '@/core/models/data-sync'
import type { StoreControlRequest, StoreControlResponse, StoreRow, SyncHost } from '@/core/models/sync-console'
import type { CreateTargets } from './create-helpers'

// ── Reason ──────────────────────────────────────────────────────────────────────

/** An Apply campaign's reason, trimmed, needs at least this many characters (the door's 422 otherwise). */
export const MIN_APPLY_REASON = 10

export type ReasonProblem = 'required' | 'tooShort'

/** What is wrong with an Apply reason as typed, or `null` when it will do. */
export function reasonProblem(reason: string): ReasonProblem | null {
  const r = reason.trim()
  if (!r) return 'required'
  return r.length < MIN_APPLY_REASON ? 'tooShort' : null
}

// ── What gets written ───────────────────────────────────────────────────────────

export interface ApplyTableSplit {
  /** Picked and `applyAllowed`: an Apply writes these. */
  written: string[]
  /** Picked but not `applyAllowed`: compared and reported only. */
  reported: string[]
}

/** The ticked tables split by `applyAllowed`, in the profile's order. No `written` = Apply can't be chosen. */
export function applyTableSplit(tableSet: readonly TableSpec[], picked: readonly string[]): ApplyTableSplit {
  const on = new Set(picked)
  const split: ApplyTableSplit = { written: [], reported: [] }
  for (const s of tableSet) if (on.has(s.table)) (s.applyAllowed ? split.written : split.reported).push(s.table)
  return split
}

// ── Store readiness (from `ActionSync/Fleet`) ───────────────────────────────────

/** The fields of an ActionSync fleet row readiness reads. `host` is widened: the door may send `None`. */
export type ReadinessRow = Pick<StoreRow, 'code' | 'isPaused' | 'controlPending'> & { host: SyncHost }

/** Why a store can never be applied to: synced by the WPF host, or not on ActionSync at all. */
export type NeverWhy = 'wpf' | 'notFound'

export type StoreReadiness = { readiness: 'never'; why: NeverWhy } | { readiness: 'ready' } | { readiness: 'willPause' }

/**
 * One store's apply readiness (DataSync's safe-to-apply, engine spec §7.2): WPF-hosted or unknown
 * to ActionSync → never; on the worker, paused and acknowledged (`!controlPending`) → ready; on the
 * worker otherwise → will be paused; no host → ready (nothing writes to it).
 */
export function applyReadiness(row: ReadinessRow | undefined): StoreReadiness {
  if (!row) return { readiness: 'never', why: 'notFound' }
  if (row.host === 'Wpf') return { readiness: 'never', why: 'wpf' }
  if (row.host === 'None') return { readiness: 'ready' }
  return row.isPaused && !row.controlPending ? { readiness: 'ready' } : { readiness: 'willPause' }
}

export interface StoresReadiness {
  never: { code: string; why: NeverWhy }[]
  ready: string[]
  willPause: string[]
  /**
   * The stores the flow pauses: the `willPause` ones only. A `ready` store is already paused and
   * acknowledged by someone else — the flow never pauses it again, untagged or tagged, so it keeps
   * that pause (orchestrator ruling, 2026-10-24: never tag a pause that isn't ours). Its job is
   * therefore not `actionSyncResumable` (engine spec §7.4) and it stays paused afterwards for
   * whoever paused it. Spelt as ActionSync spells the code.
   */
  toPause: string[]
}

/** The targets' readiness: the picked codes matched case-insensitively, or every fleet row. */
export function storesReadiness(targets: CreateTargets, rows: readonly ReadinessRow[]): StoresReadiness {
  const byCode = new Map(rows.map((r) => [r.code.toUpperCase(), r]))
  const picked: { code: string; row: ReadinessRow | undefined }[] =
    targets.kind === 'fleet'
      ? rows.map((r) => ({ code: r.code, row: r }))
      : targets.codes.map((code) => {
          const row = byCode.get(code.toUpperCase())
          return { code: row?.code ?? code, row }
        })
  const out: StoresReadiness = {
    never: [],
    ready: [],
    willPause: [],
    toPause: [],
  }
  for (const { code, row } of picked) {
    const r = applyReadiness(row)
    if (r.readiness === 'never') {
      out.never.push({ code, why: r.why })
      continue
    }
    out[r.readiness].push(code)
    if (r.readiness === 'willPause') out.toPause.push(code)
  }
  return out
}

// ── ActionSync control batches (564 pause, 565 hand-back) ───────────────────────

/** `POST ActionSync/Stores/Control` takes at most this many codes (400 `TOO_MANY_STORES` beyond). */
export const STORE_CONTROL_BATCH = 50

/**
 * The tag DataSync looks for on a store's latest ActionSync control audit row
 * (`DataSync campaign <id>`) — only then is a succeeded job `actionSyncResumable`.
 */
export const campaignControlReason = (campaignId: string, reason: string): string => `DataSync campaign ${campaignId}: ${reason.trim()}`

/** The first pause, sent before the campaign (and so its id) exists — deliberately NOT the tag. */
export const pendingControlReason = (reason: string): string => `DataSync campaign (pending): ${reason.trim()}`

/** The stores as control requests of at most 50 codes each, in order, all with the one reason. */
export function storeControlBatches(
  action: StoreControlRequest['action'],
  codes: readonly string[],
  reason: string,
): StoreControlRequest[] {
  const out: StoreControlRequest[] = []
  for (let i = 0; i < codes.length; i += STORE_CONTROL_BATCH)
    out.push({
      action,
      codes: codes.slice(i, i + STORE_CONTROL_BATCH),
      reason,
    })
  return out
}

/** A store the control door refused on a 200 (`NOT_ON_WORKER`, `NO_STORE`). */
export interface StoreRefusal {
  code: string
  error: string
}

/** What a run of control batches did. */
export interface StoreControlRun {
  /** Stores the door moved. */
  ok: string[]
  /** Stores it refused, each with its plain code. */
  refused: StoreRefusal[]
  /** A batch that failed outright (network, 400, bare 403) — the run stops there. */
  error: unknown
  /** The codes of that batch and every batch after it, never sent or not known to have landed. */
  unsent: string[]
}

/**
 * Posts the batches one after another (never in parallel: the door audits each as one row) and
 * gathers the per-store results. A batch that throws stops the run; its codes and the rest are
 * `unsent`. Takes the call injected so it stays pure — 565's hand-back runs its Resume through it.
 */
export async function runStoreControl(
  send: (req: StoreControlRequest) => Promise<StoreControlResponse>,
  batches: readonly StoreControlRequest[],
): Promise<StoreControlRun> {
  const run: StoreControlRun = { ok: [], refused: [], error: null, unsent: [] }
  for (let i = 0; i < batches.length; i++) {
    try {
      const res = await send(batches[i])
      for (const r of res.results) {
        if (r.ok) run.ok.push(r.code)
        else run.refused.push({ code: r.code, error: r.error ?? '' })
      }
    } catch (err) {
      run.error = err
      run.unsent = batches.slice(i).flatMap((b) => b.codes)
      break
    }
  }
  return run
}

// ── Waiting for ActionSync to acknowledge (review fix, 2026-10-24) ──────────────

/** How often the flow re-reads `ActionSync/Fleet` while it waits for the pause to be acknowledged. */
export const ACK_POLL_MS = 3_000
/** How long it waits at most before deciding with what it has. */
export const ACK_WAIT_MS = 120_000

/** Of the stores the flow paused: those ActionSync has acknowledged, and those it still waits on. */
export interface AckProgress {
  acknowledged: string[]
  waiting: string[]
}

/**
 * Which of `codes` are now safe to apply (DataSync's §7.2: on the worker, paused and acknowledged —
 * `applyReadiness` says `ready`), matched case-insensitively, each spelt as given. A store the
 * fleet no longer lists is still waiting.
 */
export function ackProgress(rows: readonly ReadinessRow[], codes: readonly string[]): AckProgress {
  const byCode = new Map(rows.map((r) => [r.code.toUpperCase(), r]))
  const out: AckProgress = { acknowledged: [], waiting: [] }
  for (const code of codes) {
    const row = byCode.get(code.toUpperCase())
    ;(row && applyReadiness(row).readiness === 'ready' ? out.acknowledged : out.waiting).push(code)
  }
  return out
}

export type AckDecision = 'wait' | 'create' | 'stop'

/**
 * Whether to keep waiting, create, or stop. DataSync's create refuses 409 `DATASYNC_STORE_BUSY`
 * when NO target is safe, so: every paused store acknowledged → create; the bound passed → create
 * if at least one target is safe (acknowledged now, or `alreadySafe` ready ones), else stop;
 * otherwise wait. With nothing to wait on and nothing safe, stop at once.
 */
export function ackDecision(progress: AckProgress, alreadySafe: number, timedOut: boolean): AckDecision {
  const safe = progress.acknowledged.length + alreadySafe
  if (progress.waiting.length === 0) return safe > 0 ? 'create' : 'stop'
  if (!timedOut) return 'wait'
  return safe > 0 ? 'create' : 'stop'
}

// ── The apply flow ──────────────────────────────────────────────────────────────

export interface ApplyFlowDeps {
  control: (req: StoreControlRequest) => Promise<StoreControlResponse>
  /** `ActionSync/Fleet`, re-read while waiting for the pause to be acknowledged. */
  readFleet: () => Promise<readonly ReadinessRow[]>
  create: (body: CreateCampaignRequest) => Promise<ApiEnvelope<Campaign>>
  start: (campaignId: string) => Promise<Campaign>
  /** The timer, injected (the dialog passes `setTimeout`; the tests a fake clock). */
  sleep: (ms: number) => Promise<void>
  now: () => number
  /** Told as each step begins, for the dialog's progress line. */
  onStep?: (step: ApplyStep) => void
  /** Told after each fleet read while waiting: how many stores still have to acknowledge. */
  onWait?: (progress: AckProgress) => void
}

export type ApplyStep = 'holding' | 'waiting' | 'creating' | 'tagging' | 'starting'

export interface ApplyFlowInput {
  body: CreateCampaignRequest
  /** The reason as typed (trimmed into the tags). */
  reason: string
  /** The stores to pause first (`StoresReadiness.toPause`); `null` = "pause ActionSync first" is off. */
  toPause: readonly string[] | null
  /** Targets already paused and acknowledged (`StoresReadiness.ready`) — never paused again, but safe. */
  alreadySafe: readonly string[]
}

export interface ApplyOutcome {
  /** Step 1, the untagged pause; `null` when the toggle is off or there was nothing to pause. */
  held: StoreControlRun | null
  /** Step 2, what the wait last saw; `null` when nothing was waited on. */
  ack: AckProgress | null
  /** The wait ended with no target safe: no campaign was created. */
  ackStopped: boolean
  createError: unknown
  campaign: Campaign | null
  /** The create's per-store warnings (`DATASYNC_STORE_BUSY` / `DATASYNC_STORE_WPF_HOSTED`) on a success. */
  warnings: GeneralErrorResponse[]
  /** Step 4, the tagged re-pause. */
  tagged: StoreControlRun | null
  startError: unknown
  started: Campaign | null
}

/**
 * The Apply flow (spec 558, ticket 564; order re-ruled by the orchestrator on review, 2026-10-24 —
 * DataSync ask B is not built and ADR 0004 §2 says the create carries no pause flag):
 *
 * 1. pause the stores still worked by ActionSync **untagged** (`DataSync campaign (pending): <reason>`),
 *    batches ≤ 50 — never a store someone else already paused (`alreadySafe`);
 * 2. **wait** for ActionSync to acknowledge: re-read `ActionSync/Fleet` every `ACK_POLL_MS`, at most
 *    `ACK_WAIT_MS`, deciding with `ackDecision` — a create before the acknowledgement is refused
 *    409 `DATASYNC_STORE_BUSY` (safe = on worker ∧ paused ∧ acknowledged, engine spec §7.2);
 * 3. create the campaign (Apply + reason) → Ready, with its id;
 * 4. re-pause the stores step 1 took, **tagged** `DataSync campaign <id>: <reason>`, batches ≤ 50 —
 *    the tag must be each store's latest control or its job is never `actionSyncResumable`;
 * 5. Start.
 *
 * A batch failing outright in step 1, a wait that ends with no target safe, or a failed create
 * stops there. Nothing is ever resumed: the stores paused so far stay paused
 * (`stillPausedAfterFailure`) and the dialog names them. With the toggle off it only creates, and
 * Start stays the page's.
 */
export async function runApplyFlow(deps: ApplyFlowDeps, input: ApplyFlowInput): Promise<ApplyOutcome> {
  const out: ApplyOutcome = {
    held: null,
    ack: null,
    ackStopped: false,
    createError: null,
    campaign: null,
    warnings: [],
    tagged: null,
    startError: null,
    started: null,
  }
  const pausing = input.toPause !== null
  if (pausing && input.toPause!.length > 0) {
    deps.onStep?.('holding')
    out.held = await runStoreControl(deps.control, storeControlBatches('Pause', input.toPause!, pendingControlReason(input.reason)))
    if (out.held.error) return out
    if (!(await waitForAck(deps, out, out.held.ok, input.alreadySafe.length))) {
      out.ackStopped = true
      return out
    }
  }
  deps.onStep?.('creating')
  try {
    const env = await deps.create(input.body)
    out.campaign = env.data
    out.warnings = env.errors ?? []
  } catch (err) {
    out.createError = err
    return out
  }
  if (!pausing || !out.campaign) return out
  const id = out.campaign.campaignId
  if (out.held && out.held.ok.length > 0) {
    deps.onStep?.('tagging')
    out.tagged = await runStoreControl(deps.control, storeControlBatches('Pause', out.held.ok, campaignControlReason(id, input.reason)))
  }
  deps.onStep?.('starting')
  try {
    out.started = await deps.start(id)
  } catch (err) {
    out.startError = err
  }
  return out
}

/**
 * Step 2: re-reads the fleet until `ackDecision` stops waiting. A failed read counts as "nobody
 * acknowledged yet" and is waited through. `true` = go on to the create.
 */
async function waitForAck(deps: ApplyFlowDeps, out: ApplyOutcome, paused: readonly string[], alreadySafe: number): Promise<boolean> {
  let progress: AckProgress = { acknowledged: [], waiting: [...paused] }
  if (paused.length === 0) return ackDecision(progress, alreadySafe, true) === 'create'
  deps.onStep?.('waiting')
  const deadline = deps.now() + ACK_WAIT_MS
  for (;;) {
    try {
      progress = ackProgress(await deps.readFleet(), paused)
    } catch {
      // keep the last progress; the bound still applies
    }
    out.ack = progress
    deps.onWait?.(progress)
    const decision = ackDecision(progress, alreadySafe, deps.now() >= deadline)
    if (decision !== 'wait') return decision === 'create'
    await deps.sleep(ACK_POLL_MS)
  }
}

/** The create warnings the Apply outcome hands the campaign page in router state (they don't survive a reload). */
export interface CampaignPageState {
  createWarnings: GeneralErrorResponse[]
}

const isWarning = (w: unknown): w is GeneralErrorResponse =>
  typeof w === 'object' && w !== null && typeof (w as GeneralErrorResponse).errorCode === 'string'

/** The create warnings carried to the campaign page, or none (opened any other way, or reloaded). */
export function createWarningsFromState(state: unknown): GeneralErrorResponse[] {
  const list = (state as Partial<CampaignPageState> | null)?.createWarnings
  return Array.isArray(list) && list.every(isWarning) ? list : []
}

/**
 * The store a create warning names. The door carries it only inside the text, as `client/code`
 * (wire §9.3) — no structured field — so this reads the first `x/y` token, or `null`.
 */
export function createWarningStore(w: GeneralErrorResponse): string | null {
  return /\b([A-Za-z0-9_-]+\/[A-Za-z0-9_-]+)\b/.exec(w.errorMessage ?? '')?.[1] ?? null
}

/** The stores the flow paused before it stopped short of a campaign — still paused, for a person. */
export const stillPausedAfterFailure = (out: ApplyOutcome): string[] => (out.campaign ? [] : (out.held?.ok ?? []))

/** Stores paused but whose tagged re-pause did not land: their jobs will not be offered for hand-back. */
export function untaggedStores(out: ApplyOutcome): string[] {
  if (!out.campaign || !out.held) return []
  const tagged = new Set(out.tagged?.ok ?? [])
  return out.held.ok.filter((c) => !tagged.has(c))
}
