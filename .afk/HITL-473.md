# HITL — ticket 473 (spec 470, receipt replay: warnings and refusal words)

## Q: Where does a refused push show, and does the confirm stay open?
**Decision taken:** in the result area (where the result panel renders), and the confirm closes on any failure (refusal, unknown code, 500). Editing the JSON, committing another store, picking a register or opening the confirm again retires it.
**Why:** the ticket says the push refusals "show in the result area on push"; HITL-472 anticipated the move.
**Revisit if:** testers want to retry a transient STORE_UNREACHABLE / 500 straight from the still-open confirm.

## Q: Does a worded replay refusal still show its raw code?
**Decision taken:** no. A replay code reads in its own words alone (the code stays on `data-replay-error-code`). An unknown code keeps 468's fallback: the shared `failures.*` words or the server message, with the code beside.
**Why:** the ticket asks for "plain words"; 468's `NOT_FOUND` did the same.
**Revisit if:** testers need the code to quote when reporting a problem.

## Q: What does a codeless 500 read as?
**Decision taken:** "The receipt could not be replayed." over core's server sentence (`apiErrorMessage`), no code. Under the store field the registers door's 500 does the same with "The store's registers could not be read.".
**Why:** that is the console's shared failure, as 468's drawer shows it.
**Revisit if:** —

## Q: Which warnings does a paste get when several apply?
**Decision taken:** every one, in the order return, void, training, notCompleted, unbalanced. A voided paste warns `void` and never also `notCompleted`. A voided return warns `return` and `void` (the /code-review found it read "not completed" otherwise).
**Why:** each says what to fix; repeating "not completed" for a void adds nothing.
**Revisit if:** —

## Q: After a push refused for the store or its register, does the page re-read the registers?
**Decision taken:** yes. For NO_STORE, NOT_NEWPOS_STORE, STORE_UNREACHABLE and NO_REGISTER (`rereadsRegisters`) the target store's registers query is invalidated. A refused store then shows its refusal under the store field too, and a register the store no longer has leaves the picker. The registers query has `staleTime: Infinity`, and without the re-read the target section kept offering a target the door had just refused (/code-review finding).
**Why:** it keeps the target section in step with the door. The cost is a store refusal that can show twice, once under the field and once in the result area.
**Revisit if:** the double display bothers testers.

## Q: Review findings not acted on
- **A paste with no lines and a zero total passes the preflight.** The runner's ruled checks (kind, completed, training, balance) do not include a line count, and the door still checks (BAD_SNAPSHOT). Not invented here.
- **The summary's Completed, Training and Balanced Yes/No facts repeat what the warnings say.** The summary is 472's, and the warnings add the words.
- **`refusal.TRAINING` and `refusal.NOT_COMPLETED` say the same as `warn.training` and `warn.notCompleted`.** They stay separate keys on purpose: one is the client's warning, the other the server's refusal.
- **The push refusal reuses `replay.confirm.failed` outside the confirm.** The words are right, and only the key's path is off. Not renamed, to keep the diff small.

## Contract gap
- None new. Every code in spec 470's contract has words, and nothing outside the contract is read.
