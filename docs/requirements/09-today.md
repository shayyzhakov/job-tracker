# 09. Tasks (action queue)

Status: **Built**

The app answers "whose move is it?" for every open application, and puts what the user owes first.

## States

Each open application is in one state: **your move**, **scheduled** (an interview is on the calendar), **their move** (waiting on the employer) or **stale** (their move, but the wait ran out, so it turns into a follow-up for the user). Closed applications are never shown.

## Rules (defaults live in `packages/shared/src/actions/rules.ts`)

| Situation                         | Whose move | Card                                                                                                                       |
| --------------------------------- | ---------- | -------------------------------------------------------------------------------------------------------------------------- |
| To apply                          | You        | Apply or drop; amber after 3 days, red after 7                                                                             |
| On hold                           | Nobody     | No card: parked on purpose, so there is no "apply or drop" warning and it never goes stale                                 |
| Applied                           | Them       | Follow up after 14 days                                                                                                    |
| Interview stage, no real time yet | You        | Schedule or confirm; amber after 2 days. "They're scheduling" hands over (3-day timer)                                     |
| Interview upcoming                | Scheduled  | Listed under scheduled                                                                                                     |
| Interview held, not debriefed     | You, once  | Log how it went, from the day after                                                                                        |
| After an interview                | Them       | Follow up after 7 days (5 after a final interview)                                                                         |
| Home assignment not submitted     | You        | Ranked by its due date; amber 3 days after it was received without one; stays your move even if a later round is scheduled |
| Home assignment submitted         | Them       | Follow up 7 days after its submitted date                                                                                  |
| Offer                             | You        | Ranked by expiry; red after 5 days without one                                                                             |

- **Reply-by date.** If the employer gave a date after the current round, it replaces the default timer. It is taken from the current round only (see [13](13-round-timeline.md)), so an earlier round's date stops counting once a later round is scheduled.
- **Follow-ups.** "Followed up" restarts a 7-day timer. After the second unanswered follow-up the card asks whether to mark the application ghosted.
- **Snooze, not dismiss.** Snoozed cards move to the waiting list and return on their own at their previous urgency. A status change, and scheduling or adding an interview, clears hand-overs and snoozes and restarts the wait. A round's reply-by and due date live on that round and are not reset.
- **One card per application**, most urgent wins. Low-priority nudges are capped at five on screen; deadlines are never hidden.
- **Ranking:** deadlines, overdue, soon, nudges; the earliest date first within each group.

## Surfaces

- **Tasks** is the landing page: cards grouped by urgency, a collapsed list of scheduled interviews and of applications waiting on others (with their next check-in date), and an empty state ("You're clear").
- A badge on the Tasks nav item shows how many actions need the user; it turns red when any is overdue.
- The application page shows the **Log how it went** prompt as a banner at the top while a held interview needs a debrief (the same `debrief` action as the Tasks card). Its dialog takes the text (saved as a note on that interview) and an optional reply-by date, and saving it marks the interview debriefed, so the prompt clears without the user knowing that a plain note does not. See [10](10-interview-notes.md).
- In the applications list, a red marker on a row flags the applications that need the user.
- Each interview round carries its own **next step**, **they'll reply by**, and for home assignments **due by** and **submitted** (interview form, MCP `schedule_interview` / `update_interview`, and the status-change call); an offer carries **offer expires** (application form while at offer, the offer dialog, MCP `update_application` / `change_application_status`). See [13](13-round-timeline.md).
- The **Interviews scheduled** list shows each round's next step under it. "Mark submitted" on a home-assignment card sets the round's submitted date.
- Claude (MCP): `get_actions`, `snooze_application`, `hand_over_application`.

## Not included

Email or Slack digests, drafted follow-up messages, a pace nudge for the whole search, and pausing timers over holidays.
