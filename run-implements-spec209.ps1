# Runs /implement + /standards-review for the spec 209 Nphies web tickets (eligibility checks and
# prior authorizations) in fresh Claude Code sessions, sequentially, fully AFK.
#
#   .\run-implements-spec209.ps1                  (210, 211, 212, 213, 214, 215, 216, 217, 218, 219, 220, 221)
#   .\run-implements-spec209.ps1 -Tickets 217,218
#   .\run-implements-spec209.ps1 -DryRun          (pre-flight + plan only, starts nothing)
#   .\run-implements-spec209.ps1 -SkipReview      (implement rounds only)
#   .\run-implements-spec209.ps1 -SmokeTest       (one trivial session through the real harness)
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
# Dependency map (spec 209; NOTHING has landed yet - this is the whole wave, all twelve):
#
#   210 -----------------------------------------------------+
#                                                             v
#   211 --> 212 --+--> 213 -------------------------------> 217 --+--> 218 --+--> 220 --> 221
#                 |                                                |         |            ^
#                 +--> 214 --+--> 215                              +--> 219 -+            |
#                            |                                                            |
#                            +--> 216 ------------------------------------------------ ---+
#
#   217 is blocked by BOTH 210 (the core/ guard) and 213 (the seam).
#   221 is blocked by BOTH 220 (something to replay) and 216 (the refusal's own detail).
#
# Running order:
#   Straight ascending 210..221, which IS a topological order of the blocked-by graph above -
#   no edge is violated by it. Three judgements sit inside that:
#   * 210 runs FIRST and ALONE. It is a prefactor: the latest-state guard moves out of
#     features/callcenter/console into core/ so a second feature can hold an engine session
#     without importing another feature. It is the only ticket in this wave that touches a
#     screen already in production, and the bar is ZERO behaviour change - a diff that alters
#     an assertion has overreached.
#   * 214, 215 and 216 run BEFORE 217 even though 217 is the keystone. They are blocked only
#     by 212, so they are buildable whatever happens to the session form - and 217 is the
#     riskiest slice in the effort, with 218, 219, 220 and 221 all dying with it. Putting the
#     cheap independent slices ahead of it means a 217 failure costs four tickets, not seven.
#   * 221 is last by the graph and by risk alike: it is the only slice that needs BOTH the
#     session form and the authorization detail to have already landed correctly.
#
# Preconditions (the script checks 1, 2 and 4 - you own 3 and 5):
#   1. Nothing outside this wave blocks it - 210 and 211 are both startable today.
#   2. No TRACKED modifications in the tree (untracked files are fine and only warn).
#   3. YOU ARE ON THE RIGHT BRANCH. This runner never switches branches - it commits onto
#      whatever is checked out now. Waves here are often built on a feature branch rather
#      than main, and the tickets themselves may only exist on that branch.
#      Expected for this wave: main
#   4. node_modules is installed (npm ci / npm install) - checked, because a missing install
#      turns every slice's typecheck into a wall of phantom errors at 3am.
#   5. SIS.Api on :5111 is DOWN and is NOT a precondition. It was probed when this runner was
#      generated and did not answer, and the eleven server tickets this wave consumes
#      (BackOffice 912-922) are being written in the OTHER repo in parallel tonight. So no
#      Nphies endpoint will be live during this run and none is expected to be. Every slice
#      proves itself with the network STUBBED at Playwright against the frozen contract at
#      .issues\assets\209-nphies-contract\CONTRACT.md. The prototypes under
#      .issues\assets\196-nphies\ are the LAYOUT reference and are not a visual design - the
#      token pass and the component choices are the build's job.
param(
    [int[]]$Tickets = @(210,211,212,213,214,215,216,217,218,219,220,221),
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
Say "Branch: $branch   (expected for this wave: main)" "DarkGray"

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
   - The spec is .issues\209-nphies-web-spec.md and the wayfinder map is
     .issues\196-nphies-to-web-map.md. Read the spec AND your ticket.
     Nothing in this wave has landed yet - 210 is the first slice ever written for it. From the
     second ticket onward, read the committed diffs of the earlier tickets in THIS wave before
     re-deciding anything they already settled.
   - THE FROZEN CONTRACT IS THE AUTHORITY ON EVERY SERVER SHAPE:
     .issues\assets\209-nphies-contract\CONTRACT.md (v1.0, 16 passthrough endpoints + 11 session
     verbs, the session-state projection and its ordering rule, the 19-field line ownership
     table, the three-way error taxonomy with its codes, 12 conformance fixtures). Every field
     name in it was read from the Nphies service's own source, not inferred. Read the sections
     your slice touches and use those names EXACTLY. Do NOT invent a field, do NOT soften a
     shape to whatever is convenient, and do NOT design a friendlier envelope - a screen built
     against a guessed shape fails the day the endpoint lands, and it fails silently on exactly
     the fields you guessed. If the contract does not cover something you need, that is a HITL
     entry naming the gap, not a licence to make it up.
   - SIS.Api IS DOWN AND THAT IS EXPECTED. It was probed when this runner was generated and did
     not answer, and the eleven SIS.Api tickets this wave consumes (BackOffice 912-922) are
     being written in the OTHER repository in parallel tonight. NO Nphies endpoint will be live
     during this run. Do NOT treat that as a blocker and do NOT stop a slice over it: STUB THE
     NETWORK AT PLAYWRIGHT against the contract's shapes and drive the screen that way.
     tools\bby-inquiry-drive.mjs is the prior art for a drive over mocked envelopes;
     tools\callcenter-drive.mjs is the prior art for driving a live engine session in a browser
     and is required reading before 217's drive. Even 211's check endpoint - the one act that
     ships today - has no grant filter, no access probe, no providers lookup and no
     last-eligibility yet, so it stubs like the rest.
   - THE SHARED STATUS MODULE MUST LAND IN core/, NOT INSIDE THE ELIGIBILITY FEATURE. Ticket
     212 introduces the two-axis Request/Verdict derivation and says it is "written to be read
     by two features' lists"; ticket 214 reuses it from the AUTHORIZATIONS feature. eligibility
     and authorizations are two separate FEATURES under one area, and features may NEVER import
     features - the same rule that forced 210 to exist. So 212 puts that module under core/
     with its suite, and 214 imports it by @/core/... A module parked in
     features/nphies/eligibility/ and imported from features/nphies/authorizations/ is an
     import-boundary violation that npm run lint will fail on in 214, after 212 has already
     been committed and reviewed. Get it right in 212.
   - features/nphies/ is a NEW AREA holding TWO features - eligibility and authorizations -
     with six routes: /nphies/eligibility, /nphies/eligibility/new, /nphies/eligibility/:id,
     /nphies/authorizations, /nphies/authorizations/new, /nphies/authorizations/:id. 211
     creates the area, the nav group, the first namespace and the access probe; every later
     ticket EXTENDS that registration rather than re-deciding it. Follow the call-centre group
     in src\layout\menu-model.ts as the precedent for a top-level nav group with its own probe,
     and FAIL CLOSED: a pending or errored probe hides the leaf rather than revealing it.
   - The i18n namespace name equals the feature name (the feature-structure rule). Whatever 211
     names the eligibility namespace, 214 names its own the same way and NOTHING later renames
     either. Register centrally in src\core\i18n.ts in the same change that uses the keys, or
     every t() renders its raw key.
   - NO NEW NPM DEPENDENCY ANYWHERE IN THIS WAVE. 219's attachment work is deliberately
     library-free: the file reader and the canvas are native browser APIs. If a slice looks
     like it needs a package, that is a BLOCKER logged to the HITL doc, not a decision you take
     at 3am.
   - NOBODY COMPUTES MONEY IN THE BROWSER. The engine computes all of it and the Nphies service
     transcribes it verbatim, checking nothing. The agent supplies exactly five inputs - header
     deductible rates and caps, header paid-outside, line quantity, line Max Coverage, line Days
     Supply - plus Selection Reason, which is a code and not an amount. Every other money field
     is derived and READ-ONLY. Do not add a client-side total, a subtotal, a recalculation, or a
     "helpful" rounding beyond the one the spec names (ActualPatientShare to 2dp, matching the
     till, because it is the only per-line figure the payer adjudicates).
   - THE ROW NEVER ASSERTS "ready to dispense". The real predicate lives in the service's
     Dispense() and carries a follow-up clause this data does not have, so a browser copy could
     only lie on some rows. The reader infers it from what is visible: Complete + a good verdict
     + no dispensed marker. Do not add a readiness column, badge or boolean.
   - NO BROWSER POLLING AND NO refetchInterval ANYWHERE. The Nphies service already polls the
     exchange every 15 seconds, so a Pending authorization becomes Complete on its own and the
     normal path to a verdict is WAITING. Manual Refresh with the load time stated beside it.
   - NO MODAL OPENS ANYWHERE IN THE AUTHORIZATION FLOW. The form is one scrolling page and both
     details are ROUTES, not dialogs - they must survive a refresh and be linkable, which is
     half the reason the seam between the two features is a URL carrying an eligibility id and a
     member id. Two overlays ARE allowed because the spec names them: 219's inline attachment
     lightbox, and 220's clinical-edit gate, which is ONE dialog in TWO shapes (warning =
     overridable, fatal = the same surface with the confirm button removed).
   - CORRECTIONS OF RECORD - these overturn wording that still sits in older tickets, so a
     careful session WILL get them wrong by reading the wrong source:
     * RETRY BELONGS TO Pending, NOT TO Failed (215). Retry re-POSTs the stored payload
       verbatim and takes the newer answer, which is meaningless for a request the exchange
       never accepted.
     * Failed MEANS THE EXCHANGE REFUSED IT ON VALIDATION BEFORE THE PAYER SAW IT (220) - a
       FORM STATE the agent fixes in place, never a transport blip. It has TWO sources: the
       exchange's own validation, and the Nphies service's guards, which throw BEFORE the lines
       are built and so leave a header-only row.
     * A SUBMIT TIMEOUT IS IN FLIGHT, NEVER FAILED (220). Offer status check; never invite a
       resubmit. Raising a second authorization for a request that already reached the payer is
       the worst outcome this screen can produce and this rule is the whole of what prevents it.
     * THE AUTHORIZATION LIST MUST ASK FOR REFUSED ROWS EXPLICITLY (214). The service filters
       errored requests out by default, so without that flag a refused authorization never
       appears - and 221's reopen affordance on a row nobody can see is worth nothing. This is
       the single easiest thing in the effort to get silently wrong.
   - TWO OPPOSITE DUPLICATE RULES, BOTH DELIBERATE. 217 REFUSES a duplicate item at the moment
     it is added, naming the quantity control as the remedy. 219 ALLOWS the same attachment
     title twice, because a sequence number already distinguishes the rows and two prescriptions
     really are two prescriptions. Do not harmonise them by analogy in either direction; each
     is asserted in its own ticket's Proof precisely so it cannot be "tidied".
   - 216's DUAL-MEANING FIELD IS READ IN EXACTLY ONE BRANCH. One response field carries either
     a transport error or the decoded adjudication display. The Request state picks BOTH the
     label and the source: Failed/Pending render it under a "could not reach the payer" failure
     label; Complete NEVER renders it at all, whatever it contains. A neutral "Message" label
     re-conflates exactly what the two axes exist to keep apart.
   - 218 CARRIES A QUIRK DELIBERATELY. On a brand-IR line the agent may pick a Selection Reason
     and the Nphies service overwrites it at submit with its own value, and blanks the field
     entirely for certain items. The old screen behaves identically. Reproduce it and say so in
     a comment, or someone will "fix" it and change what reaches the payer. Likewise a cap of
     ZERO: the engine silently ignores it, so the cell WARNS rather than accepting a value that
     will quietly do nothing - an inherited asymmetry, not a bug to fix here.
   - 218 DELETES A BEHAVIOUR RATHER THAN PORTING IT. Days Supply is validated 1-100 AT THE CELL,
     so an out-of-range value can never exist. The old screen's submit-time sweep - silently
     resetting to the header value, then listing what it changed in a warning dialog - is
     deleted, not ported. Do not reintroduce it as a safety net.
   - 219's morphology field DOES NOT EXIST unless the principal diagnosis is a neoplasm; it
     appears and disappears with the radio, carrying its own "required because..." heading.
     Principal is a RADIO in the row, so uniqueness is structural rather than validated. Both
     are the same rule stated forward instead of refused after submit - do not add a validator
     that says the same thing a second time.
   - LISTS FOLLOW THE REPO'S EXISTING AG GRID SCREENS. Read the BBY Inquiry and UA Users list
     screens for columns, paging, the filter panel and the chip idiom before writing 212 or 214.
     Do not invent a new list shape. The default window is the last 7 days, newest first,
     server-paged, and it is a REMOVABLE CHIP rather than a silent filter - the whole point of
     212 is that a silently truncated list reads as "that's everything".
   - The prototypes at .issues\assets\196-nphies\screen-shape-prototype.html and
     attachments-prototype.html are the LAYOUT reference only. They are not a visual design:
     component choices, AG Grid usage and the token pass are the build's job, against the POS
     design system already in this repo. Do not copy colours or hexes out of them - npm run
     lint's palette gate will fail you, correctly.
   - The governing spec and every ticket in THIS wave live in THIS repository. The eleven server
     tickets this wave consumes live in the OTHER repository at C:\Work\DMSCO\BackOffice
     (.issues\912-nphies-web-door.md through .issues\922-nphies-conformance-fixtures.md). You
     may READ them and the Nphies service source at C:\Work\DMSCO\nphies\Service\NphiesService
     when you need to understand a shape the contract leaves ambiguous. You may NOT edit, stage,
     commit or run anything in either of those trees - BackOffice has its own branch, its own
     loop running tonight, and its own reviewer. If you believe something there is wrong, log it
     to the HITL doc and carry on with your slice.
   - The Nphies production environment is the LIVE NATIONAL EXCHANGE. Never submit anything to
     it from this run, under any circumstance, however convenient a real response would be.
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
5. How to verify - a green typecheck is NOT proof a screen works:
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
     * npm run typecheck: CLEAN. Any error you see is yours.
     * npm test: CLEAN - 50 files, 814 tests, all passing.
     * npm test is INTERMITTENTLY FLAKY IN ITS EXIT CODE ONLY: one run in several exits 1 with
       "Error: Worker exited unexpectedly" while reporting every test passed and one file short
       (49 of 50). It is a vitest worker crash, not a failing assertion, and it predates this
       wave. Re-run it once before concluding you broke something - and never "fix" it by
       changing a test.
     * npm run lint: all three gates CLEAN (318 files for boundaries, 117 contrast pairs,
       320 files with 4 documented colour exclusions).
