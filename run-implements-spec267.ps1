# Runs /implement + /standards-review for the spec 267 settlement-account tickets
# ("the accountant's screen") in fresh Claude Code sessions, sequentially, fully AFK.
#
#   .\run-implements-spec267.ps1                  (268, 269, 270, 271, 272, 273)
#   .\run-implements-spec267.ps1 -Tickets 271,272
#   .\run-implements-spec267.ps1 -DryRun          (pre-flight + plan only, starts nothing)
#   .\run-implements-spec267.ps1 -SkipReview      (implement rounds only)
#   .\run-implements-spec267.ps1 -SmokeTest       (one trivial session through the real harness)
#
# ASCII only, on purpose: Windows PowerShell 5.1 reads a BOM-less .ps1 as ANSI, so a stray
# em dash silently becomes mojibake and can break the parse. Keep every character 7-bit.
#
# ---------------------------------------------------------------------------------------
# THIS RUNNER LIVES IN A GIT WORKTREE
#
#   C:\Playground\oms-react-267   branch spec/267-settlement   <- you are here
#   C:\Playground\oms-react       branch served-by-1163        <- a DIFFERENT, BUSY checkout
#
# Both are checkouts of the same repository and share one object store. This runner and every
# session it starts must stay inside this directory. Never `cd` to the other tree, never edit
# it, and never `git checkout` a branch that is checked out over there - git refuses, and the
# refusal at 3am reads as a mysterious failure. Drives here bind port 5201, not 5199, so a
# server left running in the other tree cannot collide.
#
# ---------------------------------------------------------------------------------------
# WHY THIS RUNNER CANNOT WEDGE
#
# Piping `claude ... | ForEach-Object` straight into the console has three ways to look
# "stuck" forever. This runner closes all of them:
#
#  1. The child never inherits your console. It is launched with Start-Process, stdout and
#     stderr redirected to FILES, and stdin redirected from an EMPTY FILE - so it reads EOF
#     instantly and can never block waiting for input, and it can never emit an escape
#     sequence that clears or repaints your terminal. This script does all the printing,
#     from the parsed stream.
#  2. A STALL WATCHDOG. If no new stream line arrives for -StallMinutes (default 25), the
#     whole process TREE is killed with taskkill /T /F and the loop stops with a named
#     verdict. A hard per-session ceiling of -MaxHours (default 5) does the same.
#  3. A HEARTBEAT. Every 60 seconds of silence prints one line naming the tool still
#     running and how long it has been quiet, so the terminal is never blank-and-ambiguous.
#     A long quiet stretch under a "-> Bash npm run build" line is a build, not a hang.
#
# Also deliberate: no `2>&1` on a native exe (in PS 5.1 that wraps stderr in ErrorRecords
# and sets $? false on a clean exit 0), and the giant AFK system prompt travels as a FILE,
# never as a quoted command-line argument.
#
# ---------------------------------------------------------------------------------------
# WHAT EACH ROUND DOES
#
#   round A   claude -p "/implement <t>"                 -> commits the slice
#   round B   claude -p "/standards-review since <sha>"  -> read-only, writes
#             .afk\REVIEW-<t>.md and prints its verdict in this terminal
#
# <sha> is HEAD as it stood BEFORE round A, so the review sees exactly that ticket's diff.
# Round B never edits or commits; a failure there WARNS and the loop continues (the report
# is morning triage, not a gate). Round A failing stops the loop immediately.
#
# ---------------------------------------------------------------------------------------
# Dependency map (267 spec; nothing landed yet; 274 deliberately NOT in this run):
#
#   268 --> 269 --+-- 270
#                 +-- 271 --+
#                 +-- 272 --+-- 273
#
#   274 (the live-door joining ticket) is EXCLUDED - it says so itself, it needs a live
#   SIS.Api plus a seeded grant, and its backend (BackOffice migration 081) is not built.
#
# Running order:
#   * Exactly topological: 268 -> 269 -> 270 -> 271 -> 272 -> 273.
#   * 268 runs first because it is the shared surface - the folder, the i18n namespace, the
#     route, the menu entry and the gate that all five later slices extend. Two sessions each
#     inventing that surface differently is the failure this ordering exists to prevent.
#   * 269 runs BEFORE the door (270) on the spec's own instruction: the door's whole job is to
#     reach the account, and a door onto nothing cannot be judged.
#   * 273 runs LAST, and it needs BOTH 271 and 272 even though its frontmatter names only 271:
#     its "cancel as a unit" is explicitly "a loop over 272's mechanism, not a new one". If you
#     re-order with -Tickets, keep 273 after both.
#   * No slice here is backend-blocked. Every one of the six builds against fixtures and stubs,
#     exactly as 262-265 did; the live joining event is 274 and it is out of this run.
#
# Preconditions (the script checks 1, 2 and 4 - you own 3 and 5):
#   1. Nothing outside this wave blocks it. 274 is excluded from the run, not a blocker for it.
#   2. No TRACKED modifications in the tree (untracked files are fine and only warn).
#   3. YOU ARE ON THE RIGHT BRANCH. This runner never switches branches - it commits onto
#      whatever is checked out now. Waves here are often built on a feature branch rather
#      than main, and the tickets themselves may only exist on that branch.
#      Expected for this wave: spec/267-settlement
#   4. node_modules is installed (npm ci / npm install) - checked, because a missing install
#      turns every slice's typecheck into a wall of phantom errors at 3am.
#   5. A live SIS.Api on :5111 is NOT required and NOT wanted - all six slices build against
#      fixtures and stub the network at Playwright. The design is already owner-ruled from the
#      1147 spike (owner clicked through it on 2026-08-13); the loop follows the spec and does
#      not re-decide layout. You own: keeping the other worktree out of this one, and reading
#      .afk\HITL-*.md in the morning.
param(
    [int[]]$Tickets = @(268,269,270,271,272,273),
    [string]$Model = "opus",
    # No stream output for this long => the session is wedged; kill the tree and stop.
    [int]$StallMinutes = 25,
    # Absolute ceiling for one session, however chatty it is.
    [int]$MaxHours = 5,
    [switch]$SkipReview,
    [switch]$DryRun,
    # Drive ONE trivial session through the exact same harness (start, stream, parse, exit) and
    # report. Run this once before you go to bed: it proves the plumbing without touching a ticket.
    [switch]$SmokeTest
)

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

