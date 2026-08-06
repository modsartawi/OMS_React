---
status: done
spec: 231
blocked-by: 233
---

# 236 — Activities fetches when opened and states its ceiling

## What to build

The first tab, and with it **the whole tab shell** the other two slot into. Activities is the tab an
agent lands on, because "what happened to my points" is the question that brought them here.

**Six columns:** Date (`formatDateTime`) · Activity · **Points** · Status · Expires · Reference.

- 🚩 **`points` arrives already signed.** `LoyActivityService.AddActivity` negates `SpendPoints` in
  place for debits, so there is **no client-side debit/credit table** and none is needed — 223's
  original "derive the sign from `ActivityType`" was struck by 226.
- Signed, `text-end`, tabular numerals, **exactly two decimals always** (`accrualFactor` is
  `0.285714286`, so fractional points are routine), and 🚩 **never coloured** — the Activity column
  already names the direction in the server's own English, so the sign is a second reading of a fact
  already stated in text. A colour-blind agent loses nothing.
- **Expires** is blank when `points <= 0` (the server's own rule) and on a sentinel date.
- **Status earns its place**: a *Pending* accrual is the commonest "why isn't my balance right", and
  without the column a pending row looks identical to a posted one — the tab would silently
  misexplain the balance it exists to explain.
- 🚩 **No client-side total, ever.** The server rounds each row, so a sum of rounded rows will not
  equal the header's `pointsBalance`.

**The tab shell, established here:**

- **Lazy fetch on first open**, cached per member. Consequence that simplifies everything downstream:
  **only the open tab can be loading or failed**, so there is no invisible broken tab to signal.
- **`?tab=` in the URL** so a link lands where it meant to; an unknown value falls back to Activities
  rather than erroring.
- **The ceiling is always stated.** `"Most recent 100 activities."`, plus an at-cap warning
  (`"there may be older activity not shown"`) when the returned count **equals** the cap. At
  exactly-100 that warning is a harmless false positive; silence would be a false **negative** on a
  4,000-row member, which is the failure that matters. 🚩 **A bare row count is never shown** — it
  reads as completeness.
- **Sort and filter are on**, because the entire window is already in the browser and the caption
  says which window it is. (Actions is the opposite case and says so by contrast — see
  [238](238-actions-pages-through-a-real-total.md).)
- **Empty** is a sentence in this tab's own words — *"No loyalty activity for this member."* — never a
  shared "No data". A rejected option was one generic empty/error pair; it costs the sentence that
  tells the agent *what* was absent.
- **Failed** is the existing `core/ui/ErrorBanner` **inline in the tab body**, message via
  `apiErrorMessage(err, fallback)`, plus a **Retry scoped to that tab**. No toast — the state is
  already fully visible in the tab being looked at. The header and other tabs are untouched.
- **Empty and failed are never conflated.** By the time a tab fetches the member exists — only the
  *member* call can refuse a bad key, and the reports answer `[]` for a member with no history.

**No row links.** Checked, not assumed: no route accepts an `ActivityId` or a reference number, and
`oms/document/:documentNo` is a different identifier space that would 404 on every row.

Ordering note, worth knowing and not worth a caveat on screen: the source is `ORDER BY ActivityId
DESC` — **insertion order, not date order** — so a backdated posting sorts by when it was written.

## Spine reach

model · **api** (`LoyWeb/Reports/LastActivities/{loyId}`) · **logic** (`tab-volume`, pure) ·
**component/route** (the tab strip + `?tab=`) · **i18n** · test

## Proof (→ `tdd` red-green cycles)

- [x] `tab-volume` — the caption names the ceiling; the at-cap warning fires at exactly the cap and
      not below; a bare row count is never produced · **pure** — `src/features/loy/member/tab-volume.test.ts`,
      11 cases. The bare-count rule is asserted structurally (`Object.values(v)` never contains the
      row count; the returned keys are exactly `captionKey` / `cap` / `warningKey`), so the module
      cannot start leaking a count through a new field.
- [x] `tools/loy-member-drive.mjs` (extended) — Activities loads on landing; a second tab does **not**
      fetch until opened; a 40-row member shows the caption without the warning and a 100-row member
      shows both; a stubbed failure shows the inline banner with a Retry that refetches only that
      tab; an empty member shows the Activities sentence; `?tab=` survives a reload · **flow** —
      scenarios 20–26, **105/105 green** (was 67/67 before this ticket).

## Answer

Landed: `tab-volume.ts` (+ suite), `activity-columns.ts`, `ActivitiesTab.tsx`, `MemberTabs.tsx`,
`LoyActivityRow` on `core/models/loy.ts`, `loyReportsApi.activities` + `activitiesKey` on the
feature's `api.ts`, and the `tabs.*` block in `loy.json`. No registration point moved — the area,
the namespace, the routes and the menu item all landed with 233/234.

Six things the build settled or is worth carrying forward:

- 🚩 **Lazy is structural, not a flag.** Only the open tab's panel is mounted, so only its query
  exists. The drive proves it the only way that means anything: a cold `/loy/members/:loyId?tab=sales`
  makes **zero** `LastActivities` calls, and opening Activities makes exactly one.
- **`staleTime: Infinity` on the tab query**, so leaving a tab and coming back does not re-read a
  window that cannot have moved — "cached per member" in the ticket's words. Without it TanStack's
  default `staleTime: 0` refetches on every remount.
- **Tab switching REPLACES the history entry.** A tab is a question about a member already on
  screen, not a place; pushing would put three entries between the agent and the field, against
  227 #3's promise that Back from a member lands on the field. `?tab=` is still in the URL, so the
  link and reload promises are untouched.
- 🚩 **The failure banner needed BOTH sentences.** `apiErrorMessage` on a raw 500 yields the generic
  `common:errors.server` line, because a crash carries no envelope to say anything better — and on a
  screen with three tabs that leaves the agent not knowing *which* broke. So the banner's **title**
  is this tab's own sentence ("The loyalty activity could not be read.") and its **message** is the
  server's through `apiErrorMessage`. The ticket's expectation that "the fallback string is what the
  agent reads there" was half right: the fallback is not reached, but the sentence it carries still
  has to be on screen.
- **The strip renders all three peers** with Sales and Actions saying "This tab is not available
  yet." and making no call. Growing the strip slice by slice would have changed `resolveTab`'s
  unknown-value fallback mid-wave — `?tab=sales` meaning Activities today and Sales tomorrow — which
  is the deep-link behaviour this ticket exists to fix. Logged in `.afk/HITL-236.md` with four other
  calls.
- 🚩 **One 235 drive assertion was over-broad and is now narrower**: "engine machinery is drawn
  nowhere" matched the bare word `Redemption`, which since this ticket is a thing that *happened to
  the member* in the Activities grid. It now matches the machinery's **labels** (`Accrual factor`,
  `Redemption factor`, `Exchange rate`, `W|D`) — a factor always arrives labelled. Also fixed a
  latent flake in 233's scenario 7: `fill` returns before React's controlled value settles after a
  navigation, so the drive now waits for the box to hold what it typed.

