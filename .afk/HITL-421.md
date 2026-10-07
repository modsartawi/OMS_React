# HITL — ticket 421 (upload drops activate, explains columns 23–24)

## Q: Does a locked-serial refusal need its own number/status fields on the wire?
**Decision taken:** No. The refusal keeps 418's shipped shape (`row, serial, code, english, arabic`; row 0 = whole file). The number and status are expected in the server's EN + AR text, and they render through the existing refused-row table. The drive stubs and the vitest use an illustrative code `BBY-UPLOAD-LOCKED`, and the client never branches on it.
**Why:** The wave ruling says the refusal shape is unchanged. Spec 2396 asks to "list serial, number and status" and does not name new fields.
**Revisit if:** BackOffice 2398 ships structured `bbyNumber`/`bbyStatus` on `BbyUploadRefusal`. If so, add them to `src/core/models/bonus-buy-upload.ts` and to `MessageTable`.

## Q: Which row does a locked-serial refusal carry: the serial's first row, or row 0?
**Decision taken:** The client takes whatever row the server sends. The drive stubs one row-0 whole-file line plus one per-serial line (row 14) to show both paths.
**Why:** Spec 2396 and BackOffice 2398 say the file is "refused whole" and lists each serial, but they do not fix the row.
**Revisit if:** Not a client question. Rendering works either way.

## Q: Help copy beyond the ticket's columns-23/24 sentence
**Decision taken:** Added `upload.landsPlanned`: "Uploaded bonus buys always land Planned. A file that reaches a bonus buy which is not Planned is refused whole." Also reworded `upload.hint` from "SAP's 22-column … file" to "SAP's … file (22 columns)" so it no longer contradicts the 23/24 note.
**Why:** With the activate option gone, the dialog should say where uploads land (spec stories 1, 15 and 24). The spec reviewer flagged this as harmless extra copy.
**Revisit if:** The owner wants the dialog shorter. If so, drop `upload.landsPlanned` and drive step 35's last check.

## Q: Ship order
**Decision taken:** Built now, against the stub. The ticket says to ship with or after BackOffice 2398. Until then, the older door would simply ignore the missing `activate` part (it defaulted to false), so this client is safe on both sides of 2398.
**Why:** Removing a part is backward-compatible with the shipped door, and the reverse (an old client on a new door) is what 2398's `400` guards.
**Revisit if:** Never, on today's door. Confirmed by reading `BbyMaintainWebEndpoints.Upload`: it binds `[FromForm] bool? activate` and uses `activate ?? false`, so a missing part reads as false.

## Outstanding (not AFK-able)
- Owner walk: upload a 24-column file and see Planned bonus buys carrying its Score and tiers. This needs a dev SIS.Api with BackOffice 2398 and 2399, both OPEN.