# Tickets that must ALREADY be 'status: done' before this wave may start. Empty is fine.
$BlockingTickets = @()

$script:runStart = Get-Date
function Stamp {
    $s = [int]((Get-Date) - $script:runStart).TotalSeconds
    return "[{0:d2}:{1:d2}]" -f [int]($s / 60), ($s % 60)
}
function Say([string]$text, [string]$color = "Gray") {
    Write-Host ("{0} {1}" -f (Stamp), $text) -ForegroundColor $color
}

if (-not (Test-Path ".afk")) { New-Item -ItemType Directory ".afk" | Out-Null }
$afkDir = (Resolve-Path ".afk").Path

# --- pre-flight ------------------------------------------------------------------------
# -SmokeTest touches nothing in the tree, so it skips every gate below on purpose: you must be
# able to prove the plumbing while a previous session is still finishing.
if (-not $SmokeTest) {

if (-not (Test-Path "node_modules")) {
    Say "node_modules is missing - run 'npm ci' first. Without it every slice's typecheck fails for the wrong reason." "Red"
    exit 1
}

$branch = (git rev-parse --abbrev-ref HEAD).Trim()
Say "Branch: $branch   (expected for this wave: spec/267-settlement)" "DarkGray"

foreach ($b in $BlockingTickets) {
    $bf = Get-ChildItem ".issues\$b-*.md" -ErrorAction SilentlyContinue | Select-Object -First 1
    if (-not $bf) { Say "Blocking ticket $b : no .issues\$b-*.md found." "Red"; exit 1 }
    $bh = (Get-Content $bf.FullName -TotalCount 8) -join "`n"
    if ($bh -notmatch '(?m)^status:\s*done') {
        Say "Ticket $b is not 'status: done'. It blocks this wave - let it finish and commit before starting the loop." "Red"
        exit 1
    }
}

# Tracked modifications only: an untracked scratch file must not stop a midnight run, but a
# half-finished tracked edit would land inside the first ticket's commit and its review.
$dirtyTracked = git status --porcelain --untracked-files=no
if ($dirtyTracked) {
    Say "Working tree has TRACKED modifications - commit or stash them first, or ticket 1's diff and review will include them:" "Red"
    $dirtyTracked | Write-Host
    exit 1
}
$untracked = git status --porcelain --untracked-files=normal | Where-Object { $_ -like '?? *' }
if ($untracked) {
    Say "Untracked files present (allowed, but a session could sweep them into a commit - the AFK prompt tells it to stage narrowly):" "DarkYellow"
    $untracked | Write-Host
}

foreach ($t in $Tickets) {
    $file = Get-ChildItem ".issues\$t-*.md" -ErrorAction SilentlyContinue | Select-Object -First 1
    if (-not $file) { Say "Ticket $t : no .issues\$t-*.md found (wrong branch? the tickets may live on a feature branch)." "Red"; exit 1 }
    $head = (Get-Content $file.FullName -TotalCount 8) -join "`n"
    if ($head -notmatch '(?m)^status:\s*open') {
        $st = ""
        if ($head -match '(?m)^status:\s*(\S+)') { $st = $Matches[1] }
        Say "Ticket $t : status is '$st', expected 'open'. Drop it from -Tickets or reopen it." "Red"
        exit 1
    }
}

Say ("Plan: " + ($Tickets -join " -> ") + "   model=$Model  stall-watchdog=${StallMinutes}m  ceiling=${MaxHours}h  review=" + (-not $SkipReview)) "Cyan"

}   # end pre-flight (skipped for -SmokeTest)

# --- the child runner --------------------------------------------------------------------
# A tiny script that Start-Process launches under powershell.exe. It exists so the enormous
# system prompt travels as a FILE and `claude` is invoked NATIVELY (PowerShell then does the
# argument quoting correctly), while we still get a PassThru process object to watch and kill.
$runnerPath = Join-Path $afkDir "_afk-run-claude.ps1"
@'
param(
    [string]$Prompt,
    [string]$SysPromptFile,
    [string]$Model,
    [string]$WorkDir
)
Set-Location $WorkDir
$sys = Get-Content $SysPromptFile -Raw
claude -p $Prompt --model $Model --output-format stream-json --verbose --dangerously-skip-permissions --append-system-prompt $sys
exit $LASTEXITCODE
'@ | Out-File $runnerPath -Encoding utf8

$emptyStdin = Join-Path $afkDir "_empty-stdin.txt"
Set-Content -Path $emptyStdin -Value "" -Encoding ascii

