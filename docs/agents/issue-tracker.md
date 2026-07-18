# Issue tracker: `.issues/` (local markdown)

Issues, specs, and wayfinder maps for this repo live as markdown files in `.issues/` at the repo
root. No external tracker, no CLI dependencies. This doc is the single source of truth the agent
skills (`to-spec`, `to-tickets`, `wayfinder`, `implement`, `standards-review`) read for conventions.

> This is `oms-react`'s **own** local tracker, starting fresh from `001`. The earlier
> React-portal effort tracked in `C:\Work\DMSCO\BackOffice\.issues\` (the shared 4xx sequence —
> maps 402/413/420/426) remains the historical record; new work minted here does not continue
> that sequence. When a ticket references prior BackOffice research, link it by absolute path.

## Conventions

- **One file per issue**: `.issues/NNN-short-slug.md`. `NNN` is zero-padded three digits; next
  number = highest existing + 1 (scan the folder, not INDEX.md — runbooks and non-numbered files
  also live here). **Concurrent-mint guard**: re-glob `.issues/NNN-*.md` for your chosen number
  immediately before writing the file — if another session got there first, take the next free
  number instead.
- **Numbers are permanent** — never renumber, reuse, or delete files. State changes by editing
  frontmatter and the INDEX line.
- **Index**: `.issues/INDEX.md` — one line per issue under a track/effort heading:
  `- [NNN](NNN-short-slug.md) — <title> · **open**/**done** · blocked by: NNN, NNN | —`
- **Frontmatter** on every issue: `status:` plus type-specific fields (below).
- **Comments / follow-ups** append to the bottom of the file under a `## Comments` heading.
- Long-form runbooks (e.g. `PROD-DEPLOY-RUNBOOK.md`) also live in `.issues/` un-numbered;
  they are not issues and don't get INDEX status lines.

## Issue kinds

| Kind | Created by | Frontmatter | Body |
|---|---|---|---|
| **Ticket** (build slice) | `/to-tickets` | `status`, `spec`, `blocked-by` | What to build / Spine reach / Proof / Boundaries / Done when / Blocked by / Open questions |
| **Spec** | `/to-spec` | `type: spec`, `status` | Problem / Solution / User Stories / Implementation Decisions / Testing Decisions / Out of Scope |
| **Wayfinder map** | `/wayfinder` | `type: wayfinder-map`, `status` | Destination / Notes / Decisions so far / Not yet specified / Out of scope |
| **Wayfinder ticket** | `/wayfinder` | `type: wayfinder-ticket`, `wayfinder: <research\|prototype\|grilling\|task>`, `map`, `status`, `blocked-by` | Question (+ `## Answer` on resolution) |

## Status vocabulary

- Build tickets: `open` → `done` (set by `/implement` when Done-when holds; Proof boxes ticked).
- Specs: `draft` → `ready` (ready = consumable by `/to-tickets`).
- Wayfinder tickets: `open` → `claimed` → `done` (see Wayfinding operations).
- Anything abandoned: `status: wontfix` plus a one-line reason in the body — the file stays.

## When a skill says "publish to the issue tracker"

Create `.issues/NNN-<slug>.md` with the kind's frontmatter and add its INDEX.md line under the
relevant effort heading (create the heading if the effort is new).

## When a skill says "fetch the ticket"

Read the file. Users normally pass the number (`012`) or the file name; resolve numbers by glob
`.issues/012-*.md`.

## Wayfinding operations

Used by `/wayfinder`. The **map** is a numbered issue with one **child** issue per ticket.

- **Map**: `type: wayfinder-map` frontmatter; body per the wayfinder skill's template.
- **Child ticket**: `type: wayfinder-ticket`, `map: <NNN>` pointing at its map,
  `wayfinder: <type>` recording the ticket type, `## Question` in the body.
- **Blocking**: the `blocked-by: NNN, NNN` frontmatter (mirrored on the INDEX line). A ticket is
  unblocked when every issue it lists is `done`.
- **Frontier**: scan for `map: <NNN>` children that are `status: open` and unblocked; first by
  number wins.
- **Claim**: set `status: claimed` and save **before any work** — concurrent sessions skip claimed
  tickets. Re-read frontmatter just before claiming; another session may have got there first.
- **Resolve**: append the answer under `## Answer`, set `status: done` (file + INDEX line), then
  append a context pointer (title-as-link + one-line gist) to the map's **Decisions so far**.
- **Assets**: research notes, prototypes, and other artifacts are *linked* from the ticket, never
  pasted in.
