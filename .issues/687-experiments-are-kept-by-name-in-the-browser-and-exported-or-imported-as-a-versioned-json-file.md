---
status: done
spec: BO 3243 (brief C:\Work\DMSCO\BackOffice\.issues\assets\3243-oms-react-rule-playground-brief.md; stories 49, 50)
blocked-by: 678
---

# 687 — Experiments are kept by name in the browser and exported or imported as a versioned `.json` file

## What to build

- **The experiment** (`kind`, `asOf`, the data as `data` or `raw`, the `document`, a name) gets one type and a
  **versioned codec**. Both live in **`core/insurance-rules/experiment.ts`**, because 688 ("Open in playground"
  from the guard and coverage features) must build one without importing this feature. **Decision (overrulable).**
- **Save / open / rename / delete by name** in browser storage. Every access is wrapped in try/catch, and the page
  works fully without storage (private window, blocked site data); the save controls then say storage is off.
- **Export** the current experiment as `<name>.json`. **Import** a `.json`: a file of an unknown or newer version, or
  one that does not decode, is refused in words and never half-loaded.

## Spine reach

store/logic (codec, storage wrapper) · component (save/open/import/export) · i18n · test

## Proof (→ `tdd` red-green cycles)

- [x] `experimentCodec` — encode → decode is identical for each kind and for raw; a missing version, an unknown
      version and malformed JSON are each refused with their own code — pure
- [x] `experimentStore` — save, list, rename and delete by name over a fake storage; a throwing storage leaves the
      page working and reports "off" — pure
- [x] drive: save, reload, open; export, then import the downloaded file — flow

## Boundaries

No door. The `.json` file format is versioned from v1.

## Done when

Experiments survive a reload by name and travel as `.json`, and the page works with storage off. Vitest and drive are
green.

## Blocked by

[678](678-the-outcome-refreshes-shortly-after-an-edit-a-stale-reply-is-dropped-and-kind-and-as-of-pick-what-runs.md)

## Comments

**2026-10-30 — built (impl/3243-687).** Vitest 14 codec + 9 store + i18n keys; drive
`tools/insurance-playground-experiments-drive.mjs` 60/60 (LTR + RTL, incl. storage off); 677/684/686 drives still green.

- **Core** `src/core/insurance-rules/experiment.ts`: `PlaygroundExperiment { name, kind, asOf, document, data? | raw? }`
  (exactly one of `data` object | `raw` string), `encodeExperiment` / `decodeExperiment` (text) / `readExperiment` (a
  parsed value), `experimentFile`, `experimentBody` (→ Evaluate body), `experimentFromBody(name, body)`,
  `experimentFileName`. File v1 = `{ format: "oms.insurance-playground.experiment", version: 1, name, kind, asOf,
  data|raw, document }`. Refusal codes: `malformed`, `notExperiment` (not an object / no or wrong `format`),
  `noVersion`, `unknownVersion` (not a positive integer), `newerVersion` (> 1), `invalid` (a v1 field does not hold:
  blank name, unknown kind, asOf not `yyyy-MM-ddTHH:mm:ss`, document not an object, both or neither of data/raw).
  🚩 Decision (overrulable): `format` marker required, and `newerVersion` is its own code (separate words).
- **688 / 689:** build a `PlaygroundExperiment` (asOf via `localAsOf(new Date())`) and use `experimentFile` /
  `readExperiment` for any hand-off value; the page loads one through `loadExperiment(e)` in `PlaygroundPage`
  (sets kind, asOf, the rule box and Data tab json|raw at once). 688's router-state reader can call that.
- **Store** (feature) `experiment-store.ts`: `localStorage` key `oms.insurance-playground.experiments.v1`, value
  `{ version: 1, experiments: [<file v1>] }`; names unique trimmed + case-insensitive, saving a taken name replaces it;
  a bad entry is skipped. Every access try/catch; `isOn()` probes a write. Not per-user (unlike Deliveries saved views):
  no user id is in reach and the brief does not ask; overrulable.
- **UI** `ExperimentBar.tsx` above the kind/as-of row: name box, Save, saved list + Open / Rename (picked → name in the
  box) / Delete, Export `.json`, Import `.json` (hidden file input, not counted by the ratchet). Saved and exported is
  what the page would SEND (`built.body`), so an experiment whose JSON does not parse cannot be saved or exported
  (said in words). An import is loaded, not auto-saved. Lede reworded: "nothing is published or saved to HQ".
- 682 (Form tab): if it adds a `DataTab`, `loadExperiment` maps `data` to `json`; switch it to `form` if preferred.