function Invoke-ClaudeSession {
    param(
        [string]$Prompt,
        [string]$SysPrompt,
        [string]$Tag,
        [int]$StallMinutes,
        [int]$MaxMinutes
    )

    $jsonl   = Join-Path $afkDir "session-$Tag.jsonl"
    $errPath = Join-Path $afkDir "session-$Tag.err.log"
    $sysPath = Join-Path $afkDir "session-$Tag.sys.txt"
    foreach ($p in @($jsonl, $errPath)) { if (Test-Path $p) { Remove-Item $p -Force } }
    $SysPrompt | Out-File $sysPath -Encoding utf8

    # Start-Process does NOT quote ArgumentList members for you - quote them here. Every value
    # below is a path or a short literal with no embedded quote, so this is safe.
    # NOT $args - that is an automatic variable, and writing to it inside a function is a trap.
    $psArgs = @(
        "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", "`"$runnerPath`"",
        "-Prompt", "`"$Prompt`"",
        "-SysPromptFile", "`"$sysPath`"",
        "-Model", "`"$Model`"",
        "-WorkDir", "`"$PSScriptRoot`""
    )

    $proc = Start-Process -FilePath "powershell.exe" -ArgumentList $psArgs `
        -RedirectStandardOutput $jsonl -RedirectStandardError $errPath `
        -RedirectStandardInput $emptyStdin -NoNewWindow -PassThru

    $fs = New-Object System.IO.FileStream($jsonl, [System.IO.FileMode]::OpenOrCreate, [System.IO.FileAccess]::Read, [System.IO.FileShare]::ReadWrite)
    $sr = New-Object System.IO.StreamReader($fs)

    $buffer     = ""
    $started    = Get-Date
    $lastData   = Get-Date
    $lastBeat   = Get-Date
    $lastTool   = "(session starting)"
    $result     = [pscustomobject]@{
        SawResult = $false; ResultText = ""; IsError = $false; Subtype = "";
        ExitCode = -1; Stalled = $false; TimedOut = $false; Jsonl = $jsonl; Err = $errPath
    }
    $drainedAfterExit = $false

    try {
        while ($true) {
            $chunk = $sr.ReadToEnd()
            if ($chunk) {
                $lastData = Get-Date
                $lastBeat = Get-Date
                $buffer += $chunk
                $parts = $buffer -split "`n"
                $buffer = $parts[$parts.Count - 1]      # keep the (possibly partial) tail
                for ($i = 0; $i -lt $parts.Count - 1; $i++) {
                    $line = $parts[$i].TrimEnd("`r")
                    if (-not $line.Trim()) { continue }

                    $evt = $null
                    try { $evt = $line | ConvertFrom-Json } catch { }
                    if ($null -eq $evt) {
                        $raw = $line.Substring(0, [Math]::Min(200, $line.Length))
                        Say ("  | " + $raw) "DarkGray"
                        continue
                    }

                    switch ($evt.type) {
                        "system" {
                            if ($evt.subtype -eq "init") { Say ("session " + $evt.session_id) "DarkGray" }
                        }
                        "rate_limit_event" {
                            if ($evt.rate_limit_info.status -ne "allowed") {
                                Say ("RATE LIMIT: " + $evt.rate_limit_info.status + " - waiting it out, not a hang") "Yellow"
                                $lastData = Get-Date   # a rate-limit wait must not trip the watchdog
                            }
                        }
                        "assistant" {
                            foreach ($block in $evt.message.content) {
                                if ($block.type -eq "text" -and $block.text -and $block.text.Trim()) {
                                    $txt = ($block.text -split "`n" | Where-Object { $_.Trim() } | Select-Object -First 1)
                                    if ($txt.Length -gt 150) { $txt = $txt.Substring(0, 150) + "..." }
                                    Say ("  . " + $txt) "White"
                                }
                                elseif ($block.type -eq "tool_use") {
                                    $hint = ""
                                    foreach ($key in @("description", "command", "file_path", "pattern", "prompt", "skill")) {
                                        $val = $block.input.$key
                                        if ($val) {
                                            $hint = ($val.ToString() -split "`n")[0]
                                            if ($hint.Length -gt 90) { $hint = $hint.Substring(0, 90) + "..." }
                                            break
                                        }
                                    }
                                    $lastTool = $block.name + " " + $hint
                                    Say ("  -> " + $lastTool) "DarkCyan"
                                }
                            }
                        }
                        "user" {
                            foreach ($block in $evt.message.content) {
                                if ($block.type -eq "tool_result" -and $block.is_error) {
                                    Say "     ! tool returned an error" "DarkYellow"
                                }
                            }
                        }
                        "result" {
                            $result.SawResult  = $true
                            $result.ResultText = [string]$evt.result
                            $result.IsError    = [bool]$evt.is_error
                            $result.Subtype    = [string]$evt.subtype
                            $mins = [math]::Round($evt.duration_ms / 60000, 1)
                            $cost = "{0:N2}" -f $evt.total_cost_usd
                            Say ("=== session ended: " + $evt.subtype + ", " + $mins + " min, " + $evt.num_turns + " turns, USD " + $cost + " ===") "Cyan"
                        }
                    }
                }
                continue    # more may be waiting; drain before sleeping
            }

            if ($proc.HasExited) {
                if ($drainedAfterExit) { break }
                Start-Sleep -Milliseconds 400     # let the last buffered write land
                $drainedAfterExit = $true
                continue
            }

            $silent = (Get-Date) - $lastData
            if ($silent.TotalMinutes -ge $StallMinutes) {
                Say ("=== NO OUTPUT for " + [int]$silent.TotalMinutes + " min (last: " + $lastTool + ") - killing the process tree ===") "Red"
                try { & taskkill /T /F /PID $proc.Id | Out-Null } catch { }
                $result.Stalled = $true
                break
            }
            if (((Get-Date) - $started).TotalMinutes -ge $MaxMinutes) {
                Say ("=== session passed the " + $MaxMinutes + "-minute ceiling - killing the process tree ===") "Red"
                try { & taskkill /T /F /PID $proc.Id | Out-Null } catch { }
                $result.TimedOut = $true
                break
            }
            if (((Get-Date) - $lastBeat).TotalSeconds -ge 60) {
                $lastBeat = Get-Date
                Say ("  ... alive, quiet " + [int]$silent.TotalMinutes + "m" + ($silent.Seconds) + "s; still on: " + $lastTool) "DarkGray"
            }

            Start-Sleep -Milliseconds 500
        }
    }
    finally {
        $sr.Close(); $fs.Close()
    }

    # ALWAYS WaitForExit + Refresh before reading ExitCode. A -PassThru process object hands back
    # a NULL ExitCode if you only ever asked HasExited - which reads as "not 0" and fails a round
    # that actually succeeded (caught by -SmokeTest).
    try { $proc.WaitForExit(10000) | Out-Null } catch { }
    try { $proc.Refresh() } catch { }
    $code = $null
    try { if ($proc.HasExited) { $code = $proc.ExitCode } } catch { }
    if ($null -eq $code) { if ($result.SawResult -and -not $result.Stalled -and -not $result.TimedOut) { $code = 0 } else { $code = 99 } }
    $result.ExitCode = [int]$code

    $errText = ""
    if (Test-Path $errPath) { $errText = (Get-Content $errPath -Raw) }
    if ($errText -and $errText.Trim()) {
        Say ("  stderr: " + (($errText -split "`n" | Where-Object { $_.Trim() } | Select-Object -Last 3) -join " | ")) "DarkYellow"
    }

    return $result
}

