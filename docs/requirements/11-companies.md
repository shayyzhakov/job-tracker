# 11. Companies

Status: **Built**

## Goal

A Companies page that is the home of company records: companies the user applied to, follows, or just wants to keep an eye on, including ones with no application yet. Several applications can point at the same company, so editing a company updates all of them at once.

## Requirements

1. **One company, many applications.** An application references its company by id. Company fields are never copied onto an application. Editing a company is reflected everywhere that company appears (applications table, application page, assistant output) with no per-application update.
2. **Companies exist on their own.** A company can be created with zero applications, from the web page and from the assistant. Creating an application with a company name still reuses an existing company with the same name (case-insensitive), as in [01](01-applications.md).
3. **Unique names.** Names are unique case-insensitively. Creating a company or renaming one into a name that already exists is rejected with a conflict. It is never merged silently.
4. **Editable fields:** name (required), size (early-stage startup, startup, scale-up, corporate; optional), public or private flag, website and location (both optional).
   Size buckets are judged mainly by headcount and maturity: early-stage startup (seed/Series A, under about 50 people), startup (growth stage, about 50 to 500), scale-up (a mature, established tech company of about 500 to 5,000 people, public or private, such as monday.com or Wix) and corporate (about 5,000 or more, including big public companies such as Meta or Amazon). Ownership is tracked separately by the public or private flag. The scale-up bucket replaced the earlier "unicorn" bucket, a valuation label that did not fit public companies.
5. **Companies table.** One row per company with: name, size, type (Public or Private), and applications as `open / total`. It is searchable by name and sortable by every column, defaulting to name ascending. "Open" uses the same rule as [01](01-applications.md): every status except accepted, rejected, withdrawn and ghosted (initial and active groups; an offer counts as open). Selecting the applications cell opens the Applications page filtered to that company. A filter narrows the table to all companies, only those with at least one application, or only those with none.
6. **Add and edit in the page.** An "Add company" action opens a form. Selecting a row's name or edit action opens the same form for that company.
7. **Counts are derived, not stored,** so they cannot drift from the applications.
8. **Delete only with no applications at all.** A company with any application, active or closed, cannot be deleted: the action is disabled with an explanation in the UI, and the API and assistant return a clear error with the application count. Deleting a company with none removes it and frees its name for reuse. Deleting an application never deletes its company.
9. **Claude (MCP).** New tools to list companies (with application counts, optional name filter), get one company (with counts and its applications), create, update (partial; optional fields can be cleared) and delete. Delete is flagged as destructive and refuses when applications exist (see [05](05-claude-integration.md)). `search_companies` keeps working. The existing instruction to fill in size, public flag, website and location when they are known applies to the create and update tools.
10. **Navigation.** A "Companies" item in the sidebar, between Applications and Suggestions, at `/companies`.

## Acceptance criteria

- The user adds a company with no application and sees it in the table as `0 / 0`.
- The user has three applications at one company, changes the company's size, and sees the new size on all three.
- Deleting a company whose only application is closed (for example rejected) is refused. Deleting an unused company works, and the same name can be added again afterwards.
- Renaming a company to another company's name is rejected as a conflict.
- The user can filter by applications (with applications, no applications) and by company size. Both are multi-select dropdowns: pick any combination, and an empty selection means no filtering on that field. They combine with each other and with the search.
- The table shows, for a company with two active and one closed application, `2 / 3`.
- From the assistant, the user can list, create, edit and delete companies and see the changes in the web UI immediately.

## Data model

- No new item type. It reuses `Company` (`PK = COMPANY#<id>`, `SK = META`, `GSI1PK = COMPANIES`) and the `CNAME#<lowercased>` name marker. Applications already hold `companyId`.
- New access pattern: applications per company, derived by grouping the application list by `companyId`. No new index is needed at one user's data volume.
- New transaction: delete company (delete the company item and its name marker together). The "no applications" check and the delete are separate steps, so a concurrent application create could slip in between. That is accepted for a single user and documented as a limitation. If it ever matters, keep a per-company application counter updated in the application create and delete transactions.
- Documented in [DATA-MODEL.md](../DATA-MODEL.md) and [ARCHITECTURE.md](../ARCHITECTURE.md). REST: `GET /companies?q=` (plain name matches for the application form), `GET /companies/with-counts?q=` (the Companies page), `POST /companies`, `GET/PATCH/DELETE /companies/:id`. Deleting a company with applications returns `409` with the count.
- Selecting the applications cell opens `/applications?q=<name>&scope=all`; the Applications page reads those two parameters as its initial search and scope.

## Not included (v1)

Merging duplicate companies, company-level notes or contacts, logos or automatic enrichment, bulk import, and linking scout opportunities or the scout's excluded-companies list to company records.

## Open questions

- **"Keep an eye on."** v1 has no explicit follow flag: a company with no applications is simply one the user tracks. If the user wants to mark followed companies separately from ones merely typed in, add a `watching` flag or a company-level note.
- **Public vs private vs corporate.** The request lists "private or corporate" as a type. v1 keeps the existing public/private flag, with size already covering corporate. Revisit if a richer type is wanted.
