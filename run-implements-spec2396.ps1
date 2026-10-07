# Runs /implement + /standards-review for the oms-react half of BackOffice spec 2396 ("an OMS bonus buy is tested before it goes live, and authoring scales to real campaigns") in fresh Claude Code sessions,
# sequentially, fully AFK.
#
#   .\run-implements-spec2396.ps1                  (419, 421, 420, 422)
#   .\run-implements-spec2396.ps1 -Tickets 420,422
#   .\run-implements-spec2396.ps1 -DryRun          (pre-flight + plan only, starts nothing)
#   .\run-implements-spec2396.ps1 -SkipReview      (implement rounds only)
#   .\run-implements-spec2396.ps1 -SmokeTest       (one trivial session through the real harness)
#
# ASCII only, on purpose: Windows PowerShell 5.1 reads a BOM-less .ps1 as ANSI, so a stray
# em dash silently becomes mojibake and can break the parse. Keep every character 7-bit.
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
# never as a quoted command-line argument. The child still hands it to claude as ONE native
# arg, so it escapes every embedded double quote first (see the child runner below).
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
# Dependency map (BackOffice spec 2396 lives in the C# repo; 416, 417, 418 already landed on main):
#   417 (done) --+--> 419 --> 422
#                \--> 420
#   418 (done) -----> 421
#   Backend doors (BackOffice repo, ALL OPEN when generated): 419 <- 2397+2398, 420 <- 2400 (+2403 for
#   the 3000 cap), 421 <- 2398+2399, 422 <- 2404. Nothing here waits on them: every slice is stubbed.
#
# Running order:
#   * 419 runs FIRST. It is the shared-surface slice: it adds status '3' to the models and to
#     overviewStatus, turns editorAccess into "read-only unless Planned", and adds canTest +
#     testedBy/At/Note to the wire. 421 renders a locked serial's status and 422 obeys the lock, so
#     building either before 419 means carrying a doomed version of both.
#   * 421 runs SECOND, ahead of 420 although they are independent: it is a deletion (the activate
#     option and its multipart part) and a small one, so it lands cleanly before 420 widens the
#     shared i18n bundle and the shared drive file.
#   * 420 runs THIRD. It is the only slice that crosses into a second feature (pricing/coupons) and
#     graduates a pure normaliser to @/core; it does not depend on 419.
#   * 422 runs LAST. It needs 419's lock rules, and it carries the one bullet with no door behind it
#     (the coupon template's pick-list of coupon materials) - the likeliest to burn a session, so a
#     blocker there costs one ticket, not the night.
#
# Preconditions (the script checks 1, 2 and 4 - you own 3 and 5):
#   1. 417 and 418 must be 'status: done' and committed (they are, on main and so on this branch).
#   2. No TRACKED modifications in the tree (untracked files are fine and only warn).
#   3. YOU ARE ON THE RIGHT BRANCH. This runner never switches branches - it commits onto
#      whatever is checked out now. Waves here are often built on a feature branch rather
#      than main, and the tickets themselves may only exist on that branch.
#      Expected for this wave: spec/2396-bby-tested (worktree C:\Playground\oms-react-spec2396, cut from main at 52a4a28)
#   4. node_modules is installed (npm ci / npm install) - checked, because a missing install
#      turns every slice's typecheck into a wall of phantom errors at 3am.
#   5. A live SIS.Api is NOT required and none carries the doors: BackOffice 2397-2405 are all OPEN. Every slice stubs BbyMaintainWeb at Playwright against the shapes written into the briefing below. Kill any stray vite on :5199 before launching (a previous runner's orphan holds the port).
param(
    [int[]]$Tickets = @(419,421,420,422),
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
$BlockingTickets = @(417, 418)

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
Say "Branch: $branch   (expected for this wave: spec/2396-bby-tested (worktree C:\Playground\oms-react-spec2396, cut from main at 52a4a28))" "DarkGray"

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
# Escape embedded double quotes. PS 5.1 wraps a whitespace-bearing native arg in quotes but does NOT
# escape the quotes inside it, so the prompt shatters into many argv entries and claude dies on the
# first fragment that starts with a dash ('error: unknown option'). -SmokeTest cannot catch it: its
# own prompt has no quotes. Reproduced 2026-09-26 on BackOffice's spec 2030 runner before this fix.
$sys = (Get-Content $SysPromptFile -Raw) -replace '"', '\"'
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
   - The spec is C:\Work\DMSCO\BackOffice\.issues\2396-an-oms-bonus-buy-is-tested-before-it-goes-live-and-authoring-scales-to-real-campaigns-spec.md and the wayfinder map is
     C:\Work\DMSCO\BackOffice\.issues\2323-promotions-engine-pilot-and-oms-bonus-buy-screen-instead-of-a-big-bang.md (track B). Read the spec AND your ticket.
     Tickets 416, 417, 418 (spec 2374) built this feature and are on this branch, and ADR 0063
     (C:\Work\DMSCO\BackOffice\docs\adr\0063-*.md) is the status decision. Read 417's and 418's
     committed diffs (dd5a9f1, 92bfebd, c9ea6ef) and the earlier slices of THIS wave before re-deciding
     anything they settled.
   - Everything lives in ONE feature, src/features/pricing/bonus-buy-maintenance (ns
     'bonus-buy-maintenance'), except 420's and 422's coupon-template parts in src/features/pricing/coupons
     (ns 'coupons'). Pure seams: editor.ts (editorAccess, buildSave, readOutcome), overview.ts
     (overviewStatus, overviewSeverity), upload.ts (uploadForm). Wire types: src/core/models/
     bonus-buy-maintenance.ts and bonus-buy-upload.ts. Extend these; do not start parallel files.
   - NO new npm dependency, no new feature folder, no route or menu change. If a slice seems to need
     one, that is a BLOCKER.
   - SPEC 2396 REVERSES SPEC 2374 (stories 45, 53, 68, 69). The old wording still sits in 416-418's
     tickets, in code comments and in existing tests: "an activated bonus buy can be changed live",
     "upload can activate", "no way back to Planned". Those are now WRONG. Update or retire any existing
     test that asserts them and say so in the commit; do not preserve them for compatibility.
   - STATUS CODES (ADR 0063): BbyStatus blank = Activated, '1' = Planned, '2' = Deactivated, '3' =
     Tested (NEW). Transitions: Planned -> Tested (Mark Tested); Tested -> Activated; Activated <->
     Deactivated (reactivation needs no re-test); Tested/Activated/Deactivated -> Planned (Back to
     Planned). Planned -> Activated is REFUSED. Only Planned can change. There is NO promotion-level Mark
     Tested and NO promotion-level Back to Planned - do not add either "for symmetry".
   - SAP-numbered bonus buys are untouched by this wave: they stay read-only via the server's
     'readOnly: true' (editorAccess reason 'sap'), and are never offered Mark Tested or Back to Planned.
     Keep the 'sap' reason distinct from the new status lock so the hint text stays right.
   - THE BACKEND IS NOT BUILT. BackOffice 2397, 2398, 2399, 2400, 2403, 2404 are all OPEN, and the
     BackOffice branch afk/spec2396 holds only the spec commit. So every new door below is the SPEC'S
     READING, not a shipped DTO. 416 once built from a spec reading and got the field names wrong (417
     had to reconcile them). Therefore: keep each new body/response shape in ONE place (the model file
     + one api.ts function), add a comment "spec 2396 reading, reconcile when BackOffice 23xx ships",
     and log the guess in the HITL doc. The shapes to build against, verbatim from the spec/tickets:
       GET  BbyMaintainWeb/Access                 -> { screenAllowed: bool, canTest: bool }
       POST BbyMaintainWeb/BonusBuy/MarkTested    { number, note }  -> BbyMaintainOutcome (in-band)
       POST BbyMaintainWeb/BonusBuy/BackToPlanned { number }        -> BbyMaintainOutcome (in-band)
       POST BbyMaintainWeb/CouponMaterial/Generate { description } -> { status: 'saved'|'refused', material }
       GET  BonusBuy/{n} and Promotion overview rows ADD testedBy, testedAt, testNote (nullable)
     TRAP: the SHIPPED Activate/Deactivate/Delete bodies are { bbyNumber }, but the spec writes
     MarkTested/BackToPlanned as { number }. Send what the spec says ({ number }), do NOT "fix" it to
     bbyNumber for consistency, and log the mismatch to HITL as a question for BackOffice 2397/2398.
     For Generate, type 'refusals?: BbyRefusal[]' as optional and show them if present - the spec names
     only status + material.
   - canTest gating: Mark Tested shows only when Access returns canTest === true (fail closed, like
     canOpenBbyMaintain) AND the bonus buy is Planned AND it is not SAP. Access is ONE shared query
     (bbyMaintainAccessQuery / BBY_MAINTAIN_ACCESS_KEY) - read canTest from it, do not add a second probe.
     The four-eyes rule (tester != last writer) is SERVER-side: do NOT pre-block it on the client by
     comparing changedBy to the session user. Show the server's refusal as is (EN + AR, BbyRefusal).
   - Back to Planned on an ACTIVATED bonus buy asks for confirmation first, warning the offer leaves the
     tills. On Tested/Deactivated it does not need the warning. Activate on a Planned bonus buy is NOT
     offered (single or multi-select row action); its hint says it must be tested first. The
     promotion-level Activate stays offered and its server refusal lists the untested bonus buys through
     the existing bonusBuys[] item results - reuse ActReport, do not build a second report.
   - 420 NORMALISER - match the server EXACTLY. BbyMaintainValidator.List (BackOffice
     Sartawi.Retail.Data\Modules\Logistics\Pricing\Bby\Services\BbyMaintainValidator.cs ~line 580):
     split on , ; | space and (after BackOffice 2400) \r \n \t, trim each piece, drop empties, join with
     "," - NO de-duplication of the stored list. loyGroups and loyTiers are ALSO upper-cased; the other
     four lists are not. The "how many codes" count is the count of the normalised list.
   - 420 TRAP - the normaliser is used by TWO features (bonus-buy-maintenance and coupons). Features
     never import features, so it must live in @/core (e.g. src/core/util/code-list.ts with its own
     .test.ts), not in editor.ts.
   - 420 TRAP - the coupon template's EDITABLE origin filter is the <input type="text"> in
     src/features/pricing/coupons/TemplatesWorkspace.tsx (~line 250). The ticket says
     "CouponDetailPane", but that pane only DISPLAYS the value. Change the form; the pane may just keep
     showing the stored comma list.
   - 420 TRAP - do NOT put maxLength on the new textareas. A browser maxLength silently TRUNCATES a
     pasted 500-row column - exactly the silent-loss bug this ticket fixes. Check the cap against the
     NORMALISED length (the server checks the normalised value) and show it beside the code count.
   - 420 RULING - the origin filter cap STAYS 50. BackOffice 2403 (and 2402, the store widen) are open,
     and the ticket says ship 3000 only with or after 2403. Make the cap ONE named constant per box
     (bonus buy and coupon template), prove it with the "origin filter cap follows the shipped width"
     test at 50, and log in HITL + the ticket exactly which constant flips to 3000 when 2403 ships. The
     other five lists keep their current caps (EngineRulesTab LIST_MAX).
   - 421: remove the "Activate new bonus buys" checkbox, its 'activate' field in UploadOptions and the
     form.append('activate', ...) line, and its i18n keys (upload.activate, upload.activateHint). Fix the
     model comment in bonus-buy-upload.ts that says a row is blank "when the upload activated it". The
     upload refusal shape is UNCHANGED ({ row, serial, code, english, arabic }; row 0 = whole file): a
     locked-serial refusal carries its number and status in the server's text, so render it through the
     existing refused-row path and do NOT invent number/status fields. Help text names columns 23 SCORE
     and 24 LOY_TIERS as OMS-only, and says a file using them will not load into SAP until dropped.
   - 422: the action sits on a Buy line whose Line Item Type is Material, only on a Planned (or new,
     unsaved) OMS bonus buy - never on a grouping line, never read-only. The prompt's description
     defaults to the bonus buy's text (editable). Each press is a NEW material (no caching, no reuse).
     A copied bonus buy keeps its source's material (Copy is server-side; change nothing there). The
     generated number's description shows "like any keyed material" - which today, per 417, is whatever
     417 renders (there is NO item-description door, an unfiled BackOffice ask). Do not add one.
   - 422 BLOCKED BULLET (ruled here, do not escalate as a BLOCKER): "the coupon template's material box
     also offers coupon materials to pick" has NO door - CouponsAdminWeb has no list of coupon materials
     and spec 2396 names none. Do NOT invent an endpoint and do NOT import the bonus-buy feature's
     Generate into coupons. Keep the typed box unchanged (ADR 0051), leave that bullet unbuilt, record it
     in the ticket as outstanding with the missing door named, log it in HITL, and complete the rest.
   - i18n: each slice adds keys under its OWN sub-tree of bonus-buy-maintenance.json so slices do not
     collide: 419 under 'status.*' / 'test.*' / 'backToPlanned.*' (plus the overview/editor labels it must
     touch), 420 under 'engine.*', 421 under 'upload.*', 422 under 'couponMaterial.*'; coupon-template
     copy goes in coupons.json under 'templates.*'. Status 3's label is "Tested" everywhere a status shows.
   - Dates (testedAt) render through @/core/util/date-format; tested by / at / note are data - isolate
     per the bidi rule ('Ltr' for the time, <bdi> for the name and the free-text note).
   - The drive is tools/bby-maintenance-drive.mjs (90/90 after 418, all STUBBED). Each slice appends its
     OWN numbered block of steps, as 418 did, and the whole file must stay green - do not rewrite earlier
     blocks except where this wave's reversal makes an old step wrong (say which, in the commit).
   - The governing spec, ADR 0063 and the backend tickets live in the OTHER repository
     (C:\Work\DMSCO\BackOffice, branch pricing2; an afk/spec2396 branch exists there too). You may READ
     anything there. You may NOT edit, stage, commit, check out or run anything in that repository - it
     has its own branch, its own loop and its own reviewer. If you believe something there is wrong
     (a wire shape, a missing door), log it to the HITL doc and carry on with your slice.
   - The doors this wave calls are NOT built. Stub exactly the shapes listed above at Playwright. Do not
     invent fields, do not soften a shape to whatever is convenient - a screen built against a guessed
     shape fails the day the endpoint lands, and it fails silently on the fields you guessed.
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
   - api-envelope: every server call goes through src/core/api.ts. Do not hand-roll a fetch.
   - Path alias @/ maps to src/. Do not add deep relative import chains.
5. BATCH EXPLORATION - BUDGET THE ROUND TRIPS, NOT THE READING. Read as much of the repo as
   you need; under-reading is a worse failure than a slow session, and nothing here caps how
   much you look at. What is capped is the number of CALLS you spend looking.
   - One Bash call may carry MANY reads. `cat a.tsx b.tsx; sed -n '1,80p' c.ts; grep -n X d.ts`
     is ONE call, and it puts MORE context in front of you in a single view than four calls do -
     usually the better read, not just the faster one. Batch by DEFAULT; a lone single-file read
     is the exception.
   - Before a third consecutive single-file read, stop and batch the next ten into one call.
   - Genuinely sequential reads are fine: when file A tells you which file B to open, you could
     not have batched them. Never GUESS at B just to save a call.
   - DELEGATE WIDE SEARCHES, KEEP JUDGEMENT. If a question means sweeping many files or guessing
     at naming conventions ("where is this route registered", "what else uses this hook"), spawn
     ONE Explore subagent and keep its conclusion instead of walking the tree file by file. Do
     NOT delegate a question you must reason over in detail - a subagent returns a summary and
     the raw detail is lost. Correctness judgements, rules compliance and diff review stay yours.
   - Measured on a comparable wave: ~93 one-line reads per session, ~15 of every ~40 minutes of
     wall-clock, nearly all batchable. Round trips - not builds, not tests - dominate a long slice.
6. How to verify - a green typecheck is NOT proof a screen works:
   - `npm run typecheck` is the fast inner loop; run it continuously.
   - `npm test` is vitest (node environment, src/**/*.test.ts). React Testing Library is
     deliberately NOT installed: pure modules are where regression is silent, components are thin
     renderers. So do NOT add RTL or reach for a component-rendering test - that is a separate
     hardening ticket's call, not yours at 3am.
   - `npm run lint` runs three gates: import boundaries, token contrast, colour literals. Run it
     before you commit; it is what catches a stray literal or a raw hex colour.
   - `npm run build` once at the end.
   - A UI slice is proven by DRIVING THE APP with a Playwright script under tools\*-drive.mjs.
     That needs a vite server: start one on port 5199 (NOT the default 5173, so you cannot collide
     with a dev server the human left running), run the drive against it, then KILL the server you
     started. Playwright is borrowed from C:/Playground/frontend/node_modules via a createRequire
     shim in the drive files - it is not a dependency of this repo. Follow an existing drive file
     rather than inventing a new harness.
   - If a drive genuinely cannot run (it needs a live SIS.Api that is not up, or Playwright does
     not resolve), that is an OUTSTANDING PROOF, not a blocker and never something to fake: stub
     the network at Playwright where the ticket allows it, otherwise leave the Proof box unticked,
     say exactly why in the ticket, and finish the rest of the slice.
   - Pre-existing baseline for this wave, measured when this runner was generated -
     anything at or below this is NOT yours to fix:
     * npm run typecheck: CLEAN (exit 0). Any error you see is yours.
     * npm test: 201 files, 3667 tests, ALL PASSING. Any red test is yours (or an old 2374 assertion
       this wave deliberately reverses - retire it explicitly, never silently).
     * npm run lint: all FOUR gates CLEAN (boundaries, grid base, contrast, palette).
     * tools/bby-maintenance-drive.mjs: 90/90 green after 418, all stubbed.
7. Proof checkboxes marked OWNER, manual-smoke, or needing a live backend are NOT yours: leave them
   unchecked, list them as outstanding in the ticket, and never fake or simulate them. In this wave
   that is every 'Done when' owner walk (419: Planned -> Mark Tested as a second user -> Activate -> Back to Planned; 420: paste a 500-row Excel column and save; 421: upload a 24-column file; 422: generate, save, pick on a coupon template, redeem in the simulator) - all need a dev SIS.Api carrying BackOffice 2397-2404, which is not built; the 3000-character origin filter cap (gated on BackOffice 2403); and 422's coupon-material pick list (no door exists). The ticket may still complete AFK with those open; every OTHER
   Proof box must be real, written, and green.
8. Finish the /implement skill's own review step (built-in /code-review, then /standards-review)
   before you close the ticket. An INDEPENDENT /standards-review runs in a separate session right
   after this one against $baseSha, and its report lands in .afk\REVIEW-$t.md - so leave the commit
   in a state you would be happy to have reviewed cold.
9. Stage NARROWLY when you commit: your slice's files only. Do not commit .afk\ artifacts, drive
   screenshots, dist\, or anything you did not write for this ticket. Commit onto the CURRENT
   branch; never switch or create a branch.
10. BLOCKER = you cannot proceed safely at all: the spec contradicts itself, a required file or
    dependency is missing or unfetchable, the tickets are not on this branch, a slice would need a
    new npm dependency, or any choice risks breaking unrelated shipped behavior. On a blocker:
    - Log it to $hitlDoc under '## BLOCKER: <title>' with what you tried and what a human must
      decide.
    - STOP: do not complete the ticket, do not commit, leave the working tree in a clean
      understandable state, and end your final message with the exact line: AFK-BLOCKED
11. On success, the VERY LAST line of your final message must be exactly: AFK-DONE
    Nothing after it - no closing thought, no note for the next slice, no sign-off. Write whatever
    summary you like ABOVE it, then that line alone.
12. Do not push and do not open a PR. Committing is allowed only if the /implement skill itself
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
        Say "    .\run-implements-spec2396.ps1 -Tickets $(($Tickets | Where-Object { $_ -ne $t }) -join ',')" "Yellow"
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

You are reviewing ONLY the diff introduced by ticket $t of BackOffice spec 2396 (web half, oms-react tickets 419-422): git diff $baseSha...HEAD.
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
  spec 2396 REVERSES 2374's live change of an activated bonus buy, upload-and-activate and no way back
  to Planned - any surviving trace of those is a SERIOUS finding; status '3' reads Tested wherever a
  status shows; read-only unless Planned, with SAP read-only kept as its own reason; Mark Tested only
  with Access canTest === true on a Planned non-SAP bonus buy, no client-side four-eyes pre-check, no
  promotion-level Mark Tested or Back to Planned; Back to Planned on Activated confirms first; new door
  shapes are the spec's reading ({ number } not { bbyNumber } for MarkTested/BackToPlanned), kept in one
  place and commented as unreconciled; the list normaliser lives in @/core (two features use it), matches
  the server's separators exactly (no de-dup; groups/tiers upper-cased), no maxLength on paste boxes, and
  the origin filter cap is still 50; upload never sends 'activate'; no invented coupon-material list
  endpoint; the shared drive file still passes end to end; backend-blocked Proof boxes are honest, not
  faked green.

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
Say "Spec 2396 web wave complete. Read .afk\REVIEW-*.md and .afk\HITL-*.md before trusting the results." "Green"
Say ">>> Every proof in this wave is STUBBED: BackOffice 2397-2405 were all open when this runner was generated. Reconcile the new door shapes (MarkTested/BackToPlanned body { number } vs { bbyNumber }, Generate's response) when they ship. <<<" "Yellow"
Say ">>> 420 left the origin filter cap at 50 on purpose - flip the named constants to 3000 only after BackOffice 2402+2403 have shipped and the store census is clean. <<<" "Yellow"
Say ">>> 422's coupon-template pick list of coupon materials has no door - decide whether to file a BackOffice ask. <<<" "Yellow"
Say ">>> The BackOffice half (2397-2405) runs from its own loop in C:\Work\DMSCO\BackOffice - this runner did not touch it. Merge spec/2396-bby-tested into main after the morning review. <<<" "Yellow"
