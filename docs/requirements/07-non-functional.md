# 07. Non-functional requirements

- **Available anywhere:** the app is reachable online from the owner's phone and laptop, and can also run locally for development.
- **Low cost:** running costs should stay close to zero for a single user, with an alert if spending exceeds a monthly budget.
- **Data safety:** data can be restored to any point in the last 35 days.
- **One-command release:** a single command checks, tests and publishes a new version.
- **Quality bar:** development is test-first, and the automated tests, type checks and lint must pass before a release.
- **Editing stays in a dialog:** adding or editing anything that belongs to an application (an interview, a contact, a note, the details of a status change, an offer's expiry) or a company opens a dialog over the page; the page behind does not change shape. Only creating or editing a whole application uses a full-page form. See "Web: UX standards" in [ARCHITECTURE.md](../ARCHITECTURE.md).
- **Languages and units:** the interface is in English; salaries are monthly gross base in ILS; weeks start on Sunday; times are shown in the Israel time zone.
