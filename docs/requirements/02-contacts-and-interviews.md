# 02. Contacts and interviews

Status: **Built**

- Each application has contacts (name, role, email, phone, LinkedIn link, notes; the LinkedIn link records where an application started when it came from a LinkedIn message) and interviews (type, date and time, duration, location, notes).
- Interview types: HR, phone, technical, system design, home assignment, home assignment review, onsite, managerial, final, other.
- An application can have several interviews of the same type, including back to back (for example two phone interviews). Interviews are independent records with no uniqueness rule on type; each is scheduled, edited and removed separately.
- **An interview round is one record, upcoming or past.** There is no separate "scheduled" entity: an interview is upcoming when its date and time are in the future and past otherwise. The Interviews section marks each one Scheduled or Past, and the timeline on the application page shows the same interviews in date order with future ones dashed and labelled Scheduled.
- **Round stages and interviews stay in sync.** Moving an application to an interview-round status (HR screening, phone, technical, home assignment, onsite, final) creates the matching interview. The web app asks when it takes place (default now, past or future); the API and the assistant tool accept an optional `interviewAt`. Scheduling an interview directly moves the application forward to that interview's stage (HR → HR screening, phone, technical or system design → technical, home assignment, onsite, final). It never moves the status backwards or reopens a closed application. Managerial, home assignment review and other interviews do not change the status.
- Each status-history entry created this way links to its interview, and the timeline shows the round once, as the interview. Entries from before this link existed have no interview and still show as plain status steps.
