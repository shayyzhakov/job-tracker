# 05. Claude integration

Status: **Built**

## Goal

Let the user manage their job search by talking to an AI assistant such as Claude (Claude Code, Claude Desktop or claude.ai) instead of, or alongside, the web UI. For example: "Add the Wix backend role I just applied to", "Move OrbitPay to technical interview and schedule it for Sunday at 10", "What's on my plate this week?", "Show me today's suggestions and add the best two".

## Requirements

1. **Same capabilities as the web app.** The assistant can do everything the user can do in the UI:

   | Area           | Capabilities                                                                                |
   | -------------- | ------------------------------------------------------------------------------------------- |
   | Applications   | list and search (same filters as the UI), view details, create, edit, change status, delete |
   | Contacts       | add, edit, remove on an application                                                         |
   | Interviews     | schedule, edit, remove on an application                                                    |
   | Interview notes | *Planned:* list, add, edit, remove on an interview (see [10](10-interview-notes.md))        |
| Companies      | search                                                                                      |
   | Overview       | see the dashboard figures and upcoming interviews                                           |
   | Suggestions    | list (by status), add to applications, dismiss                                              |
   | Scout settings | view, update (changing only the fields given)                                               |

2. **Same behaviour as the web app.** Status history, company de-duplication, applied-date handling and suggestion conflicts work identically whichever way a change is made, and changes made through the assistant are immediately visible in the web UI.
3. **Clear errors.** Invalid input, unknown items and conflicts are reported with a message the assistant can act on (for example "Application … not found", "Opportunity … is already promoted").
4. **Confirmation before deleting.** Destructive actions are identifiable as such, so the assistant asks the user before deleting.
5. **Useful answers.** Results are compact and identify the items they mention, so a follow-up request can refer to them.
6. **Protected access.** Only the owner can use it. Assistants connect with a normal sign-in (OAuth), so there is no secret to copy and web-based assistants such as claude.ai can connect too (see [06 Authentication and access](06-authentication.md)).
7. **Can be switched off.**
8. **Easy to connect.** The assistant needs only the server URL: it discovers how to sign in, registers itself, and sends the owner to the normal sign-in page. Nothing is registered or copied by hand. The web app has an **Integrations** page with the URL, connection instructions for Claude.ai, Claude Code and Claude Desktop, the example prompts and the list of capabilities.

## Acceptance criteria

- The user can connect Claude.ai, Claude Code or Claude Desktop to the app by giving it the server URL and signing in, with no token or client id entered, and see what the assistant can do.
- An assistant that has not signed in is refused; a token from the web app itself does not give access to the assistant connection.
- From the assistant, the user can create an application with a contact, change its status, schedule an interview, see it on the overview, and list and promote a suggestion. Each change is visible in the web UI.
- The README documents how to connect and lists the capabilities.

## Open questions

- **Discovery header:** the AWS Function URL renames the `WWW-Authenticate` response header, so assistants find the sign-in details by probing the standard `/.well-known/` addresses instead. This works with the assistants tried so far (Claude.ai, Claude Code); revisit if another assistant fails to connect.
