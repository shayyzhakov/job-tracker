# 10. Interview notes

Status: **Built**

## Goal

Remember how each interview went: the technical questions asked, new facts about the role or company, and anything worth learning for next time. Notes belong to an interview (a round), and the user can also read all the notes of an application in one view.

## Requirements

1. **Notes attach to an interview, never directly to an application.** An interview has zero or more notes. Notes are independent records, shown newest first.
2. **A note is multi-line plain text.** There is no title and there are no categories in v1. A note records when it was created and last edited. Empty notes are rejected.
3. **Add, edit and delete** a note from the interview on the application page. Deleting asks for confirmation.
4. **Any interview can have notes, whatever its timing.** That includes upcoming interviews (prep, questions to ask, things learned from the recruiter), past ones, and placeholder-time interviews created by a status change. This matches [02](02-contacts-and-interviews.md): an interview is one record, upcoming or past, so nothing gates notes on the interview having happened. A note never changes the interview's Scheduled or Past label or the action queue.
5. **Notes tab on the application page.** It lists every note of the application in one view, grouped by interview (type and date, newest interview first; newest note first within a group). Each note can be edited or deleted in place. Interviews without notes are not listed. An empty state explains how to add the first note.
6. **The interview card shows a note count** and opens its notes.
7. **Replaces the old interview notes field.** The single-line `notes` field is removed from the interview form and API. Existing text is migrated to one note per interview (created time = the interview's last update) so nothing is lost.
8. **Cascade.** Deleting an interview deletes its notes. Deleting an application deletes all of its notes.
9. **Claude (MCP).** The assistant can list the notes of an application (grouped by interview), and add, edit and remove a note. `get_application` includes notes. Removing a note is flagged as destructive, like other deletes (see [05](05-claude-integration.md)).
10. **No side effects elsewhere.** Notes do not affect status, the action queue or gamification. The Tasks "Log how it went" card is unchanged: its "Add notes" button still opens the application, and saving a note does not mark the interview debriefed.

## Acceptance criteria

- The user can add two notes to a phone interview and one to a technical interview, see all three in the Notes tab grouped by interview, edit one and delete one.
- The user can add a note to an interview that is still in the future, and its Scheduled label and place in the timeline do not change.
- An interview that had old `notes` text shows it as a note after migration, and the interview form no longer has that field.
- Deleting an interview removes its notes from the tab.
- From the assistant, the user can add and list notes and see them in the web UI immediately.

## Data model

- Item type `NOTE` in the application's partition: `PK = APP#<appId>`, `SK = NOTE#<interviewId>#<noteId>`. One `begins_with(SK, 'NOTE#')` query loads the Notes tab, and `begins_with(SK, 'NOTE#<interviewId>#')` loads one interview's notes. No GSI.
- Attributes: `id`, `applicationId`, `interviewId`, `text`, `createdAt`, `updatedAt`.
- Deleting an interview also deletes its notes (transaction or batch). `INTERVIEW.notes` is removed, with a one-off migration (`pnpm db:migrate-notes`).
- Documented in [DATA-MODEL.md](../DATA-MODEL.md) and [ARCHITECTURE.md](../ARCHITECTURE.md). Notes are returned as `interviewNotes` on the application detail; REST writes are `POST/PATCH/DELETE /applications/:id/interviews/:interviewId/notes[/:noteId]`.
- Interview delete cascades its notes non-atomically (reads ignore notes whose interview is gone). Run `pnpm db:migrate-notes` once per environment to migrate old text.

## Not included (v1)

Categories or tags, rich text or attachments, search across applications, notes on status steps that have no interview, auto-marking an interview debriefed when a note is saved, and AI summaries of notes.

## Open questions

- **Status steps without an interview.** The request mentioned "interviews (or status steps)". Round-stage status changes (HR screening, phone, technical, home assignment, onsite, final) already create an interview, so they are covered. Steps like applied or offer have no interview and get no notes in v1. Revisit if wanted.
