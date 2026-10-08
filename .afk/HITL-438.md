# HITL log — ticket 438 (Document source users)

## Q: Copy geography's ImportDialog into the new feature, or graduate it to core?
**Decision taken:** graduated to `@/core/import/ImportDialog.tsx` (plus `preview-columns.ts`). It takes the namespace as a prop (the `ScreenGate` precedent), and geography now uses it too.
**Why:** features may not import features, a ~300-line copy is the duplication the rule sends up to core, D14 calls it "one shared shape", and 437's HITL named 438 as the trigger. The geography drive still passes 122/122 after the move.
**Revisit if:** a third import wants different copy than "lines / add or update / delete".

## Q: Where does the dialog's copy live?
**Decision taken:** each importing feature carries the full `import.*` block, in en and ar. `document-source-users` copies geography's wording, with its own title, format and "the list was reloaded" line. It also keeps the `unknownCity` reason so the core dialog's `t()` is total.
**Why:** `common` has no Arabic file. Moving the frame copy there would need a new `ar/common.json` (a wider change than this slice); per-feature copy keeps every string translated.
**Revisit if:** a third importer appears. Then move the frame copy (file, paste, summary, send, result, preview, action, problem) to a core-owned namespace with an Arabic file.

## Q: Row identity in the grid — user ID alone, or user + source?
**Decision taken:** user ID alone.
**Why:** WPF's NHibernate map keys `SdDocumentSourceUser` on `UserId` (`Id(x => x.UserId)`), so a user has one source.
**Revisit if:** BO-6 returns a user under two sources (the grid would then show only one of them).

## Q: The X column — WPF only honoured `"X"`, and ignored anything after the third column.
**Decision taken:** the core parser's D14 rule: `X`/`x` deletes, and any other extra column is an error that blocks Send.
**Why:** D14 verbatim; shared with geography.
**Revisit if:** users' files carry trailing junk columns WPF used to ignore.

## Q: Wording for an X line on this screen — "delete" or "unpin"?
**Decision taken:** the shared "Add or update" / "Delete" in the preview; the format line says "X to delete that user's pin".
**Why:** this is the same dialog shape as geography, and "pin" is the CONTEXT term for the row.
**Revisit if:** the owner prefers pin/unpin verbs on this screen.

## Note: no new access flag
`canOpenDocumentSourceUsers` and `canImportDocumentSourceUsers` are 431's flags. This slice added only the pure `canOpenDocumentSourceUsers` predicate in `@/core/oms/access`, beside its siblings.

## Note: drive port
Port 5199 was held by a server this session did not start; it was left alone. The drives ran against this session's own vite on 5241 (`DRIVE_PORT=5241`), stopped afterwards.
