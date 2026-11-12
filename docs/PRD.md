# Job Tracker: product requirements

A personal tracker for a job search in the Israeli tech market. One user. It is available online and can also run locally.

For the technical design see [ARCHITECTURE.md](ARCHITECTURE.md).

Status: **Built** means it's in the codebase. **Planned** means it's agreed but not built.

| #   | Requirement                                                           | Status                           |
| --- | --------------------------------------------------------------------- | -------------------------------- |
| 01  | [Applications](requirements/01-applications.md)                       | Built                            |
| 02  | [Contacts and interviews](requirements/02-contacts-and-interviews.md) | Built                            |
| 03  | [Overview dashboard](requirements/03-overview-dashboard.md)           | Built                            |
| 04  | [AI opportunity scout](requirements/04-ai-opportunity-scout.md)       | Built (watchlist boards Planned) |
| 05  | [Claude integration](requirements/05-claude-integration.md)           | Built                            |
| 06  | [Authentication and access](requirements/06-authentication.md)        | Built                            |
| 07  | [Non-functional requirements](requirements/07-non-functional.md)      | Ongoing                          |
| 08  | [Gamification](requirements/08-gamification.md)                       | Built (optional layer)           |
| 09  | [Tasks (action queue)](requirements/09-today.md)                      | Built                            |
| 10  | [Interview notes](requirements/10-interview-notes.md)                 | Built                            |
| 11  | [Companies](requirements/11-companies.md)                             | Built                            |
| 12  | [Company priority](requirements/12-company-priority.md)               | Built                            |

## Core idea: what an application's status means

The applications view shows only what the user needs to know right now, so an application's status answers "where does this stand now?", not "what was the last thing recorded?".

- **Interviews drive the status.** While an interview round is upcoming, the application shows that round, even if an earlier round has just passed: the previous round no longer matters once the next one is lined up. With nothing scheduled, it keeps showing the last round that was held (the user is waiting on the company).
- **Only milestones are set by hand.** To apply, applied, offer and the closed outcomes (accepted, rejected, withdrawn, ghosted) are chosen by the user. Interview rounds (coffee chat, HR, phone, technical, home assignment, onsite, managerial, final) are never set on their own: choosing one in the app schedules or logs that interview. A round status therefore cannot exist without a real interview behind it.
- **Offers and closed outcomes always win.** Once an application has an offer or is closed, it shows that, whatever interviews exist.

Details: [01 Applications](requirements/01-applications.md) and [02 Contacts and interviews](requirements/02-contacts-and-interviews.md).
