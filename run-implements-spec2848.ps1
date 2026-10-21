# Runs /implement + /standards-review for the BackOffice brief 2848 promotion tickets plus the 2862 rename (oms 539 deal->promotion rename, then 534-537: the Promotions list, a promotion's page, hand-made promotions, the workspace knows its promotion; all doors stubbed) in fresh Claude Code sessions,
# sequentially, fully AFK.
#
#   .\run-implements-spec2848.ps1                  (539, 534, 535, 537, 536)
#   .\run-implements-spec2848.ps1 -Tickets 537,536
#   .\run-implements-spec2848.ps1 -DryRun          (pre-flight + plan only, starts nothing)
#   .\run-implements-spec2848.ps1 -SkipReview      (implement rounds only)
#   .\run-implements-spec2848.ps1 -SmokeTest       (one trivial session through the real harness)
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
# Dependency map (BackOffice brief 2848 + ticket 2862, ADR 0097; 533 and 538 left out, they are live walks):
#   539 (independent; rewrites 533-538's text)
#   534 --> 535 --+-- 537
#                 \-- 536
#   533 (live walk, NOT in this run) <-- 530, 531, 532
#   538 (live walk, NOT in this run) <-- 534, 535, 536, 537
#
# Running order:
#   * 539 runs FIRST although nothing blocks on it in the frontmatter: it renames deal -> promotion
#     in the built upload screens AND rewrites the open tickets 533-538 (doors Promotions/*,
#     promotionCode, RULES_PROMOTION_*, rule-promotion.ts, features/campaigns/promotions,
#     namespace campaign-promotions, routes /campaigns/promotions/:promotionCode and
#     /campaigns/no-promotion, menu leaf Promotions). Built second, every later slice would ship
#     the dead word and 539 would rename a whole feature after the fact.
#   * 534 -> 535 is the spine (535 retires 524's composed list, the widest change in the wave).
#   * 537 runs before 536 although they are siblings: 537 (workspace shell, crumb, Prev/Next) is
#     the smaller slice and touches surfaces 536 never does; 536 (five doors, seven refusals, three
#     dialogs) goes last so a burnt session costs one ticket, not the night.
#   * 533 and 538 are OUT: they need BackOffice deployed to staging, HQ scripts 015-018 run and the owner.
#
# Preconditions (the script checks 1, 2 and 4 - you own 3 and 5):
#   1. Nothing outside this wave blocks it (530-532 are done; BackOffice 2846, 2847 and the 2862 rename are built; every door is stubbed). Branch cut from main at 33dbda8.
#   2. No TRACKED modifications in the tree (untracked files are fine and only warn).
#   3. YOU ARE ON THE RIGHT BRANCH. This runner never switches branches - it commits onto
#      whatever is checked out now. Waves here are often built on a feature branch rather
#      than main, and the tickets themselves may only exist on that branch.
#      Expected for this wave: spec/2848-promotions (worktree C:\Playground\oms-react-spec2848)
#   4. node_modules is installed (npm ci / npm install) - checked, because a missing install
#      turns every slice's typecheck into a wall of phantom errors at 3am.
#   5. A live SIS.Api on :5111 is NOT required - every slice stubs the doors at Playwright. The live walks are tickets 533 and 538, run later by the owner.
param(
    [int[]]$Tickets = @(539,534,535,537,536),
    [string]$Model = "opus",
    # No stream output for this long => the session is wedged; kill the tree and stop.
    [int]$StallMinutes = 25,
    # Absolute ceiling for one session, however chatty it is.
    [double]$MaxHours = 5,
    [switch]$SkipReview,
    # Keep tracked modifications (a killed slice) and tell the FIRST ticket's session to continue from them.
    [switch]$ResumeDirty,
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
Say "Branch: $branch   (expected for this wave: spec/2848-promotions (worktree C:\Playground\oms-react-spec2848))" "DarkGray"

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
if ($dirtyTracked -and $ResumeDirty) {
    Say "ResumeDirty: keeping tracked modifications for ticket $($Tickets[0]) to continue from." "DarkYellow"
} elseif ($dirtyTracked) {
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
   - The spec is C:\Work\DMSCO\BackOffice\.issues\assets\2848-oms-react-promotions-brief.md (the brief,
     ALREADY RENAMED from 2848-oms-react-deals-brief.md - a ticket still citing the old file name is
     stale; 539 fixes the citation). Its door-by-door shapes are in
     C:\Work\DMSCO\BackOffice\.issues\assets\2737-oms-react-rule-engine-brief.md section "HQ contract:
     promotions (2846-2847)" - THAT section is the wire contract. The rename itself is
     C:\Work\DMSCO\BackOffice\.issues\2862-deal-is-renamed-promotion-everywhere-the-rule-engine-says-it.md
     (539's spec). There is no wayfinder map; the ADR is
     C:\Work\DMSCO\BackOffice\docs\adr\0097-a-campaign-upload-is-one-approval-and-one-ruleset-version-and-a-promotion-owns-its-campaigns.md.
     Read the brief AND your ticket. Tickets 530-532 (the upload screens) have already landed on
     main - read their code in features/campaigns/uploads before re-deciding anything they settled.
     Inside the run, each ticket reads the committed diffs of the ones before it.
   - THE BIG REVERSAL - read this twice. BackOffice 2862 renamed "deal" to "promotion" EVERYWHERE in
     the rule engine, and the BackOffice side is ALREADY BUILT (commits 4d5f39ef4, c469d4f5f on
     branch pricing2; RulePromotionWebEndpoints.cs, RulePromotionAuthoringService.cs). The doors are
     Rules/Authoring/Promotions/List|Campaigns|Create|Update|Assign|Unassign|Delete, the wire field
     is promotionCode (also in every Uploads/* body and reply), the refusals are RULES_PROMOTION_*,
     the workbook key is PromotionCode. The ORIGINAL texts of 534-537 say "deal" and even say
     "never 'promotion'" - that line is DEAD. Ticket 539 runs FIRST in this wave and rewrites
     533-538 to the new words (and renames their files where the slug says deal - find a ticket by
     its number, .issues\<N>-*.md, never by its old slug). From 534 on, read your ticket AS 539 LEFT
     IT, and where any text still says deal, the 2848 brief's promotion wording wins.
   - Words after the rename (the brief's "rules the screens live by", DECIDED): a PROMOTION is the
     weekly flyer or an ad-hoc set of campaigns; a CAMPAIGN is one offer; a RULE is one when/then.
     Never "deal", "batch", "week" as a term, or "offer group" in code, keys or copy. "Promotion" alone
     never means one campaign or a bonus buy. Names: core/models/rule-promotion.ts (types prefixed
     RulePromotion... where a bare Promotion could be confused), feature features/campaigns/promotions/,
     namespace campaign-promotions (EN only, registered in core/i18n.ts; no campaigns namespace has an
     ar file - do not start one, and do not hard-code the brief's "Arabic beside it" label), routes
     /campaigns/promotions/:promotionCode and /campaigns/no-promotion as static leaves BESIDE
     campaigns/:id in app/router.tsx, menu leaf "Promotions" (it keeps owning /campaigns/*), crumb
     Promotions > <promotion> > <campaign>, list-context query param ?promotion=<code>.
   - DO NOT TOUCH the bonus-buy engine's promotion. features/*bby*, BbyPromotion, PcCondition,
     "applied promotion", "web promotion", the call-center/Sim promotion rows and CONTEXT.md's
     bonus-buy entries are a DIFFERENT concept that already says "promotion"; a sweeping find-and-replace
     there, or a new rule-promotion type reused by a bby screen, is a defect. 539's grep check
     (git grep -i -w deal -- src tools) is scoped to the word deal; CONTEXT.md's "_Avoid_: offer, deal"
     line for bonus buy and the "deal with" English at its line 59 stay as they are.
   - 539 is a pure rename: NO behaviour change. Closed tickets 530-532 and their INDEX lines keep their
     words as a record; 533-538's INDEX.md lines and links ARE updated (file names change). Also
     rename the drive's stubs and assertions (tools/campaign-uploads-drive.mjs, 62 hits) and the
     route param /campaigns/uploads/:promotionCode. The converter's file is <PromotionCode>.xlsx and
     the locale's "the proposed DealCode" becomes "the proposed PromotionCode".
   - This wave adds NO npm dependency. If a slice looks like it needs one, that is a BLOCKER.
   - Grouping is not publishing: no promotion door writes a version or asks approval; there is NO
     promotion budget and NO promotion-wide disable (out of scope - do not add a button for either).
     "Uploaded" is read from origin === 'upload' PLUS the <promotionCode>- id prefix, never origin alone.
     The no-promotion row is told by promotionCode: null, never by origin (a stray code row has
     origin: null and gets no kind). windowUntil is the INCLUSIVE last day, shown as sent.
   - 535 RETIRES 524's composed list: composeCampaignList (src/core/rules/campaign-list.ts + its test),
     ruleCampaignApi.list()/ruleCampaignsQuery, CampaignListPage, list/columns.tsx and list-filter.ts go.
     CreateCampaignDialog.tsx and FromTemplate.tsx live in features/campaigns/list/ today and move to
     the no-promotion page: MOVE the files into features/campaigns/promotions/ (git mv) - the
     promotions feature may not import from features/campaigns/list. If the list folder ends empty,
     delete it and its route/menu wiring. A test you delete with retired code is a deletion you name
     in the commit; a test that still describes live behaviour is moved, not deleted. Priority keeps its reads: move the
     composition INTO features/campaigns/priority/ as Priority's own reader (a feature may not import
     a feature, and core must not keep a "campaigns list" nobody but Priority reads). The id
     pre-check in CreateCampaignDialog / FromTemplate / CopyCampaignDialog goes (ruled default:
     HQ's 409 RULES_CAMPAIGN_EXISTS, already shown, is the guard). Every mutation that invalidated
     RULE_CAMPAIGNS_KEY / ruleCampaignsQuery invalidates the promotions queries instead - grep for
     every invalidation site, a missed one leaves a stale list and passes every gate.
   - 534's open question (the old list's state tiles) is ruled by its default: they go with the flat
     list. 535's open question (no id pre-check) is ruled by its default. Do not re-litigate either.
   - BO ask J (BackOffice 2855) is OPEN, NOT built: the row's promotionCode and budgets and the page's
     withBudget are typed OPTIONAL. The "with a budget" tile is hidden when withBudget is absent; a
     direct link to a campaign (537) without the list context uses the fallback (crumb
     Promotions > <campaign>, back to /campaigns, Prev/Next hidden) - build the ask-J path behind the
     optional field AND prove the fallback; never guess a number.
   - 537: the crumb is derived from the menu in layout/crumb.ts - add the promotion segment THERE
     (extend crumb.test.ts), never a crumb per screen. The list context lives in the workspace URL and
     must survive every page of the workspace's own menu. The uploaded-campaign note on the Rules page
     is a note, not a lock.
   - 536: refusals show IN THE DIALOG that made the call (HQ message + code + one line per detail),
     the promotion unchanged. Assign/Unassign are all or none, at most 2,000 ids. After every write
     refresh the list query and BOTH sides of a move (and no-promotion).
   - The doors answer a BARE 403 with no body when the session lacks the grant, and there is NO
     access probe. Every door call must render "you do not have access to this action" on it, never
     an empty list. Do not invent a probe or hide buttons by guessed role.
   - Drives: 539 extends tools/campaign-uploads-drive.mjs (rename only, checks unchanged in meaning).
     534 CREATES tools/campaign-promotions-drive.mjs; 535 and 536 each ADD a section below the previous
     one and leave earlier checks unchanged. 535 re-cuts tools/campaigns-drive.mjs where it read the
     flat list (reasons in the ticket); 537 adds its checks to tools/campaigns-drive.mjs.
     tools/campaigns-fixtures.mjs is shared by campaigns-, priority-, sessions- and simulator-drive:
     extend it additively, and 535 must leave tools/priority-drive.mjs green (Priority keeps its reads).
     Stub on the REAL envelope { statusCode, success, message, errors: [{ errorCode, internalErrorCode,
     errorMessage }], data } with fields EXACTLY as the 2737 brief's promotions section names them.
     Every drive runs LTR and RTL.
   - Counts per mechanic come from a map (mechanics: { [mechanic]: count }); render every key it holds,
     builder and unknown ones included. Closed lists (state, origin, uploadState, status) are string
     unions plus string, never an enum that drops an unlisted value; an unknown state renders disabled.
   - Ranges (windowFrom-windowUntil) go through formatRange and are isolated ONCE; "+N pending",
     "3 assigned, 1 moved from X" and pager counts are words with each value isolated (formatCount for
     n / m). Grids spread the core base.
   - The governing brief, the contract section, 2862 and the ADR live in the OTHER repository
     (C:\Work\DMSCO\BackOffice). You may READ them and any ticket they name (2846, 2847, 2855, 2862) and
     the server code (RulePromotionWebEndpoints.cs, RulePromotionAuthoringService.cs,
     RuleCampaignUploadWebEndpoints.cs) to confirm a field. You may NOT edit, stage, commit or run
     anything in that repository. If you believe something there is wrong, log it to the HITL doc and
     carry on with your slice.
   - The doors ARE built but not deployed anywhere you can reach. Build against the contract section's
     shapes field for field; where the brief and the server code disagree, the server code (the
     reply/body types in RulePromotionWebEndpoints.cs) wins - log the difference to the HITL doc.
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
   - To STOP that vite server, kill ONLY the PID that owns the port:
     Get-NetTCPConnection -LocalPort 5199 -State Listen | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
     NEVER match processes by CommandLine (e.g. '*vite*' or '*5199*'): your own claude.exe command
     line contains this brief, so a CommandLine match kills YOU and the slice is lost uncommitted.
   - Never background a command or end your turn to "wait" for one: run drives in the foreground.
   - If a drive genuinely cannot run (it needs a live SIS.Api that is not up, or Playwright does
     not resolve), that is an OUTSTANDING PROOF, not a blocker and never something to fake: stub
     the network at Playwright where the ticket allows it, otherwise leave the Proof box unticked,
     say exactly why in the ticket, and finish the rest of the slice.
   - Pre-existing baseline for this wave, measured when this runner was generated -
     anything at or below this is NOT yours to fix:
     * npm run typecheck: CLEAN. Any error you see is yours.
     * npm test: CLEAN - 344 files, 5696 tests, all passing. Any failure is yours.
     * npm run lint: all four gates CLEAN (boundaries, grid base, contrast, palette).
7. Proof checkboxes marked OWNER, manual-smoke, or needing a live backend are NOT yours: leave them
   unchecked, list them as outstanding in the ticket, and never fake or simulate them. In this wave
   that is nothing inside 539 and 534-537 (every door is stubbed); the live walks are tickets 533 and 538, which are not in this run, and 539 deploys together with BackOffice 2862 (a deploy, not a proof box). Anything resting on BO ask J (2855, unbuilt) is proven on its fallback and the optional-field path is stubbed. The ticket may still complete AFK with those open; every OTHER
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

    if ($ResumeDirty -and $t -eq $Tickets[0]) {
        $afkProtocol += "`n`nRESUMING: a previous session on ticket $t was killed (memory reaper) just before it committed. Its work is ALREADY IN THE WORKING TREE (tracked changes plus any new untracked files; a backup may be .afk\partial-$t.patch). Do NOT start over and do NOT discard that work: read the diff, check it against the ticket, finish what is missing, re-run typecheck/test/lint/build and the drive, then close the ticket and commit. Do not commit the .afk backup files."
    }
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
        Say "    .\run-implements-spec2848.ps1 -Tickets $(($Tickets | Where-Object { $_ -ne $t }) -join ',')" "Yellow"
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

You are reviewing ONLY the diff introduced by ticket $t of BackOffice brief 2848 / ticket 2862 (promotions): git diff $baseSha...HEAD.
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
  BackOffice 2862 renamed deal to promotion and the server is built: the word "deal" must not survive
  in src or tools (git grep -i -w deal), doors are Rules/Authoring/Promotions/*, wire field
  promotionCode, refusals RULES_PROMOTION_*; the original ticket text saying "deal" / "never promotion"
  is dead, the 2848 promotions brief wins. The bonus-buy engine's promotion (bby features, BbyPromotion,
  CONTEXT.md's bonus-buy lines) must be UNTOUCHED - a rename that reached there is SERIOUS. 539 is a
  pure rename with no behaviour change. Model core/models/rule-promotion.ts, feature
  features/campaigns/promotions, namespace campaign-promotions EN only, routes /campaigns/promotions/:promotionCode
  and /campaigns/no-promotion, menu leaf Promotions, crumb in layout/crumb.ts. Fields exactly as the
  2737 brief's promotions section (server types in RulePromotionWebEndpoints.cs win); closed lists are
  unions plus string; uploaded = origin upload AND the id prefix; no-promotion row by promotionCode null;
  windowUntil inclusive as sent; no promotion budget or promotion-wide disable. 535: the composed list
  is gone everywhere but Priority's own reader inside features/campaigns/priority, every old
  invalidation site now invalidates the promotions queries, moved dialogs are moved not imported
  across features, no live test silently deleted. BO ask J fields optional with a proven fallback.
  A bare 403 renders as no access, never as empty; refusals in the calling dialog; ranges/counts
  isolated once; drives extended per ticket on the real envelope, LTR and RTL; Proof boxes honest.

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
Say "Brief 2848 promotions wave (with the 2862 rename) complete. Read .afk\REVIEW-*.md and .afk\HITL-*.md before trusting the results." "Green"
Say ">>> 539 must DEPLOY TOGETHER with BackOffice 2862: the upload screens now speak promotionCode, and an old SIS.Api answers dealCode. <<<" "Yellow"
Say ">>> Still outstanding: tickets 533 and 538, the live walks - BackOffice 2846/2847/2862 deployed, HQ scripts 015-018 run, an author plus a different approver. <<<" "Yellow"
Say ">>> BO ask J (BackOffice 2855) is unbuilt: the budget tile and a direct link's promotion lookup run on their fallback until it lands. <<<" "Yellow"
Say ">>> Merge spec/2848-promotions into main from C:\Playground\oms-react once the reviews read clean; then remove the worktree. <<<" "Yellow"
