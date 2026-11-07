# 06. Authentication and access

Status: **Built**

One user. The app is private: nothing except a basic health check is available without signing in.

## Web app

- Visitors who aren't signed in are sent to a sign-in page; after signing in they return to the app.
- There is no self sign-up. The single account is created by the owner when the app is set up, and a temporary password is emailed to them to change at first sign-in.
- Two-step verification with an authenticator app is available (optional but recommended).
- Sessions stay valid for 30 days without signing in again; password recovery is by verified email.
- The header shows who is signed in and offers sign out.
- During local development the app needs no sign-in.

## Claude integration

- The assistant connection uses OAuth, the standard sign-in flow for MCP. The owner signs in on the same sign-in page as the web app (including two-step verification if enabled); nothing is copied or stored by hand.
- An assistant needs only the server URL. It registers itself automatically, and each registration is limited to approved redirect addresses (Claude's own, and the local machine for command-line tools). At most 50 registrations are kept; the oldest are removed.
- Access is granted through a dedicated permission (scope) that the web app's own sign-in does not carry, so a web session cannot be used as an assistant connection and the reverse.
- Assistant sign-ins last as long as web sign-ins (access 60 minutes, refresh 30 days) and can be revoked.
- Locally it needs no sign-in and only accepts connections from the same machine.
- It can be turned off.

## Open questions

- **Registration is open:** anyone can create an assistant registration (not sign in with it). The approved-address list and the cap bound this; revisit if the app ever has more than one user.
- **Abuse protection:** rate limiting and similar protection are not in place; revisit if the app ever has more than one user.
