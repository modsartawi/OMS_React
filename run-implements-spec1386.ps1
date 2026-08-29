# Runs /implement + /standards-review for the spec 1386 IDoc Inspector tickets ("a read-only view of what the SAP rail generated") in fresh Claude Code sessions,
# sequentially, fully AFK.
#
#   .\run-implements-spec1386.ps1                  (296, 297, 300, 298, 299)
#   .\run-implements-spec1386.ps1 -Tickets 298,299
#   .\run-implements-spec1386.ps1 -DryRun          (pre-flight + plan only, starts nothing)
#   .\run-implements-spec1386.ps1 -SkipReview      (implement rounds only)
#   .\run-implements-spec1386.ps1 -SmokeTest       (one trivial session through the real harness)
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
# Dependency map (BackOffice spec 1386; nothing in this wave has landed yet):
#   296 --> 297 --+-- 300
#                 +-- 298
#                 \-- 299
#
#   Every slice ALSO has a server dependency in the OTHER repo, and all seven are still OPEN:
#     296 -> BO 1387  grant seed, screen gate, Access route
#     297 -> BO 1388  the transaction graph  (+ BO 1389 for the FI lines)
#     298 -> BO 1390  the verdict table      (+ BO 1391 documents outrank the export-version column)
#     299 -> BO 1393  download returns one file with one BOM
#     300 -> BO 1392  the legend ships from the API
#
# Running order:
#   Topological order is 296 -> 297 -> {298, 299, 300}. The three siblings are re-ordered
#   deliberately to 300, 298, 299:
#
#   * 300 runs FIRST of the three even though it is the highest number. It changes how EVERY code
#     cell on the screen renders - source tag, condition source, condition class, condition control,
#     IDoc type, billing type, workflow type, payment group, error type - which is exactly the
#     shared cell surface 297 builds. Built last it would rewrite cells 298 and 299 had already
#     shipped, and both of their diffs would have carried a doomed version through review.
#   * 298 runs before 299 because 298 owns the verdict strip and the attention banner, and 299 only
#     hangs download buttons onto that strip. The other way round, 299 invents a strip and 298
#     replaces it.
#   * Nothing is held back for a live backend, because there is no live backend for ANY slice: all
#     seven server tickets are open, so every slice here is proven on a Playwright network stub.
#     That is a wave-wide condition, not a per-ticket sequencing lever.
#
# Preconditions (the script checks 1, 2 and 4 - you own 3 and 5):
#   1. Nothing outside this wave blocks it - 296 is the first slice and its blocked-by is empty.
#   2. No TRACKED modifications in the tree (untracked files are fine and only warn).
#   3. YOU ARE ON THE RIGHT BRANCH. This runner never switches branches - it commits onto
#      whatever is checked out now. Waves here are often built on a feature branch rather
#      than main, and the tickets themselves may only exist on that branch.
#      Expected for this wave: main
#   4. node_modules is installed (npm ci / npm install) - checked, because a missing install
#      turns every slice's typecheck into a wall of phantom errors at 3am.
#   5. A live SIS.Api on :5111 is NOT required and would NOT help - all seven BackOffice
#      routes this wave consumes are unbuilt, so every slice stubs the network at Playwright. The
#      prototype .issues\assets\BO-1381-idoc-inspector.PROTOTYPE.html is the approved shape and
#      governs the layout; the loop follows it and does not re-decide it.
param(
    [int[]]$Tickets = @(296,297,300,298,299),
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
   - The spec is C:\Work\DMSCO\BackOffice\.issues\1386-idoc-inspector-spec.md and the wayfinder map is
     C:\Work\DMSCO\BackOffice\.issues\1374-idoc-generation-made-visible.md. Read the spec AND your ticket.
     Nothing in this wave has landed yet - 296 is the first slice. Each later
     slice must read the committed diffs of the ones ahead of it in this run rather than
     re-deciding what they settled.
   - The nearest solved problem in this repo is src/features/reports/retail-invoice/. Read its
     api.ts, RetailInvoicePage.tsx and download-outcome.ts BEFORE writing anything. This feature is
     the same shape - keyed lookup, access probe, blob download - and the spec says outright that it
     copies that rail rather than re-deciding it.
   - i18n namespace is `reports`, NOT a new `idoc-inspector` one. Ticket 296's text says "its own
     namespace named after the feature", but src/core/i18n.ts already ruled the opposite in writing
     for this AREA: "the second report screen JOINS this namespace instead of minting another".
     Put every key under reports:idocInspector.* in src/locales/en/reports.json and do NOT register
     a new namespace. Renaming later is cheap; a second reports namespace is the expensive mistake.
   - The access probe FAILS CLOSED and has NO catch. Copy retail-invoice's shape exactly: one
     exported cache key, one exported options factory (staleTime Infinity, retry false) so the nav
     leaf and the in-page guard cannot disagree, and one `=== true` predicate. Do NOT copy the
     Bby/Access or Notifications/Access "404 degrades to allowed" pattern - what is behind this door
     is every IDoc in the estate behind a single grant.
   - Denied is a 200 carrying { screenAllowed: false }, and it renders a SHUT DOOR. Never an error,
     never a toast, never a retry, never "try again in a moment". The endpoint answers denials
     deliberately so a denied session can LEARN it is denied; treating it as a failure tells the
     user to try again forever.
   - NO AG Grid anywhere in this feature. The idiom to reuse lives in
     src/features/pricing/simulation/ (SimResultsGrid, SimLineExpansion, ConditionCard - ticket 116
     dissolved that feature's last AG Grid on purpose). Reuse it by READING it. You may NOT import
     from it: features never import features. If a piece genuinely needs sharing it graduates to
     @/core/*, but prefer writing this feature's own.
   - Two levels of navigation is the WHOLE budget: a document is SELECTED in a horizontal rail (at
     most five exist on any transaction), a line OPENS IN PLACE beneath itself, and conditions plus
     item details live inside the open line. A third level - a modal, a drawer, a nested tab - is a
     spec violation even when it looks nicer.
   - ONE server call carries the whole graph. Selecting a document or opening a line must never
     touch the network, and there is no client-side paging at any level.
   - Provenance is ONE column. The source tag is a chip on every line and condition row; the
     condition's own conditionSource rides beside it as a small marked letter, because a column of
     its own would be a wall of repeated letters. The filter bar filters the TAG only.
   - An EMPTY source tag renders as a dimmed *unknown* and must NEVER be defaulted to POS. The
     server sends "" verbatim for exactly this reason: defaulting it client-side would let a
     provenance bug disguise itself as ordinary data, which is the single thing the column exists
     to prevent.
   - Payments and FI rows carry no provenance FIELDS AT ALL - absent from the payload, not null. So
     their tables have NO provenance column rather than an empty one, and the screen says so. Do
     not render a dimmed "unknown" chip there; the honest answer is "this row never had one".
   - Empty string is a FIRST-CLASS value with three different meanings, and one grey dash for all
     three is misinformation. On a source tag it is a pre-feature row (provenance unknown); on an
     error type it means NO ERROR; on a SAP discount-type code it means no mapping was found, which
     is a defect. Render the three distinctly.
   - Always render the RAW code with the label as SECONDARY text, never the label alone. A
     consultant reading a SAP ticket needs the literal string to paste into it; a screen showing
     only a friendly name is unusable for the job it exists for.
   - Never compile a copy of any backend vocabulary into this repo. The nine closed legends come
     from IDocInspector/Metadata, fetched once per session and cached - this repo is on its own
     release cadence, so a bundled legend is wrong the first time a backend constant changes.
     Condition-type descriptions are different: they are open master data and arrive ON EACH
     CONDITION ROW. Missing description means render the code alone; never invent one.
   - The registered-workflow set on Metadata is LEGEND ONLY. The server already decided the verdict;
     the screen never derives a state from it.
   - Ten verdict codes, exactly, and no eleventh: Processed, ProcessedWithHeldDocuments,
     ProcessedButStampedLegacy, Parked, Queued, Retrying, GaveUp, Legacy, StampedNotEnqueued,
     NoSuchTransaction. Three wordings ARE the defect if you get them wrong:
       * Parked must read "the workflow has not shipped yet" - not "failed", not "pending". It is
         3.2% of production entries and it describes work that was never built, not work that broke.
       * GaveUp must NOT read as success. The underlying row has its processed flag SET, which is
         exactly the trap: a consultant who reads "processed" reports a lost invoice as delivered.
       * Held documents are NOT an empty state at all. They render IN FULL under an attention
         banner. A held document is a finding, not an absence.
   - ProcessedButStampedLegacy renders the FULL graph plus a banner naming the disagreement and the
     offending export-version value. The banner states the contradiction; it does not diagnose and
     does not offer to fix anything. This is the one case where the screen must not smooth over what
     it found - without it, a double-posted invoice is the one thing this screen makes invisible.
   - An unmapped verdict code must fail LOUDLY rather than render blank. Prove it table-driven over
     all ten codes so an eleventh cannot ship silently.
   - Download is one button PER IDOC TYPE PRESENT, sitting on the verdict strip. Never per line,
     never per document, never a single bundle button. Two types present means two buttons and two
     files; there is no bundle.
   - The download goes through api.blob and could not be anything else: request<T> calls res.json()
     on every body and this body is raw XML. A plain <a href> or window.open cannot call it either -
     the cookie branch of the CSRF filter needs a header a browser navigation cannot send, which is
     also why the route being a GET is not a contradiction. The filename comes from the server's
     content-disposition; the client does not compose one.
   - The reconstruction caveat is carried ON SCREEN beside the buttons: this XML is rebuilt from the
     database rows AS THEY STAND NOW. It is valid-shaped and partial, and the screen may NEVER
     present it as "what SAP received" - the rows record when they were created and never when they
     were changed.
   - All three export states offer the SAME file. Export state changes what the consultant is told,
     not what they can take. There is no refusal.
   - Two STATED ABSENCES, both refuted mid-map, both of which look like omissions if you do not know
     they were argued: there is NO header-conditions pane (this rail never writes an item-0
     condition, so the pane would be permanently blank), and the "read the rate, not the value" rule
     belongs to the PRICING ENGINE's condition table, not to the IDoc condition table shown here. Do
     not helpfully add either one back.
   - Glossary collision, and BOTH words appear on this screen: an "IDoc batch" is a unit of delivery
     to SAP; a "batch" (CHARG) is a physical lot of a material and shows up inside item details. The
     copy must keep them apart.
   - This wave adds NO npm dependency. If a slice looks like it needs one, that is a BLOCKER, not a
     decision you take at 3am.
   - 297 OWNS the feature's model types and its row/cell surface. Put the types in
     src/core/models/idoc-inspector.ts, following the retail-invoice precedent. 300, 298 and 299
     EXTEND what 297 shipped; none of them restructures it.
   - Arabic is explicitly out of scope for this FEATURE per the spec, but the logical-Tailwind rule
     still binds every line you write, because the rule is repo-wide and no gate catches a physical
     utility.
   - The governing spec and every server dependency live in the OTHER repository
     (C:\Work\DMSCO\BackOffice). READ freely: 1386 (the spec), 1374 (the map), and 1387-1393 (the
     server slices). You may NOT edit, stage, commit or run anything over there - it has its own
     branch, its own loop and its own reviewer. If you believe something there is wrong, log it to
     the HITL doc and carry on with your slice.
   - !! ALL SEVEN server tickets are status: open. Not one route exists. Every slice in this wave is
     built and proven against a Playwright network stub of the AGREED shape below, and any Proof box
     that genuinely needs the real door stays unticked with the reason written into the ticket.
   - The agreed shapes, verbatim from spec 1386 and BackOffice 1388 / 1391 / 1392:

     GET IDocInspector/Access -> { screenAllowed: boolean }
         cookie-only, deliberately NOT grant-gated, and a denial is a 200.

     GET IDocInspector/Transaction (store, transaction number) ->
       { verdict, attention?, documents: [ {
           idocType, receiptNumber, pharmacyId,
           exportState,                    // exported | batched-not-exported | not-batched
           batch: { id, exportedAt } | null,
           lines: [ { ..., sourceTag, conditions: [ { ..., sourceTag, conditionSource,
                                                      conditionType, conditionTypeDescription } ],
                           itemDetails: [ ... ] } ],
           payments: [ ... ],              // NO provenance fields at all - absent, not null
           fiItems:  [ ... ]               // NO provenance fields at all - absent, not null
       } ] }
       and the tenth verdict's attention block is exactly:
       attention: { code: "EXPORT_VERSION_DISAGREES", exportVersion: "L" }

     GET IDocInspector/Metadata -> the nine closed legends plus the registered-workflow set
         (legend only). Condition types are NOT in it and must not be added to it.

     GET IDocInspector/Download (store, transaction number, IDoc type) -> the XML bytes RAW - not
         base64, not enveloped - with the filename on content-disposition. Only FAILURES wear the
         envelope, and such a failure is a business outcome to surface, not a crash.

   - !! The leaf fields inside lines, itemDetails, payments and fiItems are shown as "..." in the
     contract and are genuinely not named yet. Do NOT let each slice invent its own: 297 names them
     ONCE in src/core/models/idoc-inspector.ts, derived from the approved prototype's columns
     (.issues\assets\BO-1381-idoc-inspector.PROTOTYPE.html) and the spec, and records the assumed
     names in its HITL doc as one consolidated contract note for the owner to reconcile against
     BackOffice 1388. Later slices USE those names and do not re-guess them.
   - Do not soften the shape to whatever is convenient. A screen built against a guessed shape fails
     the day the endpoint lands, and it fails silently on exactly the fields you guessed.
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
     * npm test: 121 files, 1978 tests, ALL PASSING. A red test is yours.
     * npm run lint: all three gates CLEAN - import boundaries (560 files), token contrast
       (117 pairs across both themes), colour literals (565 files, 4 documented exclusions).
     * Measured on 2026-08-29 on branch main, tree clean.
6. Proof checkboxes marked OWNER, manual-smoke, or needing a live backend are NOT yours: leave them
   unchecked, list them as outstanding in the ticket, and never fake or simulate them. In this wave
   that is every Proof box that needs a live IDocInspector route - all seven server tickets
   (BackOffice 1387-1393) are open, so nothing in this wave can be driven end to end. Stub at
   Playwright, tick only what the stub genuinely proves, and leave anything needing the real door
   unticked with the reason written into the ticket. The ticket may still complete AFK with those open; every OTHER
   Proof box must be real, written, and green.
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
        Say "    .\run-implements-spec1386.ps1 -Tickets $(($Tickets | Where-Object { $_ -ne $t }) -join ',')" "Yellow"
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

You are reviewing ONLY the diff introduced by ticket $t of spec 1386 (the IDoc Inspector spec, which lives in the BackOffice repo): git diff $baseSha...HEAD.
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
  the i18n namespace is `reports` with keys under idocInspector.* - a newly minted namespace is a
  finding; the access probe fails closed with no 404-tolerant catch, and a denial renders a shut door
  rather than an error or a retry; NO AG Grid, and NO import from src/features/pricing/simulation
  (features never import features); two navigation levels only - a modal, drawer or third tab is a
  violation; ONE provenance column, with conditionSource as a marked letter beside the tag; an empty
  source tag renders as a dimmed unknown and NEVER as POS; payments and FI rows carry no provenance
  column at all rather than an empty one; codes render RAW with the label as secondary text, and no
  backend vocabulary is bundled into this repo; the three meanings of "" render distinctly; all ten
  verdict codes are mapped, with Parked reading as not-yet-shipped, GaveUp never reading as success,
  and held documents rendering in full under a banner; download is one button per IDoc type present,
  through api.blob, with the reconstruction caveat beside it and the server's own filename; no
  header-conditions pane and no rate-not-value rule; no new npm dependency; and backend-blocked Proof
  boxes are honest rather than faked green.

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
Say "IDoc Inspector wave (spec 1386) complete. Read .afk\REVIEW-*.md and .afk\HITL-*.md before trusting the results." "Green"
Say ">>> Every server route this wave consumes is STILL UNBUILT: BackOffice 1387-1393 are all status open. Nothing here has touched a live door - run the BackOffice loop, then re-drive. <<<" "Yellow"
Say ">>> Reconcile the leaf field names 297 assumed (see .afk\HITL-297.md) against BackOffice 1388 before either half ships. <<<" "Yellow"
Say ">>> i18n: the loop put this feature's keys in the reports namespace under idocInspector.*, following src\core\i18n.ts, NOT the per-feature namespace ticket 296's own text asks for. Confirm that reading. <<<" "Yellow"
Say ">>> Eyeball the screen against .issues\assets\BO-1381-idoc-inspector.PROTOTYPE.html before shipping - no gate checks fidelity to the approved shape. <<<" "Yellow"
