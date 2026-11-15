# 13. Round timeline

Status: **Planned**

## Goal

An application's **timeline** (when they said they'd reply, the user's deadline, and a note on what to do next) describes one step of the process, not the whole application. Today these are three fields on the application (`replyBy`, `dueAt`, `nextStep`, edited in the "Timeline" card of the application form), so they drift:

- **The next step outlives its round.** "Prepare the system design questions" is still shown after the technical interview, during the next round. Nothing ever clears it.
- **Reply-by and deadline are cleared at the wrong moment.** They are reset when the _next_ round is scheduled, not when the round they described ends, and they have to be typed in again for every round.
- **One deadline, two meanings.** The same field is the home-assignment due date and the offer expiry, and the form offers a deadline for a phone call, where it means nothing.

This requirement moves the timeline onto the step it describes. Each interview round (see [02](02-contacts-and-interviews.md)) carries its own values, and only the **current step's** values are shown or used. Old values stop mattering on their own; nothing has to remember to clear them.

## Requirements

1. **Fields per step.** What a step can carry depends on its type and on whether it has ended:

   | Step                                                                                                                              | Before it ends               | It ends when                                     | After it ends    |
   | --------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- | ------------------------------------------------ | ---------------- |
   | **Live round**: coffee chat, HR, phone, technical, system design, onsite, managerial, final, home assignment review, other        | Next step (prep note)        | its time plus its duration (60 minutes if unset) | They'll reply by |
   | **Home assignment**                                                                                                               | Next step, **due by**        | the user marks it submitted                      | They'll reply by |
   | **Offer** (a milestone, not a round)                                                                                              | Offer expires                | the user accepts, declines or it closes          | none             |
   | **To apply, applied** (milestones)                                                                                                | none                         | none                                             | none             |

   - A home assignment's time is **when it was received**; its due date and submitted date are separate. "Due by" and "submitted" exist only on home assignments: the API rejects them on any other type, and changing a round's type away from home assignment clears them.
   - **Next step exists only on rounds.** Milestones have no next-step note (the Tasks queue already says what to do for them).
   - **Applied loses "they'll reply by".** The default 14-day follow-up timer and snooze cover it.
   - **The offer expiry stays on the application** (renamed `offerExpiresAt`), because an offer is a milestone with no interview behind it. It is used only while the status is offer.

2. **The current step** follows the same rule as the status shown (see "Status" in [01](01-applications.md)): an offer (or a closed outcome) wins; otherwise the next upcoming round; otherwise the latest round held; otherwise the milestone. Only the current step's fields appear on the application and feed the Tasks queue. Values on other rounds stay on those rounds.
   - **Exception:** a home assignment that is not submitted stays the user's move even when another round is scheduled after it, so its due date is never hidden.

3. **A round ending is automatic.** There is no job and nothing is cleared. Once the round's end passes, its next step is no longer current: it stays on the round's card (shown muted, as history) and the round shows "They'll reply by" instead. A home assignment ends only when it is marked submitted, whatever its received time.

4. **Web.**
   - The **Timeline card is removed** from the application form. The timeline is edited on the round.
   - **Interview form:** next step (any round, any time), due by and a "Mark submitted" action (home assignment only), and they'll reply by (once the round has ended; the "log how it went" prompt also offers it).
   - **Application page:** a **Current step** line in the summary replaces today's "Reply expected by", "Your deadline" and "Next step" rows: the round and its date, then whichever of next step, due by and they'll reply by applies now. While the status is offer it shows the expiry. Each interview card shows its own values; past rounds show them muted.
   - **Choosing a round as the status** asks for the next step (and the due date for a home assignment) along with the time; **choosing offer** asks for the expiry.
   - **Tasks:** the scheduled list shows a round's next step under the interview.

5. **Tasks queue** (changes to [09](09-today.md)):
   - The home-assignment card ranks by the open assignment's due date (amber after 3 days without one, as today).
   - "Submitted" sets the assignment's submitted date instead of a general hand-over; the follow-up timer runs from it.
   - "They said they'd reply by" comes from the current round and replaces the default timer, as today.
   - The offer card ranks by the offer expiry.
   - Scheduling or adding a round still restarts the wait (hand-over, snooze, follow-ups), but no longer resets a reply-by or deadline: those belong to rounds now.

6. **API and assistant (MCP).**
   - `schedule_interview` and `update_interview` take `nextStep`, `replyBy`, and for home assignments `dueAt` and `submittedAt`.
   - `update_application` drops `replyBy`, `dueAt` and `nextStep`, and takes `offerExpiresAt`.
   - `change_application_status` takes `nextStep` (and `dueAt` for a home assignment) for a round, which go on the interview it creates, and `offerExpiresAt` for offer.
   - `hand_over_application` with reason `submitted` sets `submittedAt` on the open home assignment.
   - `get_application` and `get_actions` report the current step and its fields.

7. **Data model.**
   - INTERVIEW gains optional `nextStep`, `replyBy`, `dueAt` and `submittedAt` (the last two home assignment only).
   - APPLICATION loses `replyBy`, `dueAt` and `nextStep`, and gains optional `offerExpiresAt`.
   - No new keys, indexes or transactions.
   - **Existing values are dropped**, not carried over: a one-off script removes the three old attributes (run locally and in prod, then deleted, like the earlier status migration). The user re-enters what still matters on the round.

8. **Docs to update when built:** `DATA-MODEL.md` (ERD for APPLICATION and INTERVIEW), the "Item types" and action-queue lines of `ARCHITECTURE.md`, a Key decision ("Timeline fields belong to rounds, not applications"), [02](02-contacts-and-interviews.md), [09](09-today.md) and this file's status.

## Not included

Reminders or notifications at a due time, a next-step note for milestones, contacts per round, and carrying the current application-level values over.
