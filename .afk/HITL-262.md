# HITL — ticket 262 (the API client learns to fetch a file)

## Q: Where does the `Content-Disposition` parser live?

**Decision taken:** a new pure module `src/core/util/content-disposition.ts`, exporting
`filenameFromDisposition(header)`, imported by `core/api.ts`.
**Why:** the ticket says only that it must be "a pure exported function, not an inline regex";
`core/util/` is where this repo already keeps pure helpers (`date-format`, `number-format`), and it
keeps the parser testable without stubbing `fetch`.
**Revisit if:** a reviewer expects it exported from `core/api.ts` itself — it is a one-line re-export
away.

## Q: The Proof says the graduated `download-file` tests "move unedited". There were none.

**Decision taken:** neither `features/admin/ua-admin/export.ts` nor
`features/collection/inquiry/export.ts` had any test covering `downloadCsv` — the DOM half was
deliberately parked outside the pure CSV writers that their suites do cover (`ua-admin/export.test.ts`
tests `collectAllRows`/`needsConfirm`/`estimateWalkSeconds` only). So no test could move. I wrote a
new `src/core/util/download-file.test.ts` at the new path instead, pinning the two things the move
could lose: the anchor is parked in the document before the click, and the object URL is revoked a
tick later rather than synchronously. The docblock in the test file says this explicitly.
**Why:** the intent of "tests move unedited" is that the graduation carries its regression net; with
no net to carry, writing one is the closest honest equivalent.
**Revisit if:** the ticket author meant tests that exist somewhere I did not find.

## Q: `attemptId` on the uncoded `server`/`unknown` arms of the error map?

**Decision taken:** carried through on every arm (`400`, coded refusal, `>=500`, `unknown`), read
from the envelope's top level when one was parsed.
**Why:** the field is SIS.Api's, not one screen's; a 500 that happened to journal an attempt should
still hand the user the handle they can quote. It is `null` when absent, so no existing caller sees a
change.
**Revisit if:** the contract ever says a code-less failure must not surface an attempt id.

## Q: `api.blob` on a 2xx whose body is a JSON envelope rather than bytes — guard, or trust the status?

**Decision taken:** kept a narrow guard. On a 2xx whose `Content-Type` says JSON, the envelope is
read and a `success:false` throws the ordinary business `ApiError` (through the same
`businessFromEnvelope` every other path uses); anything else on a 2xx is the bytes.
**Why:** `/code-review` raised it and it is the wave's own named failure mode — an envelope saved to
disk as "the PDF" fails silently, on exactly the path nobody looks at. The estate does answer some
business outcomes `200 success:false`, and `request<T>` has always mapped that. Keyed on the content
type, so it can never fire on an actual `application/pdf`.
**Revisit if:** a reviewer reads the ticket's *"On `res.ok`, `res.blob()`"* as forbidding any check on
the success arm — `/standards-review`'s spec axis called the guard scope creep. It is ~4 lines and
one test; deleting it is trivial. Its duplication objection was addressed either way: all three
business-refusal constructions now go through one `businessFromEnvelope`.

## Note — deferred to their own tickets

- `CONTEXT.md` does not carry *render rail*, *render attempt* or *attemptId*, which now appear in
  `core/`. A `/domain-modeling` pass, not 262's diff.

## Note — a PRE-EXISTING drive failure, not caused by this ticket

`tools/ua-users-scale-drive.mjs` fails 2 of its 85 checks:

- `FAIL  it is labelled Activation done`
- `FAIL  the grid is titled with its label`

Both assert the string "Activation done"; the app now renders **"Authenticator active"**
(`src/locales/en/ua-admin.json:21`), renamed by the earlier "name ticket" commit `8e5eca4`. The drive
was not updated with it. **The export leg of that drive is green** — the whole-estate walk still
writes one 6,002-line file through the graduated `downloadCsv`, which is the regression this ticket
could have caused. Left alone: fixing a stale drive assertion for another feature's rename is not
262's slice.

## Note — port 5199 was already occupied

`npx vite --port 5199` reported 5199 in use and bound **5200** instead; both drives were run with
`DRIVE_PORT=5200` and the server on 5200 was killed afterwards. Whatever holds 5199 was left running
by something outside this session and was not touched.
