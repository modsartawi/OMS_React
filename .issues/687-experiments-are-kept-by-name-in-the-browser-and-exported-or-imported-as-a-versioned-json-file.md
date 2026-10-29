---
status: open
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

- [ ] `experimentCodec` — encode → decode is identical for each kind and for raw; a missing version, an unknown
      version and malformed JSON are each refused with their own code — pure
- [ ] `experimentStore` — save, list, rename and delete by name over a fake storage; a throwing storage leaves the
      page working and reports "off" — pure
- [ ] drive: save, reload, open; export, then import the downloaded file — flow

## Boundaries

No door. The `.json` file format is versioned from v1.

## Done when

Experiments survive a reload by name and travel as `.json`, and the page works with storage off. Vitest and drive are
green.

## Blocked by

[678](678-the-outcome-refreshes-shortly-after-an-edit-a-stale-reply-is-dropped-and-kind-and-as-of-pick-what-runs.md)
