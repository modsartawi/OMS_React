# Loyalty member writes are gated per command, not per screen

Every one of the portal's fourteen screen gates authorises **opening a screen** — one grant, the
Display command, and read-implies-everything behind it. The loyalty member screen is the first to
carry writes, and it does **not** follow that shape: it keeps the existing screen grant for opening
and reading, adds a second grant for editing, and a third for removing a member's mobile. Three
tiers on one controller — may look, may edit, may make unreachable.

The alternative was a second controller (a "LoyAdmin" screen grant) alongside the existing one. It
was rejected because it cannot express the tiers: nothing would stop a session holding the admin
controller without the lookup controller, producing an editor who cannot open the screen — and both
would have to be held together to do the job, which is a matrix, not a permission. The audience is
the same desk in both cases; only the rope differs, and that is a command distinction.

## Consequences

- **The estate's first write-gated web door.** The route filter must take the required command as a
  parameter rather than assuming Display. Every subsequent write screen inherits that.
- **Removing an email is deliberately *not* covered by the removal grant.** An editor can clear the
  Email field through the ordinary profile command anyway, so claiming otherwise would be an
  authority that looks enforced and isn't. The removal grant guards the mobile, and the mobile only.
  It is therefore best read as *"may destroy a login"*, not *"may remove contact details"*.
- **Splitting later would be a migration, merging later is a re-bind.** Grants are seeded rows and
  roles are bound to named people; starting with one grant and separating it afterwards means
  revisiting every binding. Starting split and collapsing later costs nothing. That asymmetry is why
  the split is here on day one rather than when someone first regrets its absence.
