# 13. Round timeline

Status: **Built**

## Goal

An application's **timeline** (when they said they'd reply, the user's deadline, and a note on what to do next) describes one step of the process, not the whole application. These used to be three fields on the application, edited in a "Timeline" card of the application form, and they drifted:

- **The next step outlived its round.** "Prepare the system design questions" was still shown after the technical interview, during the next round. Nothing ever cleared it.
- **Reply-by and deadline were cleared at the wrong moment.** They were reset when the _next_ round was scheduled, not when the round they described ended, and had to be typed in again for every round.
- **One deadline, two meanings.** The same field was the home-assignment due date and the offer expiry, and the form offered a deadline for a phone call, where it means nothing.

The timeline now sits on the step it describes. Each interview round (see [02](02-contacts-and-interviews.md)) carries its own values, and only the **current step's** values are shown or used. Old values stop mattering on their own; nothing has to remember to clear them.

## Requirements

1. **Fields per step.** What a step can carry depends on its type and on whether it has ended:

   | Step                                                                                                                       | Before it ends        | It ends when                                     | After it ends    |
   | -------------------------------------------------------------------------------------------------------------------------- | --------------------- | ------------------------------------------------ | ---------------- |
   | **Live round**: coffee chat, HR, phone, technical, system design, onsite, managerial, final, home assignment review, other | Next step (prep note) | its time plus its duration (60 minutes if unset) | They'll reply by |
   | **Home assignment**                                                                                                        | Next step, **due by** | it is marked submitted                           | They'll reply by |
   | **Offer** (a milestone, not a round)                                                                                       | Offer expires         | the user accepts, declines or it closes          | none             |
   | **To apply, on hold, applied** (milestones)                                                                                | none                  | none                                             | none             |
   - A home assignment's time is **when it was received**; its due date and submitted date are separate. "Due by" and "submitted" exist only on home assignments: the API rejects them on any other type (400), and changing a round's type away from home assignment clears them.
   - **Next step exists only on rounds.** Milestones have no next-step note (the Tasks queue already says what to do for them).
   - **Applied has no "they'll reply by".** The default 14-day follow-up timer and snooze cover it.
   - **The offer expiry stays on the application** (`offerExpiresAt`), because an offer is a milestone with no interview behind it. It is used only while the status is offer, and any other status change clears it.

2. **The current round** is the one whose timeline counts. For an open application that is not at offer, in order:
   1. A home assignment received and not submitted. It stays the user's move even when another round is scheduled after it, so its due date is never hidden. One followed by a live round already held counts as done.
   2. Otherwise the next live round still ahead (or in progress).
   3. Otherwise a round without a real time yet, if it was added after the last round ended.
   4. Otherwise the round that ended last.

   An offer shows its expiry instead, and closed applications have no current step. The application detail returns it as `currentRound` (the interview and its phase: upcoming, unscheduled, open or ended). Values on other rounds stay on those rounds as history.

3. **A round ending is automatic.** There is no job and nothing is cleared. Once the round's end passes, its next step is no longer current: it stays on the round's card (muted) and the current step shows "They'll reply by" instead. A home assignment ends only when it is marked submitted, whatever its received time.

4. **Web.**
   - The **Timeline card is gone** from the application form. While the status is offer, the form has an **Offer expires** field instead.
   - **Current step** panel at the top of the application page: the current round, its phase and date, then whichever applies now: next step (upcoming or no time yet), due by and next step with a **Mark submitted** button (open home assignment), or submitted date and they'll reply by (ended). At offer it shows the expiry.
   - **Interview form:** next step on any round; received, due by and (when editing) submitted on a home assignment; they'll reply by when editing a round that has ended. Each interview card shows its own due date, next step (muted once the round has ended) and reply-by.
   - **Choosing a round as the status** asks for the next step along with the time, and for a home assignment the received time and due date. **Choosing offer** asks for the expiry (optional).
   - **Tasks:** the scheduled list shows a round's next step under the interview.

5. **Tasks queue** (see [09](09-today.md)):
   - The home-assignment card ranks by the open assignment's due date; without one it turns amber 3 days after the assignment was received.
   - "Mark submitted" sets the assignment's submitted date; the follow-up timer runs from it.
   - "They said they'd reply by" comes from the current round and replaces the default timer.
   - The offer card ranks by the offer expiry.
   - Scheduling or adding a round still restarts the wait (hand-over, snooze, follow-ups) but no longer resets any reply-by or deadline: those belong to rounds.

6. **API and assistant (MCP).**
   - `schedule_interview` and `update_interview` take `nextStep`, `replyBy`, and for home assignments `dueAt` and `submittedAt`.
   - `update_application` takes `offerExpiresAt` (no reply-by, deadline or next step).
   - `change_application_status` takes `nextStep` (and `dueAt` for a home assignment) for a round, which go on the interview it creates, and `offerExpiresAt` for offer.
   - `hand_over_application` with reason `submitted` sets `submittedAt` on the open home assignment (with none open, it records a plain hand-over as before).
   - `get_application` returns `currentRound`; `get_actions` returns each scheduled round's `nextStep`.

7. **Data model.**
   - INTERVIEW has optional `nextStep`, `replyBy`, `dueAt` and `submittedAt` (the last two home assignment only).
   - APPLICATION has optional `offerExpiresAt` and no longer has `replyBy`, `dueAt` or `nextStep`.
   - No new keys, indexes or transactions.
   - **Existing values were dropped**, not carried over: `pnpm db:migrate-round-timeline` removes the three old attributes from every application, and marks a home assignment already handed over (the latest one received before the application's hand-over) as submitted at that time, so it does not come back as "submit your assignment". Idempotent; run once per environment.

## Not included

Reminders or notifications at a due time, a next-step note for milestones, contacts per round, setting a reply-by from the "log how it went" card on Tasks (it is set on the interview), and carrying the old application-level values over.
