# HITL — ticket 497 (Pick support: a shape's one fix)

## Q: After `PICK-00224`, can Confirm be pressed again?
**Decision taken:** No. Confirm is disabled and the dialog offers "Refresh diagnosis" instead. Refresh re-reads Pick support and closes the dialog. A bare 403 also disables Confirm. `PICK-00225`, `PICK-00003`, `PICK-00002` and a network failure leave Confirm available, with the input kept.
**Why:** Rule 3. The shape no longer holds, so a second press is refused `PICK-00224` again, and the brief offers Refresh for exactly this case.
**Revisit if:** The owner wants Refresh to keep the dialog open, re-drawn against the new diagnosis.

## Q: Are the reason and the reference trimmed on the client before sending?
**Decision taken:** Yes. The body is `{ shape, reason: trimmed, complaintRef: trimmed }` and nothing else.
**Why:** The server trims both anyway (brief), and the Confirm gate already judges the trimmed values, so the body says what the gate checked.
**Revisit if:** The server ever needs the untrimmed text, which is unlikely.

## Q: When are the other Pick support reads (Resolve, the census) refreshed after a fix?
**Decision taken:** When the dialog closes. The delivery's own read takes `diagnosis` at once, or is re-GET when it is `null`.
**Why:** /code-review found that re-reading the lookup under the open dialog can unmount it. A serial whose STUCK hold the fix released stops naming the delivery, and the store's instructions vanish before they are copied.
**Revisit if:** 498's census should show the change while the dialog is still open.

## Q: What does the success state say, besides the store's text?
**Decision taken:** One UI line, "The fix was applied.", then "Tell the store" with EN beside AR, each with its own copy button ("Copy English" / "Copy Arabic"). A language that came back blank gets no copy button.
**Why:** The words about the fix are the server's. The client only states the outcome of its own request, which is UI wording.
**Revisit if:** The owner wants no status line at all.

## Q: A 200 from Fix with no `data`.
**Decision taken:** It is read as a fix that stood, with empty store text and a re-GET of the delivery. It is never a resendable failure.
**Why:** The brief never describes it. Treating a 200 as a failure would invite a second press that `PICK-00224` refuses.
**Revisit if:** The server documents a different meaning.

## Q: What is the refusal banner's title?
**Decision taken:** "The fix was not confirmed", with the code beside the server's sentence under it.
**Why:** It stays true for a coded refusal and for a network failure, where the client cannot know whether the server acted.
**Revisit if:** Support prefers "refused".

## Contract gap
None. `PickSupportFixRequest` and `PickSupportFixResult` (from 496) match the brief's JSON.