6. Proof checkboxes marked OWNER, manual-smoke, or needing a live backend are NOT yours: leave them
   unchecked, list them as outstanding in the ticket, and never fake or simulate them. In this wave
   that is every proof that needs a REAL SIS.Api rather than a stubbed one - a stubbed drive is
   required and counts, so the genuinely outstanding set is the live-server half: 217's real engine
   session against real session verbs, 218's real re-pricing round trip, 220's real 100-second
   submit timing, and any check that the contract's shapes match what SIS.Api actually returns.
   Tick what you stubbed, say plainly IN THE TICKET that it was stubbed and against which contract
   section, and leave the live-server line open. The ticket may still complete AFK with those open;
   every OTHER Proof box must be real, written, and green.
7. Finish the /implement skill's own review step (built-in /code-review, then /standards-review)
   before you close the ticket. An INDEPENDENT /standards-review runs in a separate session right
   after this one against $baseSha, and its report lands in .afk\REVIEW-$t.md - so leave the commit
   in a state you would be happy to have reviewed cold.
8. Stage NARROWLY when you commit: your slice's files only. Do not commit .afk\ artifacts, drive
   screenshots, dist\, or anything you did not write for this ticket. Commit onto the CURRENT
   branch; never switch or create a branch.
9. BLOCKER = you cannot proceed safely at all: the spec contradicts itself, a required file or
   dependency is missing or unfetchable, the tickets are not on this branch, a slice would need a
   new npm dependency, or any choice risks breaking unrelated shipped behavior. A DOWN SIS.Api IS
   NOT A BLOCKER IN THIS WAVE - it is the expected condition and you stub it. On a real blocker:
   - Log it to $hitlDoc under '## BLOCKER: <title>' with what you tried and what a human must
     decide.
   - STOP: do not complete the ticket, do not commit, leave the working tree in a clean
     understandable state, and end your final message with the exact line: AFK-BLOCKED
