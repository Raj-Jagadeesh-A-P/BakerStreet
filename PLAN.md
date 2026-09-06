# Refactor Plan: Cases, Sub-Files & Ranked Closing

## Confirmed model decisions
- **Progression:** Admin opens each Case globally (`LOCKED → OPEN`); opening the next Case closes the current one (`OPEN → CLOSED`).
- **Closing a Case:** entered after all Case Sub-Files are solved; one final answer, **auto-checked** (no human judging).
- **Scoring:** per-sub-file points (as today) **+ podium bonus** for the 1st/2nd/3rd teams who close each Case. Defaults 300/200/100, configurable per Case.
- **Winner:** highest **total points** across Cases.
- **Identity:** theme only — each participant picks a persona at onboarding (`PRIVATE_CLIENT | SCOTLAND_YARD | MYCROFT_HOLMES`); displayed as a badge; no gameplay effect.

## Terminology
| concept | now called |
|---|---|
| Event (container per series) | **Investigation** (public copy); DB name `events` stays |
| event's "case" (one Q&A) | **Case** (framed competition: plot, sub-files, closing answer) |
| inside a Case | **Case Sub-Files** (Q&A puzzles, unlocked sequentially) + **Closing challenge** (final answer) |

## Data model (`server/src/db/repo.js`)
- `events`: unchanged shape (status, code, timer, team size, `durationMinutes`).
- `cases/{caseId}` — the Case: `eventId, order, title, plot, status: LOCKED|OPEN|CLOSED, startsAt, closedAt, closing{answers}, podium{1st,2nd,3rd,participation}, closureCount, subFileCount`.
- `cases/{caseId}/subfiles/{subFileId}` — current `cases[*]` fields (`order,title,story,question,type,answers,evidence,hints,points,wrongPenalty,maxAttempts,published`).
- `submissions`: `{eventId, caseId, fileId, teamId, type, answer, correct, createdAt}`.
- `closings`: `{eventId, caseId, teamId, rank, closedAt, bonus}`; rank assigned in a transaction (count+1).
- `scoreEvents`: reasons `solved-file`, `hint`, `wrong-penalty`, `closed-case-p1/2/3`, `closed-case-participation`.
- `users`: `+ identity`.

## Server changes
- `services/unlock.js` → `computeSubFileStates` + `canAttemptClosing` + case `isOpen`; strict-sequential repair so stale/in-hole solved sets can never dead-end "already completed".
- `services/scoring.js` → `applyPodium` (rank transaction).
- `caseController.js` → split into `subFileController` (GET/submit/hint) + `closingController` (state/close).
- `eventController.dashboard` → current Case + sub-file states + closing state + continue pointer from one computed state object.
- Remove `finalController.js` and `adminFinalController.js`.
- `adminCaseController` → Case CRUD + Start/Close + sub-file CRUD; CSV export updated.
- `config.js` → `DEFAULT_PODIUM`, new MESSAGES.

## Client changes
- Rename/copy: Event→Investigation, Cases, Case Sub-Files.
- `Register.jsx`/`JoinEvent.jsx`: persona picker.
- `Dashboard.jsx`: current Case view (sub-file list, closing challenge, podium, timer, persona).
- `CaseView.jsx`: single sub-file; next target from server computed state; solved targets skipped, never "already completed" dead-end.
- `Final.jsx` → Closing challenge: auto-checked final answer, shows rank + bonus.
- `Leaderboard.jsx`: totals + per-case closing ranks + persona tags.
- Admin: Cases list + per-Case Start/Close; Case editor incl. sub-files; `AdminSubmissions` generalized; remove `AdminFinals`.

## Bonus fixes
- Reject duplicate team names per event (two "Leo" teams spotted in OSD2026).

## Tests & data
- Rewrite `server/test/api.test.js`: case-open gating, sub-file sequential lock, closing locked until all files, podium ranks 1/2/3 concurrency, winner by totals, identity stored.
- Rewrite `server/scripts/seed.js` + `server/seed/cases/*`.
- Reseed fresh Investigation for `bakerstreet-b4f95`; `npm run prod` smoke.

## Defaults (assumed unless told otherwise)
- New collections start fresh; old demo data left untouched (not migrated).
- Non-podium closers get no participation points (0, configurable).
- Sub-file submits reject once a Case is `CLOSED`.