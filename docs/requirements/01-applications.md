# 01. Applications

Status: **Built**

- Create, view, edit and delete job applications. Each has a company, role name, IC or management flag, status, listing URL, expected monthly gross salary in ILS, source, notes and applied date.
- Companies are shared between applications and deduplicated by case-insensitive name. Each company has a size (early-stage startup, startup, scale-up, corporate), public or private flag, website and location. Companies can also be managed on their own, including ones with no application, on the Companies page (see [11](11-companies.md)).
- **Status pipeline:** to apply → applied → HR screening → phone → technical → home assignment → onsite → managerial → final → offer → accepted. The closed outcomes are accepted, rejected, withdrawn and ghosted.
- **Status groups.** Every status belongs to exactly one group, which says how far the application got:

  | Group       | Statuses                                                              | Meaning                                                                                        |
  | ----------- | --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
  | **Initial** | to apply, applied                                                     | Nothing has happened with the employer yet: not applied, or applied and no interview.          |
  | **Active**  | HR screening, phone, technical, home assignment, onsite, final, offer | The process is moving: an interview is scheduled or has happened, or an offer is on the table. |
  | **Closed**  | accepted, rejected, withdrawn, ghosted                                | The process ended.                                                                             |

  Grouping is by the displayed status (below), so an application with a scheduled or past round is always Active. **Open** means Initial or Active (everything not closed); the rest of the app uses it for "still in play" (action queue, dashboard KPI, Companies counts).

- **Displayed status: what's next, otherwise what was last.** The status shown for an application (list, pipeline, stage bar, filters, counts) answers "where does this stand right now?":
  1. **An upcoming interview wins.** If an open application has an interview scheduled in the future, it shows that interview's stage (for example Technical), with the interview's date and time under it. The round that just passed no longer matters once the next one is lined up. If several are scheduled, the earliest one with a stage counts.
  2. **Otherwise the last real step.** With nothing scheduled, the application shows the last step that happened (the latest entry in the status history). So after a round that has passed, and while you wait for the company's answer, it keeps showing that round.
  3. **Every interview with a stage counts** (HR, phone, technical or system design, home assignment, onsite, managerial, final). Home assignment review, coffee chat and other have no stage: they never change the displayed status, but when one is the next thing scheduled, the date line under the badge names it (for example "Other · 12 Nov, 10:00"). The displayed status may therefore go back to an earlier stage when the next scheduled round is earlier than one already passed (for example another phone call after a technical interview).
  4. **It follows the calendar.** Removing a scheduled interview, or moving it, changes the displayed status accordingly; the status history is not rewritten. When a scheduled interview's time passes and nothing new is scheduled, the application simply shows that round as the last step.
  5. **Not affected:** to apply and applied (nothing scheduled yet), offer, and the closed outcomes always show as recorded; a closed application never shows an upcoming round.

- **Repeated steps:** the same status can occur more than once in a row (for example two phone interviews, one after the other). Choosing the current status again from the dropdown does nothing, but "Add another \<status\> step" on the application page records a new history entry (phone → phone). The API accepts `repeat: true` on the status change for this, and the assistant tool `change_application_status` does too. Each step shows separately in the status history, and each round stage creates its own interview (see requirement 02). A repeated step never changes the applied date.
- Every status change is recorded in a status history, which keeps what actually happened; the displayed status is derived from it plus the scheduled interviews. Moving to an interview-round status also creates the interview, which is how a round appears once on the timeline (see requirement 02). The applied date is set automatically the first time an application leaves "to apply".
- In the applications list the status cell holds the badge and, when a round is scheduled, its date and time below it (there is no separate "Next interview" column). The list can be filtered by status group (a multi-select dropdown: Initial, Active, Closed; Initial and Active selected by default, so all open applications; selecting nothing or all three shows everything), and searched by company or role.