if ($SmokeTest) {
    # Pass -StallMinutes explicitly to exercise the watchdog itself: '-SmokeTest -StallMinutes 0'
    # must kill the tree and report a STALL. That is how you prove the kill path, not just the
    # happy path.
    $smokeStall = 3
    if ($PSBoundParameters.ContainsKey('StallMinutes')) { $smokeStall = $StallMinutes }
    Say "SmokeTest: one trivial session through the real harness (watchdog ${smokeStall}m)." "Cyan"
    $s = Invoke-ClaudeSession -Prompt "Reply with exactly SMOKE-OK and nothing else. Do not use any tool." `
                              -SysPrompt "You are running unattended. Never call AskUserQuestion. Answer in one line." `
                              -Tag "smoke" -StallMinutes $smokeStall -MaxMinutes 5
    if ($s.Stalled -or $s.TimedOut) { Say "SmokeTest FAILED: the watchdog had to kill the session - the harness cannot see output." "Red"; exit 6 }
    if ($s.ExitCode -ne 0)          { Say "SmokeTest FAILED: exit $($s.ExitCode) - see $($s.Err)" "Red"; exit $s.ExitCode }
    if (-not $s.SawResult)          { Say "SmokeTest FAILED: no result event - see $($s.Jsonl)" "Red"; exit 4 }
    if ($s.ResultText -notmatch 'SMOKE-OK') { Say "SmokeTest ODD: session ran but said '$($s.ResultText)'. Plumbing is fine; the model just answered differently." "Yellow"; exit 0 }
    Say "SmokeTest PASSED: start, live stream, result parse, clean exit. The loop is safe to launch." "Green"
    exit 0
}

if ($DryRun) {
    Say "DryRun: pre-flight passed for every ticket above. Nothing started." "Green"
    exit 0
}

