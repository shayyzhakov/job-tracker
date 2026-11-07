# 08. Gamification

Status: **Built**

An optional layer that makes progress in the job search feel rewarding: XP and levels, daily streaks, achievements, quests, and a board view of applications. It sits on top of the tracker and never changes how the tracker works. It can be switched off at any time.

For the technical design and the rules for extending it see [ARCHITECTURE.md](../ARCHITECTURE.md#web-gamification-layer).

## Goals

- Make small, steady actions (apply, follow up, schedule) feel like progress, because job searches are long and mostly discouraging.
- Give the app a recognisable character without a heavy theme: minimal, polished, subtle motion.
- Cost nothing when off, and never get in the way of the core tracker.

## Non-goals

- No social features, leaderboards or sharing. One user.
- No real-money or external rewards.
- No penalties for inactivity beyond a streak resetting. Nothing is ever taken away from the tracker data.
- No sound or haptics (may be added later).

## Features

| Feature       | Behaviour                                                                                                                                                                                                                                                                                                                                                            |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| XP and levels | XP is derived from existing data: 5 per application added, 15 per application submitted, 10 per interview, 5 per contact, plus one-time rewards per application for reaching a stage (20 HR screening or phone, 30 technical or home assignment, 40 onsite or final, 100 offer, 200 accepted). Level _n_ starts at `40 × (n−1) × n` XP. Titles run Rookie to Legend. |
| Streaks       | A day counts when anything is added or changed: an application, a status change, an interview, a contact. Days are Israel time (`Asia/Jerusalem`). A streak survives until the end of the day after the last activity ("at risk" until something happens today). The longest streak is kept.                                                                         |
| Quests        | Daily: submit an application, move an application forward, add a contact. Weekly (last 7 days): submit 5 applications, line up an interview. Progress bars and check-offs on the overview.                                                                                                                                                                           |
| Achievements  | 13 badges in bronze, silver and gold tiers (first application, 10/25/50 submitted, first reply, interview reached, interview variety, networker, 3/7/30-day streaks, offer, accepted). Locked badges show progress.                                                                                                                                                  |
| Celebrations  | After a status change, interview, contact or new application: a "+N XP" toast, achievement and level-up toasts, and confetti (bigger for an offer, an accepted offer or a level-up). Nothing fires for what was already earned when the layer is first seen. Animations are skipped when the OS asks for reduced motion.                                             |
| Progress hero | On the overview: level ring, XP bar, streak, today's quests, weekly quests and the next achievements.                                                                                                                                                                                                                                                                |
| Header chip   | Level, XP bar and streak in the top bar. It links to the achievements page, which is the only entry to it (no sidebar item).                                                                                                                                                                                                                                         |
| Pipeline view | A Table / Pipeline switch next to the Applications title. The pipeline groups statuses into **To do**, **In progress** and **Done**, with each card's exact status as a badge. Drag a card between columns, or click its badge for an exact status. Dropping into Done asks how the application ended.                                                               |
| Stage bar     | On the application detail page: where the application is on the way from "to apply" to "accepted", or "Closed" for rejected, withdrawn and ghosted.                                                                                                                                                                                                                  |

## Controls

- **On/off in the app:** a switch on the achievements page; a small icon in the top bar turns it back on. Stored per browser. When off, nothing renders, no progress request is made and no effects run.
- **Build time:** `VITE_GAMIFICATION=false` on the web build removes the layer.
- **API:** `GAMIFICATION_ENABLED=false` (default `true`) removes `GET /api/v1/progress`; the web layer then stays hidden.

## Rules and limits

- Progress is **derived** from existing data and never stored by the layer. A consequence: deleting an application can lower XP.
- The only client state is "already celebrated" (achievements seen and last level) and the on/off switch, both in `localStorage`. They are not synced between devices.
- Core requirements (01 to 07) are unchanged by this layer. Turning it off must leave the tracker exactly as it was.

## Acceptance criteria

- With the layer off (any of the three switches), there is no gamification UI, no `/progress` request, and every core page and test behaves as before.
- XP, level, streak, quests and achievements are computed by pure, tested functions and agree between the overview, the header chip and the achievements page.
- Every application status appears in exactly one pipeline column, including any status added in the future (a test fails otherwise).
- A status change from the table, the pipeline board or the detail page produces the same rewards.