`countedVolume` (Actions' real total) is built and tested here rather than in 238, because spec 231's
testing table assigns `tab-volume` all three tabs and the counted shape is the **contrast** that
makes the capped rule legible — a capped tab may never say a row count, a counted one must say a
total.

Gates: `npm run typecheck`, `npm run lint` (three gates), `npm run build`, `npm test`
(1146 pure cases, 70 files) and `tools/loy-member-drive.mjs` **105/105**, all green.

🚩 **Nothing was driven against a live SIS.Api** — the `LoyWeb/Reports/LastActivities/{loyId}` door
is BackOffice 978 and does not exist. Every envelope in the drive is stubbed from 223's field
inventory.

## Boundaries

- **New API dependency:** `GET LoyWeb/Reports/LastActivities/{loyId}` — BackOffice, not built.
  It is a raw-SQL read with **no existence check**, so a missing member yields `200 []`, not a
  refusal. 🚩 The realistic failure is a **raw 500 with no envelope** (`ExecuteAsync` rethrows
  anything that is not a `DomainException`) — which is what earns the Retry, and why the fallback
  string is what the agent actually reads there.
- 🚩 **Reuse, do not rebuild:** `core/ui/ErrorBanner` (verified, in `core/ui`) and `formatDateTime`.
- New `loy.json` keys for the captions, the empty sentence and the tab labels.

## Done when

`tab-volume` is green, the tab strip works with `?tab=`, a tab fetches only when opened, and the
drive shows the below-cap / at-cap / empty / failed-with-Retry states.

🚩 Nothing driven against a live SIS.Api.

## Blocked by

[233](233-one-field-resolves-a-member.md) — a tab needs a resolved member to hang off.
