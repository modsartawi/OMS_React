---
status: open
spec: BackOffice 3185 (brief C:\Work\DMSCO\BackOffice\.issues\assets\3157-oms-react-idf-brief.md, section "Spec 3185")
blocked-by: —
---

# 652 — The IDF groups leaf lists, adds, edits, exports, and removes only empty groups

## What to build

The IDF groups are kept only in the WPF. A new **IDF groups** leaf in the Insurance rules group
(`/insurance-rules/idf/groups`), doors BackOffice 3196
([brief](C:\Work\DMSCO\BackOffice\.issues\assets\3157-oms-react-idf-brief.md), "Spec 3185"):

- a paged list: group number, description, dosage form, item count; search by number or description;
- **Add** (number, description, dosage form) and **Edit** (description, dosage form; the number is fixed). Number
  required, at most 26 characters; description required;
- **Remove** only when the item count is 0; a refusal shows its message and the count;
- **Export** to `.xlsx`;
- help text: the WPF IDF Import screen still writes groups, unchecked.

## Spine reach

model/api · logic (form validity) · route + menu + component · i18n (EN+AR) · test + drive

## Proof (→ `tdd` red-green cycles)

- [ ] `group form: number required and ≤ 26, description required, number fixed on edit` · pure
- [ ] drive `tools/idf-groups-drive.mjs` — search, add, edit, a refused remove of a group with items, remove of an empty
  group, export (LTR + RTL) · flow

## Boundaries

Endpoints stubbed. Writes need the general-edit grant once 654 adds the probe. Group numbers are machine values
(`Ltr`); descriptions free text (`<bdi>`).

## Done when

Against stubs, groups are listed, added, edited, exported, and removed only when empty, proofs green.

## Blocked by

None (can start immediately).
