# HITL — ticket 329 (a delivery's page lists its order's files under "Filed on order <no>")

Pre-flight: BackOffice 2061, 2062 and 2063 are `status: done` on pricing2. 2077 is `status: open` (expected, not a
blocker). 325–328, 330 and 331 have landed on spec324, and their HITL notes were read. 329 adds no endpoint, so there is
no contract to cross-check: the delivery read already carries `attachmentOwnerNo` (2063).

## Q: Only the number is a link. How does the sentence carry it?
**Decision taken:** the `document` bundle value is `"Filed on order <order>{{documentNo}}</order>"`, rendered with
react-i18next's `<Trans>` (already installed, no new dependency). `documentNo` is a named param and `<order>` is the link.
**Why:** the ticket says "the number links". Splitting the sentence into two keys would fix English word order, and
Arabic would read wrong. This is the first `<Trans>` in the repo.
**Revisit if:** the owner prefers the whole sentence as the link. That needs only a plain `t()` with the ticket's exact
value.

## Q: Where does the heading sit, and how does it reach the panel?
**Decision taken:** `AttachmentsPanelWords` gains an optional `heading?: ReactNode` (a type-only import). The panel draws
it first, above Add and the list, and draws nothing when it is absent (the slip drawer passes none). The order tab builds
it only when `filedOnOrder` names a number.
**Why:** the ticket says the heading goes through 326's words seam, so the panel stays unaware of orders. At the top it
also tells the user that Add files onto that order.
**Revisit if:** the owner wants it directly over the list, under Add.

## Q: What does `filedOnOrder` return, and what does it compare?
**Decision taken:** it returns the owner number (trimmed) or `null`. It compares the trimmed owner against the trimmed
**route** number, exactly as the ticket says. An absent, empty, blank or non-string owner gives `null`.
**Why:** the ticket's rule is "the owner number and the route number are compared trimmed".
**Revisit if:** an order is ever opened by a route number written differently from the server's own (for example
without leading zeros). The order's own page would then show the heading. `/code-review` raised this as speculative. The
fix would compare against the loaded document's `documentNo` instead.

## Q: Wording (waits on the owner's read)
**Decision taken:** `document:attachments.filedOnOrder` = "Filed on order <order>{{documentNo}}</order>" (it reads
"Filed on order 2000000551").
**Why:** these are the ticket's words.
**Revisit if:** the owner reads it differently. Arabic follows the same read.

## FINDING (not 329's): `document-actions-drive` still fails 3 checks
These are the same three as HITL-327/328/330/331 (7358a84, pre-wave). The other six document drives, the four slip
drives (unedited) and the order drive are green.

## Review outcome
- `/code-review`: no findings. It noted the route-number comparison edge case, logged above.
- `/standards-review`: no hard violations on either axis.
  - Applied: `filedOn` renamed to `filedOnOrderNo`.
  - Kept, as judgement calls:
    - the `ReactNode` in `AttachmentsPanelWords`, since the ticket names the words seam;
    - props passed field by field from the hook, the page's existing pattern;
    - the hand-built `/oms/document/` path, the third copy in the repo after `GridToolbar` and `requestHref`. A core
      route helper would be its own change.
  - Spec axis: the markup in the bundle value and the heading's place above Add are recorded above for the owner.
