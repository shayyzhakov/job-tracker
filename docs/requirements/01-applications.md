# 01. Applications

Status: **Built**

- Create, view, edit and delete job applications. Each has a company, role name, IC or management flag, status, listing URL, expected monthly gross salary in ILS, source, notes and applied date.
- Companies are shared between applications and deduplicated by case-insensitive name. Each company has a size (early-stage startup, startup, scale-up, corporate), public or private flag, website and location. Companies can also be managed on their own, including ones with no application, on the Companies page (see [11](11-companies.md)).
- **Status pipeline:** to apply → applied → HR screening → phone → technical → home assignment → onsite → final → offer → accepted. The closed outcomes are accepted, rejected, withdrawn and ghosted.
- **Status groups.** Every status belongs to exactly one group, which says how far the application got:

  | Group       | Statuses                                                              | Meaning                                                                                        |
  | ----------- | --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
  | **Initial** | to apply, applied                                                     | Nothing has happened with the employer yet: not applied, or applied and no interview.          |
  | **Active**  | HR screening, phone, technical, home assignment, onsite, final, offer | The process is moving: an interview is scheduled or has happened, or an offer is on the table. |
  | **Closed**  | accepted, rejected, withdrawn, ghosted                                | The process ended.                                                                             |

  Scheduling an interview moves the status forward to that round (see [02](02-contacts-and-interviews.md)), so an application with a past or scheduled round is always Active. Grouping is by status alone. **Open** means Initial or Active (everything not closed); the rest of the app uses it for "still in play" (action queue, dashboard KPI, Companies counts).
- **Repeated steps:** the same status can occur more than once in a row (for example two phone interviews, one after the other). Choosing the current status again from the dropdown does nothing, but "Add another \<status\> step" on the application page records a new history entry (phone → phone). The API accepts `repeat: true` on the status change for this, and the assistant tool `change_application_status` does too. Each step shows separately in the status history, and each round stage creates its own interview (see requirement 02). A repeated step never changes the applied date.
- Every status change is recorded in a status history. Moving to an interview-round status also creates the interview, which is how a round appears once on the timeline (see requirement 02). The applied date is set automatically the first time an application leaves "to apply".
- The applications list can be filtered by status group (a multi-select dropdown: Initial, Active, Closed; Initial and Active selected by default, so all open applications; selecting nothing or all three shows everything), and searched by company or role.
