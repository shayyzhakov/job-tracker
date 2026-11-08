# 09. Tasks (action queue)

Status: **Built**

The app answers "whose move is it?" for every open application, and puts what the user owes first.

## States

Each open application is in one state: **your move**, **scheduled** (an interview is on the calendar), **their move** (waiting on the employer) or **stale** (their move, but the wait ran out, so it turns into a follow-up for the user). Closed applications are never shown.

## Rules (defaults live in `packages/shared/src/actions/rules.ts`)

| Situation                         | Whose move | Card                                                                                   |
| --------------------------------- | ---------- | -------------------------------------------------------------------------------------- |
| To apply                          | You        | Apply or drop; amber after 3 days, red after 7                                         |
| Applied                           | Them       | Follow up after 14 days                                                                |
| Interview stage, no real time yet | You        | Schedule or confirm; amber after 2 days. "They're scheduling" hands over (3-day timer) |
| Interview upcoming                | Scheduled  | Listed under scheduled                                                                 |
| Interview held, not debriefed     | You, once  | Log how it went, from the day after                                                    |
| After an interview                | Them       | Follow up after 7 days (5 after a final interview)                                     |
| Home assignment not submitted     | You        | Ranked by the deadline; amber after 3 days without one                                 |
| Home assignment submitted         | Them       | Follow up after 7 days                                                                 |
| Offer                             | You        | Ranked by expiry; red after 5 days without one                                         |

- **Reply-by date.** If the employer gave a date, it replaces the default timer.
- **Follow-ups.** "Followed up" restarts a 7-day timer. After the second unanswered follow-up the card asks whether to mark the application ghosted.
- **Snooze, not dismiss.** Snoozed cards move to the waiting list and return on their own at their previous urgency. A status change clears hand-overs, snoozes and the reply-by / deadline.
- **One card per application**, most urgent wins. Low-priority nudges are capped at five on screen; deadlines are never hidden.
- **Ranking:** deadlines, overdue, soon, nudges; the earliest date first within each group.

## Surfaces

- **Tasks** is the landing page: cards grouped by urgency, a collapsed list of scheduled interviews and of applications waiting on others (with their next check-in date), and an empty state ("You're clear").
- A badge on the Tasks nav item shows how many actions need the user; it turns red when any is overdue.
- In the applications list, a red marker on a row flags the applications that need the user.
- Applications carry optional **reply by**, **your deadline** and **next step** fields (edit form, MCP `update_application`, and the status-change call).
- Claude (MCP): `get_actions`, `snooze_application`, `hand_over_application`.

## Not included

Email or Slack digests, drafted follow-up messages, a pace nudge for the whole search, and pausing timers over holidays.