# --- the loop ----------------------------------------------------------------------------
foreach ($t in $Tickets) {
    # Reset per iteration: PowerShell scopes these to the whole foreach, and a statement-
    # terminating error below SKIPS an assignment rather than nulling it - without this the
    # verdict could fall through to the previous ticket's value and pass a broken round.
    $lastLine = ''
    $sawDone  = $false
    $sawBlock = $false
    $hitlDoc  = ".afk\HITL-$t.md"

    $baseSha = (git rev-parse HEAD).Trim()

    $afkProtocol = @"
You are running unattended (AFK) - there is no human available to answer questions.
Follow this protocol strictly:

1. NEVER call AskUserQuestion or wait for user input. It will hang the run.
2. When you hit a decision a human would normally weigh in on (naming, UX wording, copy,
   ambiguous spec detail, choice between reasonable approaches):
   - Pick the most conservative option consistent with the ticket/spec and repo conventions.
   - Log it to $hitlDoc (create the file if missing, append if it exists) as:
     ## Q: <the question>
     **Decision taken:** <what you chose>
     **Why:** <one line>
     **Revisit if:** <what would make this wrong>
   - Then continue working.
3. Wave-specific facts - read these before you code:
   - The spec is .issues\267-settlement-account-web-spec.md and the wayfinder map is
     C:\Work\DMSCO\BackOffice\.issues\1142-store-settlement-account-map.md. Read the spec AND your ticket.
     NOTHING in this wave has landed yet - 268 is the first slice. The models to read instead are
     the four shipped collection inquiries in src\features\collection\inquiry\ (spec 249, tickets
     253-258) and the reports area (spec 261, tickets 262-265): the gate, the toolbar, the grid,
     the paging and the CSV export in this wave all copy those shapes rather than invent new ones.
   - YOU ARE IN A GIT WORKTREE at C:\Playground\oms-react-267 on branch spec/267-settlement. A
     SECOND, BUSY checkout of this same repository exists at C:\Playground\oms-react on another
     branch. Stay inside this directory. Do not read from, write to, or cd into the other tree,
     and never `git checkout` a branch checked out there - git refuses and the refusal is opaque.
   - *** THE ONE DECISION 268 MAKES FOR THE WHOLE WAVE - the evidence, so you do not have to find
     it at 3am. Ticket 268 asks you to either COPY ScreenGate into the settlement feature or
     GRADUATE it to @/core/ui. The evidence says GRADUATE, and the ticket's own wording agrees
     ("graduating is right only if the copy would be the SECOND one"):
       * There are ALREADY TWO copies - src\features\collection\inquiry\ScreenGate.tsx and
         src\features\reports\retail-invoice\ScreenGate.tsx. A settlement copy is the THIRD.
       * The retail-invoice copy's own header comment states the trigger explicitly: "two copies
         is the duplication the rule accepts, and a THIRD area is the trigger".
       * More decisive: settlement is gated on the SAME grant as its neighbours (spec D1 - a fifth
         grant under the Collections access key), so its gate needs COLLECTION_ACCESS_KEY,
         collectionAccessQuery and the canOpen* predicates, and those live in
         src\features\collection\inquiry\api.ts. tools\check-boundaries.mjs ids a feature as
         area/feature, so collection/settlement importing collection/inquiry is a HARD lint
         failure even though both sit under the same area folder.
       * !! THE TRAP: you can dodge that lint error by re-declaring the key and the query inside
         the settlement feature. It passes every gate and it is still wrong - it is a SECOND
         reading of ONE grant, which is exactly what the existing code argues against in prose
         ("literally ONE reading of the grant rather than two that could drift").
       * So: graduate ScreenGate to @\core\ui, and graduate the Collections access probe
         (COLLECTION_ACCESS_KEY, collectionAccessQuery, collectionApi.access, the canOpen*
         predicates) to @\core\ alongside it, repointing collection\inquiry and
         layout\menu-model.ts at the graduated versions. Record the decision in ticket 268 as it
         asks. Do NOT stand up a second CollectionWeb/Access call.
   - *** canOpenSettlement IS A FIFTH BOOLEAN THAT DOES NOT EXIST YET. CollectionAccessResult in
     src\core\models\collection.ts carries exactly four flags today. Settlement needs a fifth and
     the server has not shipped it, so the live envelope will omit it. FAIL CLOSED - match the
     existing predicates exactly (r?.canOpenSettlement === true), which renders the screen
     correctly invisible until BackOffice seeds the grant. Do NOT default it to allowed, and do
     NOT add a 404-tolerant catch: the Collections probe deliberately fails closed, unlike the
     Notifications and Bby probes. Log the missing server field to the HITL doc as a 274
     prerequisite.
   - *** THE WIRE CONTRACT CARRIES NO CURRENCY, AND SPEC D10 DEMANDS PER-BRANCH PRECISION. None of
     FleetRow, Entry or Consumption in spec D8 has a currency field, but D10 requires 3 decimals
     for a BHD branch and 2 for SAR. core\money.ts's formatMoneyIn(value, currency) degrades an
     absent currency to 2 - so today every settlement figure draws at 2 and a Bahraini branch's
     fils vanish silently and greenly. Render through formatMoneyIn regardless, threading whatever
     currency you have; do NOT hardcode 3 decimals, do NOT reach for toFixed, and do NOT invent a
     currency lookup. Log the gap to the HITL doc as a BackOffice/274 escalation. This is the one
     defect in this wave that no gate can catch.
   - THE PROTOTYPE IS THE READ MODEL AND IT IS IN THE OTHER REPOSITORY:
     C:\Work\DMSCO\BackOffice\.scratch\proto\settlement-accountant-screen\ - fake.js is the
     substantive file, index.html and app.js are the spike. READ IT, NEVER PASTE IT: it is another
     repo's throwaway, it is not React, and its own money helper renders 3 decimals unconditionally
     (see the currency fact above - copying that helper is how D10 gets violated).
   - THE SIX HOSTILE FIXTURE BRANCHES, by store code, are the spine of 269 and the thing to build
     against BEFORE any happy path: 0142 an open shortage AND an open surplus at once with the
     surplus partly consumed; 0207 a surplus consumed to zero last night; 0331 an orphan
     consumption (money off the entry with no document behind it); 0455 a receipt prepared but not
     collected, plus a compensating void from a previous attempt; 0512 square, history only; 0688
     one CLOSED_OUT beside one CANCELLED. Each one broke a layout that looked fine on the easy case.
   - *** THE ESTATE-WIDE CARVE-OUT (270) IS THE LOAD-BEARING ASYMMETRY. The wrong-money and
     cash-waiting lanes are ALWAYS estate-wide whatever the scope control says; only the ageing
     count and the search ranking honour the scope. 1255 of the 1394 branches are unassigned, so a
     naive "mine" scope puts their money on nobody's screen. It looks like an inconsistency and it
     is deliberate - it gets its own unit test, and anyone tidying the scope handling breaks it
     first.
   - THE ARABIC DOMAIN WORDS ARE VOCABULARY, NOT A TRANSLATION (spec D9). The Arabic terms for
     shortage and surplus ride INSIDE the English namespace's values, beside the English word, the
     way the branch's own screen says it. Do NOT stand up a second locale, do NOT add an ar bundle,
     and do NOT treat them as stray literals to strip - they belong in the JSON values.
   - THE I18N NAMESPACE IS `settlement` - ticket 268 says so explicitly (src\locales\en\settlement.json,
     registered in core\i18n.ts). Do NOT extend the neighbours' `collection` bundle: that is a
     different feature's namespace. Note the reports area chose the AREA's name for its own reasons;
     this ticket's instruction is explicit and wins.
   - THIS WAVE ADDS NO NPM DEPENDENCY. 273 forbids a spreadsheet library by name - XLSX and CSV
     parsing is entirely the server's and the client uploads bytes. If a slice looks like it needs
     a package, that is a BLOCKER, not a decision you take at 3am.
   - A REFUSAL IS A 200, NEVER AN ERROR. Cancel, close-out and repair all answer
     { accepted: false, ... } with a true remaining. 272's lost race must recover into the
     write-off carrying the new remaining; 270's repair whose document arrived mid-click is a
     NO-OP rendered as a plain sentence. An error toast for either teaches the accountant to
     distrust a screen that is working correctly.
   - THREE RENDERING RULES FROM 269 THAT LATER SLICES MUST NOT UNDO: a consumption with no document
     is named IN WORDS on its row and never left blank; a REVERSE consumption renders as a
     RESTORATION, not a spend; and this screen computes NO variance at all - a settlement receipt
     carries SystemCashTotal = 0 and differencing across receipt kinds reads it as a full overage.
   - THE POSTING GUARD IS A REVIEW STEP, NEVER A NUMERIC CAP (271). A threshold was rejected twice
     because approval limits are deliberately unsettled, so any number is invented. Do not add one,
     do not add an approval step, and do not add a second permission.
   - PAGING AND CAPS COPY THE NEIGHBOURS: 50 a page inside the server's 500-row TOP, with the
     banner when it bites. core\ui\pager.ts and GridPager already exist - use them rather than
     writing a third pager.
   - 273 NEEDS 272 AS WELL AS 271, even though its frontmatter names only 271: its cancel-as-a-unit
     is "a loop over 272's mechanism, not a new one". Both have already run when 273 starts.
   - 274 IS NOT IN THIS RUN and is not yours to start, finish or unblock. If your slice would be
     easier with the live door, stub it and move on.
4. This repo's standing rules are non-negotiable - a violation is a review finding, not a taste
   difference. Read the rule file when your slice touches its area (.claude\rules\):
   - feature-structure: features/<area>/<feature>/ layout; features NEVER import features - only
     app and layout reach in. Adding a feature has a checklist; follow it rather than improvising
     a folder.
   - i18n-zero-literal: NO user-visible string literal anywhere. Every one goes through t(), with
     its key added to the en bundle. This is the single most common AFK slip, because a literal
     renders perfectly and only the lint gate catches it.
   - logical-tailwind: logical utilities only - ms/me/ps/pe/text-start/text-end - never
     ml/mr/pl/pr/left/right. The app renders RTL; a physical utility is silently wrong in Arabic
     and looks perfect in English.
   - api-envelope: every server call goes through src/core/api.ts. Do not hand-roll a fetch. 273's
     multipart upload adds a FormData path THERE, the way 262 added the blob path - never a fetch
     beside it.
   - Path alias @/ maps to src/. Do not add deep relative import chains.
5. How to verify - a green typecheck is NOT proof a screen works:
   - `npm run typecheck` is the fast inner loop; run it continuously.
   - `npm test` is vitest (node environment, src/**/*.test.ts). React Testing Library is
     deliberately NOT installed: pure modules are where regression is silent, components are thin
     renderers. So do NOT add RTL or reach for a component-rendering test - that is a separate
     hardening ticket's call, not yours at 3am.
   - `npm run lint` runs three gates: import boundaries, token contrast, colour literals. Run it
     before you commit; it is what catches a stray literal or a raw hex colour.
   - `npm run build` once at the end.
   - A UI slice is proven by DRIVING THE APP with a Playwright script under tools\*-drive.mjs. The
     spec names this wave's as tools\settlement-drive.mjs - EXTEND it as later slices land rather
     than minting a second one. That needs a vite server: start one on PORT 5201 (NOT 5173 and NOT
     5199 - a second, busy checkout of this repo exists and may hold either), run the drive against
     it, then KILL the server you started. Playwright is borrowed from
     C:/Playground/frontend/node_modules via a createRequire shim in the drive files - it is not a
     dependency of this repo. Follow an existing drive file rather than inventing a new harness.
   - If a drive genuinely cannot run (it needs a live SIS.Api that is not up, or Playwright does
     not resolve), that is an OUTSTANDING PROOF, not a blocker and never something to fake: stub
     the network at Playwright where the ticket allows it, otherwise leave the Proof box unticked,
     say exactly why in the ticket, and finish the rest of the slice.
   - Pre-existing baseline for this wave, measured when this runner was generated -
     anything at or below this is NOT yours to fix:
     * npm run typecheck: CLEAN. Any error you see is yours.
     * npm test: CLEAN - 98 files, 1557 tests, all passing. A red test is yours.
     * npm run lint: all three gates CLEAN (import boundaries, token contrast, colour literals).
     * The tree was freshly created from main with npm ci; nothing in it is half-finished.
6. Proof checkboxes marked OWNER, manual-smoke, or needing a live backend are NOT yours: leave them
   unchecked, list them as outstanding in the ticket, and never fake or simulate them. In this wave
   that is anything needing a live SIS.Api or a seeded fifth grant (all of it is 274's, which is
   excluded from this run), 269's "each of the six hostile branches eyeballed", 271's check that
   the reason renders verbatim in Arabic, and any Proof box asking a human to judge a rendering.
   The ticket may still complete AFK with those open; every OTHER Proof box must be real, written,
   and green.
7. Finish the /implement skill's own review step (built-in /code-review, then /standards-review)
   before you close the ticket. An INDEPENDENT /standards-review runs in a separate session right
   after this one against $baseSha, and its report lands in .afk\REVIEW-$t.md - so leave the commit
   in a state you would be happy to have reviewed cold.
8. Stage NARROWLY when you commit: your slice's files only. Do not commit .afk\ artifacts, drive
   screenshots, dist\, or anything you did not write for this ticket. Commit onto the CURRENT
   branch; never switch or create a branch.
9. BLOCKER = you cannot proceed safely at all: the spec contradicts itself, a required file or
   dependency is missing or unfetchable, the tickets are not on this branch, a slice would need a
   new npm dependency, or any choice risks breaking unrelated shipped behavior. On a blocker:
   - Log it to $hitlDoc under '## BLOCKER: <title>' with what you tried and what a human must
     decide.
   - STOP: do not complete the ticket, do not commit, leave the working tree in a clean
     understandable state, and end your final message with the exact line: AFK-BLOCKED
10. On success, the VERY LAST line of your final message must be exactly: AFK-DONE
    Nothing after it - no closing thought, no note for the next slice, no sign-off. Write whatever
    summary you like ABOVE it, then that line alone.
11. Do not push and do not open a PR. Committing is allowed only if the /implement skill itself
    says to commit.
"@

    Write-Host ""
    Say "=== ROUND A: fresh session /implement $t   (base $($baseSha.Substring(0,8))) ===" "Cyan"
    Say "    live stream below; a quiet stretch under a '->' line is that tool still running, and the ${StallMinutes}m watchdog is armed" "DarkGray"

    $r = Invoke-ClaudeSession -Prompt "/implement $t" -SysPrompt $afkProtocol -Tag "$t" `
                              -StallMinutes $StallMinutes -MaxMinutes ($MaxHours * 60)

    if ($r.Stalled)  { Say "=== /implement $t STALLED (no output for $StallMinutes min) - inspect $($r.Jsonl) - stopping loop ===" "Red"; exit 6 }
    if ($r.TimedOut) { Say "=== /implement $t hit the $MaxHours-hour ceiling - inspect $($r.Jsonl) - stopping loop ===" "Red"; exit 7 }
    if ($r.ExitCode -ne 0) { Say "=== /implement $t FAILED (exit $($r.ExitCode)) - inspect $($r.Err) - stopping loop ===" "Red"; exit $r.ExitCode }
    if (-not $r.SawResult) { Say "=== /implement $t produced no result event - inspect $($r.Jsonl) - stopping loop ===" "Red"; exit 4 }
    if ($r.IsError) { Say "=== /implement $t returned is_error ($($r.Subtype)) - inspect .afk\session-$t.jsonl - stopping loop ===" "Red"; exit 5 }

    $r.ResultText | Out-File ".afk\session-$t.log" -Encoding utf8

    # Marker scan over the WHOLE result text, anchored per line - NOT just the last line. A session
    # that finishes its slice correctly and then adds one line of helpful prose after the marker is
    # a clean success, and a last-line-only test reads it as a failure and costs the whole rest of
    # the wave. -match on a single string is a real boolean; never test a string[] this way - arrays
    # FILTER and a non-empty array is truthy.
    $lastLine = ($r.ResultText -split "`r?`n" | Where-Object { $_.Trim() } | Select-Object -Last 1)
    if ($lastLine) { $lastLine = $lastLine.Trim() } else { $lastLine = '' }
    $sawBlock = ([string]$r.ResultText) -match '(?m)^\s*[*`_]*AFK-BLOCKED[*`_]*\s*$'
    $sawDone  = ([string]$r.ResultText) -match '(?m)^\s*[*`_]*AFK-DONE[*`_]*\s*$'

    # AFK-BLOCKED is the one marker that still stops the loop on its own: the session is telling us
    # it deliberately did NOT finish, and the checks below would only confirm that more slowly.
    if ($sawBlock) { Say "=== /implement $t BLOCKED - see $hitlDoc - stopping loop ===" "Yellow"; exit 2 }

    # EVIDENCE OUTRANKS THE MARKER. git and the tracker are what actually happened; AFK-DONE is only
    # the session's claim about it. So the objective checks run FIRST and are the real gate - a
    # missing marker on an otherwise-clean slice WARNS and the wave carries on.
    $ticketFile = Get-ChildItem ".issues\$t-*.md" | Select-Object -First 1
    $nowHead = (Get-Content $ticketFile.FullName -TotalCount 8) -join "`n"
    if ($nowHead -notmatch '(?m)^status:\s*done') {
        Say "=== /implement $t ended but the ticket is not 'status: done' (marker seen: $sawDone) - inspect .afk\session-$t.log - stopping loop ===" "Yellow"
        exit 3
    }
    $headSha = (git rev-parse HEAD).Trim()
    if ($headSha -eq $baseSha) {
        Say "=== /implement $t ended but HEAD did not move - nothing was committed (marker seen: $sawDone) - stopping loop ===" "Yellow"
        exit 3
    }
    # A session can commit and STILL leave files behind (a new i18n key never staged, a drive file
    # written but not added). HEAD moving is not proof the slice landed whole: the review below
    # would then review an incomplete diff, and the NEXT ticket would sweep the orphan into its own
    # commit. So this is a stop, not a warning - and it names the round that caused it.
    $leftBehind = git status --porcelain --untracked-files=no
    if ($leftBehind) {
        Say "=== /implement $t committed, but LEFT TRACKED MODIFICATIONS UNCOMMITTED - the slice did not land whole - stopping loop ===" "Red"
        $leftBehind | Write-Host
        Say "    Inspect, then either commit them onto $t yourself or reset them, and re-run from the next ticket:" "Yellow"
        Say "    .\run-implements-spec267.ps1 -Tickets $(($Tickets | Where-Object { $_ -ne $t }) -join ',')" "Yellow"
        exit 9
    }
    $strayUntracked = git status --porcelain --untracked-files=normal | Where-Object { $_ -like '?? *' -and $_ -notlike '*.afk*' }
    if ($strayUntracked) {
        Say "    NOTE: untracked files exist after $t - check none of them belong to the slice (a new feature folder, an i18n bundle, a drive script):" "DarkYellow"
        $strayUntracked | Write-Host
    }

    # Every objective check above passed, so the slice landed whole whatever the session said last.
    # Name the missing marker so morning triage can see it, then carry on - this is a note, not a gate.
    if (-not $sawDone) {
        Say "    NOTE: $t never printed the AFK-DONE marker (last line: '$lastLine'), but the ticket is 'status: done', HEAD moved and the tree is clean - continuing on the evidence." "DarkYellow"
    }

    Say ("=== /implement $t DONE - " + ((git log --oneline "$baseSha..HEAD" | Measure-Object).Count) + " commit(s), tree clean ===") "Green"
    if (Test-Path $hitlDoc) { Say "    HITL decisions were logged: $hitlDoc" "Yellow" }

    if ($SkipReview) { continue }

    # --- ROUND B: independent standards + spec review of exactly this ticket's diff --------
    $reviewDoc = ".afk\REVIEW-$t.md"
    $reviewProtocol = @"
You are running unattended (AFK) - there is no human available to answer questions. NEVER call
AskUserQuestion.

You are reviewing ONLY the diff introduced by ticket $t of spec 267: git diff $baseSha...HEAD.
The fixed point is $baseSha - do not ask for one, do not widen the range.

This session is READ-ONLY with exactly one exception (the report file):
- Do NOT edit source, tests, .issues tickets or INDEX.md. Do NOT commit, stage, stash, revert or
  push ANYTHING. Do not run a drive that writes screenshots into the tree; reading the code and
  the diff is the job. `npm run typecheck` and `npm run lint` are fine - they write nothing.
- Write your full two-axis report (Standards and Spec) to $reviewDoc, overwriting it if present.
  Head it with the ticket number, the fixed point, and a one-line VERDICT: CLEAN, MINOR, or
  SERIOUS.
- Findings must be concrete: file:line, the rule or the spec line it violates, and what the fix
  would be. Say plainly when an axis is clean rather than manufacturing findings.
- Check every standing rule in .claude\rules\, and pay particular attention to the two that pass
  a human's eye: a user-visible string that never reached t(), and a physical Tailwind utility
  (ml/pr/left) where a logical one was required. Both render perfectly in English.
- The wave's own rules to check against:
  ScreenGate and the Collections access probe were to be GRADUATED to core, not copied a third
  time, and there must be exactly ONE declaration of the Collections access key and query in the
  repo; canOpenSettlement must FAIL CLOSED on an absent server field, never default to allowed;
  every money figure goes through core\money.ts formatMoneyIn - no hardcoded 3 decimals, no
  toFixed, no invented currency lookup; NO new npm dependency and no client-side XLSX/CSV parsing;
  the wrong-money and cash-waiting lanes must be estate-wide REGARDLESS of scope while ageing
  honours it; a consumption with no document is named in words and a REVERSE renders as a
  restoration; no variance is computed anywhere; refusals arrive as 200 with accepted:false and
  must never render as an error toast; no numeric cap, approval step or second permission on
  posting; the Arabic domain words belong inside the English settlement bundle and no second
  locale may appear; i18n keys live in the `settlement` namespace and the neighbours' `collection`
  bundle must not be extended; nothing in the other worktree (C:\Playground\oms-react) may be
  touched; backend-blocked Proof boxes must be honest, not faked green.

Then in your FINAL message print, in under 15 lines: the VERDICT word, the count of findings per
axis, and one line per SERIOUS finding. End your final message with the exact line:
AFK-REVIEW-DONE
"@

    Write-Host ""
    Say "=== ROUND B: /standards-review since $($baseSha.Substring(0,8))  (read-only, report -> $reviewDoc) ===" "Cyan"

    $rev = Invoke-ClaudeSession -Prompt "/standards-review since $baseSha" -SysPrompt $reviewProtocol -Tag "$t-review" `
                                -StallMinutes $StallMinutes -MaxMinutes 90

    # A review is morning triage, not a gate: warn and carry on so one bad review round cannot
    # cost the rest of the night's tickets.
    if ($rev.Stalled -or $rev.TimedOut) {
        Say "    WARN: review round for $t was killed by the watchdog - $reviewDoc may be missing. Continuing." "Yellow"
    }
    elseif ($rev.ExitCode -ne 0 -or -not $rev.SawResult -or $rev.IsError) {
        Say "    WARN: review round for $t did not complete cleanly (exit $($rev.ExitCode)). Continuing." "Yellow"
    }
    else {
        $rev.ResultText | Out-File ".afk\session-$t-review.log" -Encoding utf8
        Write-Host ""
        Say "--- review verdict for $t ---" "Magenta"
        ($rev.ResultText -split "`r?`n" | Where-Object { $_.Trim() } | Select-Object -First 15) |
            ForEach-Object { Say ("    " + $_.Trim()) "Magenta" }
        if (Test-Path $reviewDoc) { Say "    full report: $reviewDoc" "Magenta" } else { Say "    WARN: $reviewDoc was not written." "Yellow" }
    }

    # The reviewer is told not to touch the tree; verify, because the next ticket's diff depends
    # on it. The tree was PROVEN clean above, so anything here is unambiguously the reviewer's.
    # Its own report file is untracked and expected.
    $revDirty = git status --porcelain --untracked-files=no
    if ($revDirty) {
        Say "=== the REVIEW round for $t edited tracked files - it was told to be read-only. Revert its edits before continuing - stopping loop ===" "Red"
        $revDirty | Write-Host
        exit 8
    }
}

Write-Host ""
Say "Spec 267 wave complete. Read .afk\REVIEW-*.md and .afk\HITL-*.md before trusting the results." "Green"
Say ">>> Ticket 274 (the live door) was NEVER in this run: it needs a live SIS.Api, a seeded fifth grant, and BackOffice migration 081 which is not built. It is still open. <<<" "Yellow"
Say ">>> Check what 268 decided about ScreenGate and the Collections access probe FIRST - every later slice stands on it, and if it copied instead of graduating the whole wave carries a third copy. <<<" "Yellow"
Say ">>> The wire contract carries NO currency field while spec D10 demands 3 decimals for BHD. Expect that escalation in .afk\HITL-*.md; it is a BackOffice contract change, not a client fix. <<<" "Yellow"
Say ">>> canOpenSettlement does not exist on the server yet, so the screen is correctly invisible against a live API. That is 268's proof working, not a bug. <<<" "Yellow"
Say ">>> Eyeball the six hostile fixture branches (0142 0207 0331 0455 0512 0688) and the Arabic domain words before shipping; no gate catches a wrong rendering. <<<" "Yellow"
Say ">>> This wave was built in the worktree C:\Playground\oms-react-267 on branch spec/267-settlement. Merge it back deliberately; the tickets were committed here, so the copies still sitting untracked in C:\Playground\oms-react can be deleted after the merge. <<<" "Yellow"
