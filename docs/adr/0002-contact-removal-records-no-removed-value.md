# A contact removal records the request, never the removed value

> ⚠ **SUPERSEDED IN PART — 2026-08-30, owner ruling.** This decision **no longer holds for the
> MOBILE removal**, which now records the number it removed in the action trail's second free-form
> slot — the *"Old Value"* column the OMS Actions tab draws, and the slot the change-mobile command
> and the collision path already use for a number they displaced. The reason given: a removal that
> alone left that slot blank made the heaviest act on the member door the only one whose trail row
> could not say **which** number a member lost.
>
> **It still holds for the EMAIL removal**, which records the case reference alone, and the
> undrawn third slot still carries nothing on either command. The consequences below stand as
> written except where they turn on the mobile's absence — in particular, *"undo is not
> self-service"* is unchanged: recording the number is not a reversal, because reattaching a mobile
> must still re-run the collision check.
>
> Server-side amendment: BackOffice `.issues/1403-removing-a-mobile-blocks-under-a-system-reason.md`
> (*Amendment*) and spec `.issues/1397-loyalty-member-admin-writes-spec.md`.

Every other member command records what it displaced: changing a mobile writes the new number and
the old one side by side onto the member's action trail. **Contact removal deliberately does not.**
It records the loyalty id, who ran it, when, and the customer's case reference — and nowhere does it
write the mobile or email it cleared.

This looks like an omission and is not. The action trail is drawn on screen for anyone holding the
read grant, so recording the old mobile there would render the removed contact details, in plain
text, to every analyst, forever — defeating the only thing the command exists to do. Masking them at
the grid was considered and rejected: a client-side rule protecting server-side data survives
exactly until the next export, grid or API consumer, and a mask is a promise the architecture
doesn't keep.

## Consequences

- **Undo is not self-service.** The previous values do survive — in the member update snapshot
  written by the *preceding* command, a trail exposed on no screen — so a reversal is a support task
  against the database, not a button. This suits the act: reattaching a mobile has to re-run the
  collision check anyway, because someone else may hold that number by now.
- **The case reference is the whole "why".** It is the only thing distinguishing an accountable
  removal from an anonymous one, which is why it is required rather than optional, and why it must
  stay non-PII — an agent typing a phone number into it puts that number on the very screen this
  decision keeps it off.
- **Removal counts undercount.** A member's email can also go blank through an ordinary profile
  edit, which records as a profile update like any other. Anything counting removal requests reads
  the removal command's own trail and must accept that it is a floor, not a total.
