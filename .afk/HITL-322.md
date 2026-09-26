# HITL — ticket 322 (finance adds a slip from the drawer)

Pre-flight: BackOffice 2034 and 2035 are both `status: done` on `pricing2` and both carry `## Web contract`.
Contract vs code (`AttachmentWebEndpoints.cs`, `AttachmentUploadHandler.cs`, `AttachmentFormFields.cs`,
`AttachmentUploadRequest.cs`, `AttachmentUploadResult.cs`, `AttachmentRefusal.cs`, `AttachmentMessages.cs` on
pricing2): the six part names, the codes and the statuses agree. One small drift: the code has a seventh refusal,
403 `CATEGORY_NOT_WRITABLE`, which the contract's list does not name. It is not retryable either way, and a test
pins it.

## Q: A bare 403, and any other non-JSON 2xx/4xx, get no Retry
**Decision taken:** `isRetryableUpload` is true for kind `network`, kind `server` (core's codeless 5xx, which is where a non-JSON gateway answer lands), and business `FILE_SERVER_UNREACHABLE`. Kind `unknown` is **not** retryable.
**Why:** a bare 403 with no body lands as `unknown` with no code. It is an auth refusal, and a retry would only be refused again. The wave forbids branching the retry on `statusCode`, and within kind and code a bare 403 cannot be told apart from a non-JSON 200 or 408. /code-review raised the cost: a proxy that answers 200 with an HTML body after the row was stored gets no Retry, and a re-pick mints a new id and could file the slip twice. Finance can withdraw a duplicate (323).
**Revisit if:** core's taxonomy starts separating "no envelope" from "no body" (a distinct kind or flag). Then the non-JSON 2xx/4xx could retry and a bare 403 still would not.

## Q: `crypto.randomUUID()` or `mintRequestId()`?
**Decision taken:** `mintRequestId()` from `@/core/util/request-id`. It returns `crypto.randomUUID()` wherever that exists, and a v4 UUID from `crypto.getRandomValues` otherwise.
**Why:** `randomUUID` is undefined outside a secure context. IIS serves this app over plain http on the internal network, so a raw call would throw there and no slip could be added. The drive asserts that the id is a v4 UUID.
**Revisit if:** the app is only ever served over https. The two calls are then the same.

## Q: Where do in-flight uploads live, so a close/reopen never mints a new id?
**Decision taken:** a module-scoped zustand store in the feature (`slip-upload-store.ts`, on `oms/deliveries/search-store`'s pattern), keyed by owner key. The send runs there, not in the component. Closing a drawer forgets that day's stored, finally-refused and browser-refused files. It keeps the ones still sending and the ones a retry can still help, with their ids. In memory only: a page reload starts fresh.
**Why:** the drawer already refuses dismissal while a file is sending (close disabled, Escape and backdrop ignored, and a native close re-opens it). The store is the belt-and-braces for a drawer that goes anyway (the probe stops admitting, the route changes). A retryable failure keeps its id, so a retry after a re-open is still the same capture. The drive proves it.
**Revisit if:** the owner wants a retryable failure forgotten on close too. Its row would then need a new pick, and so a new id.

## Q: Which grid query does a 200 invalidate?
**Decision taken:** both, `['collection','ready']` and `['collection','collections']`, with `refetchType: 'none'`. The two heads are now spelled once in `api.ts` (`READY_GRID_KEY`, `COLLECTIONS_GRID_KEY`), and both Pages build their keys from them.
**Why:** the same store day can sit in both caches, and both counts go stale. `refetchType: 'none'` marks them stale without reloading under the user. The drive asserts zero grid reads after a 200.
**Revisit if:** a grid gains a slip count keyed by something other than those two heads.

## Q: Wording of the client's own copy
**Decision taken:** new keys in `collection.json` under `slips.add`: "Add slip", the hint "JPG, PNG or PDF, up to 10 MB each.", the statuses (Not sent / Waiting… / Sending… / Stored / Refused), "Retry", the two browser refusals ("Not sent: only JPG, PNG or PDF files can be added." / "Not sent: the file is larger than 10 MB."), and the busy title on the disabled close button. Server messages are shown as sent, with `whitespace-pre-line` so the English and Arabic lines stay on separate lines.
**Why:** every client string goes through `t()`. The owner reads every new string in spec 2030 anyway.
**Revisit if:** the owner's read changes any of them.

## Q: What does a bare 403 on Upload say?
**Decision taken:** `apiErrorMessage` as it stands ("Unexpected API error (HTTP 403)"), with no Retry. There is no status branch to reword it.
**Why:** the wave names 323's Withdraw as the one place a status branch is correct. On Upload a grant refusal normally arrives coded (`CATEGORY_NOT_HELD`, bilingual). A bare 403 is only the cookie-marker filter.
**Revisit if:** the owner wants the drawer's "not allowed" sentence here too.