10. On success, the VERY LAST line of your final message must be exactly: AFK-DONE
    Nothing after it - no closing thought, no note for the next slice, no sign-off. Write whatever
    summary you like ABOVE it, then that line alone. A previous session in this wave finished its
    ticket perfectly and closed with one line of friendly prose instead, and the runner read a clean
    success as a failure.
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

    # Marker scan over the WHOLE result text, anchored per line - NOT just the last line.
    # Ticket 210 proved why: it finished the slice correctly (status done, HEAD moved, tree clean)
    # and then closed with one line of helpful prose, so a last-line-only test read a clean success
    # as a failure and cost the other eleven tickets. -match on a single string is a real boolean;
    # never test a string[] this way - arrays FILTER and a non-empty array is truthy.
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
        Say "    .\run-implements-spec209.ps1 -Tickets $(($Tickets | Where-Object { $_ -ne $t }) -join ',')" "Yellow"
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

You are reviewing ONLY the diff introduced by ticket $t of spec 209: git diff $baseSha...HEAD.
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
  the frozen contract .issues\assets\209-nphies-contract\CONTRACT.md is the authority on every
  server shape - a field name that is not in it is invented and is a SERIOUS finding; no new npm
  dependency anywhere in this wave; the shared two-axis status module belongs in core/, never in
  one feature imported by another (eligibility and authorizations are two features under one
  area, and features may not import features); no money is computed, totalled or re-rounded in
  the browser beyond ActualPatientShare to 2dp; retry is offered on Pending and NOT on Failed;
  Failed is a form state the agent fixes in place, not a transport error; a submit timeout is
  reported as in-flight and never invites a resubmit; the authorization list asks for refused
  rows explicitly; the dual-meaning message field is rendered on Failed/Pending under a failure
  label and NEVER on Complete; no refetchInterval or browser polling anywhere; no modal in the
  authorization flow except the clinical-edit gate and the attachment lightbox; the row never
  asserts readiness to dispense; 217 refuses a duplicate item while 219 allows a duplicate
  attachment title, and neither may be harmonised into the other; the brand-IR selection-reason
  overwrite and the ignored zero cap are carried deliberately and must still be commented as
  such; Days Supply is validated at the cell with no submit-time sweep reintroduced; SIS.Api is
  down by design, so a stubbed drive is correct and expected - but a Proof box claiming a LIVE
  server was exercised is a SERIOUS finding, and so is a Proof box faked green.

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
    # Its own report file is untracked and expected - and .afk\ is excluded outright, because
    # ticket 220 proved the failure mode: an implement round staged .afk\REVIEW-220.md into its
    # own commit, the reviewer then overwrote that now-TRACKED file exactly as designed, and this
    # check read a correct review as a rogue edit and killed the wave one ticket short.
    $revDirty = git status --porcelain --untracked-files=no | Where-Object { $_ -notmatch '\.afk/' }
    if ($revDirty) {
        Say "=== the REVIEW round for $t edited tracked files - it was told to be read-only. Revert its edits before continuing - stopping loop ===" "Red"
        $revDirty | Write-Host
        exit 8
    }
}

Write-Host ""
Say "Spec 209 Nphies wave complete. Read .afk\REVIEW-*.md and .afk\HITL-*.md before trusting the results." "Green"
Say ">>> This wave is 12 tickets across 7 dependency levels and was estimated at 17-27 hours of wall clock - if you are reading this after ONE night, check that every ticket really ran rather than assuming it did. <<<" "Yellow"
Say ">>> NOTHING in this wave was proven against a live SIS.Api - it was down by design and every drive stubbed the network against the frozen contract. Re-drive each slice once BackOffice 912-922 deploy, and expect the contract-vs-reality mismatches to surface then. <<<" "Yellow"
Say ">>> The BackOffice half (tickets 912-922) runs from its own loop in C:\Work\DMSCO\BackOffice - this runner did not touch it. Reconcile the two halves against the contract before either is called done. <<<" "Yellow"
Say ">>> 210 touched a live production screen (the call-centre console). Drive tools\callcenter-drive.mjs yourself and watch an order complete before you trust the prefactor. <<<" "Yellow"
Say ">>> Eyeball the Arabic/RTL rendering of the new Nphies screens before shipping; no gate catches a physical Tailwind utility, and this wave adds six routes' worth of new layout. <<<" "Yellow"
