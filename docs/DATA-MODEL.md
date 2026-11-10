# Data model

The app stores everything in **one DynamoDB table** (single-table design). There are no foreign-key constraints in the database: relationships are encoded in the keys (`PK`/`SK`) and enforced by the repositories. This document shows the model twice:

1. [Logical model](#1-logical-model-erd): what the entities are and how they relate (the ERD).
2. [Physical model](#2-physical-model-the-table): how those entities are laid out as items, keys and indexes.

For the surrounding design decisions see [ARCHITECTURE.md](ARCHITECTURE.md#4-data-layer). Source of truth in code: item types in `apps/api/src/db/mappers.ts`, key builders in `apps/api/src/db/dynamo.ts`, table definition in `apps/api/src/db/table.ts` (mirrored by `infra/modules/dynamodb`), enums in `packages/shared/src/enums.ts` and `scout.ts`.

## 1. Logical model (ERD)

```mermaid
erDiagram
    COMPANY ||--o{ APPLICATION : "has"
    CONTACT }o--o{ APPLICATION : "attached to (CONTACT_LINK)"
    APPLICATION ||--o{ INTERVIEW : "has"
    APPLICATION ||--o{ STATUS_HISTORY : "records"
    INTERVIEW |o--o{ STATUS_HISTORY : "may trigger"
    INTERVIEW ||--o{ NOTE : "has"
    OPPORTUNITY }o--o| APPLICATION : "promoted to"
    SCOUT_CRITERIA {
        string singleton "one row per table"
    }

    COMPANY {
        string id PK "uuid"
        string name UK "unique, case-insensitive"
        enum size "nullable: CompanySize"
        boolean isPublic
        string website "nullable"
        string location "nullable"
        string createdAt "ISO 8601"
        string updatedAt "ISO 8601"
    }

    APPLICATION {
        string id PK "uuid"
        string companyId FK "-> COMPANY.id"
        string roleName
        boolean isManagement
        enum status "milestone: to_apply, applied, offer or a closed outcome"
        string listingUrl "nullable"
        number expectedSalaryIls "nullable, monthly gross"
        string source "nullable"
        enum applicationMethod "optional: ApplicationMethod"
        string referrerName "optional"
        enum referrerChannel "optional: ReferralChannel"
        string methodDetails "optional"
        string notes "nullable"
        string appliedAt "nullable, ISO 8601"
        list reachedStatuses "milestones ever held"
        string replyBy "optional, ISO 8601"
        string dueAt "optional, ISO 8601"
        string nextStep "optional"
        string snoozedUntil "optional, ISO 8601"
        string statusChangedAt "optional, ISO 8601"
        string waitingOnThemAt "optional, ISO 8601"
        number followUps "optional, default 0"
        string createdAt "ISO 8601"
        string updatedAt "ISO 8601"
    }

    CONTACT_LINK {
        string contactId FK "-> CONTACT.id (also the SK)"
        string applicationId FK "-> APPLICATION.id (also the PK)"
        string createdAt "ISO 8601"
    }

    CONTACT {
        string id PK "uuid"
        string name
        string role "nullable"
        string email "nullable"
        string phone "nullable"
        string linkedinUrl "optional"
        string notes "nullable"
        string createdAt "ISO 8601"
        string updatedAt "ISO 8601"
    }

    INTERVIEW {
        string id PK "uuid"
        string applicationId FK "-> APPLICATION.id"
        enum type "InterviewType"
        string scheduledAt "ISO 8601"
        number durationMinutes "nullable"
        string location "nullable"
        boolean timeUnknown "optional, placeholder time"
        string debriefedAt "optional, ISO 8601"
        string createdAt "ISO 8601"
        string updatedAt "ISO 8601"
    }

    NOTE {
        string id PK "uuid"
        string applicationId FK "-> APPLICATION.id"
        string interviewId FK "-> INTERVIEW.id"
        string text "multi-line plain text, non-empty"
        string createdAt "ISO 8601"
        string updatedAt "ISO 8601"
    }

    STATUS_HISTORY {
        string id PK "uuid"
        string applicationId FK "-> APPLICATION.id"
        enum fromStatus "nullable on first entry"
        enum toStatus "milestone status"
        string changedAt "ISO 8601"
        string interviewId FK "optional -> INTERVIEW.id"
    }

    OPPORTUNITY {
        string id PK "uuid"
        string listingUrl UK "unique, normalised"
        string source
        string companyName "free text, not an FK"
        string title
        string location "nullable"
        string description
        string postedAt "nullable, ISO 8601"
        number score "0-100"
        string summary
        list reasons "list of strings"
        boolean isManagement
        enum companySize "nullable: CompanySize"
        enum status "OpportunityStatus"
        string applicationId FK "nullable -> APPLICATION.id"
        string createdAt "ISO 8601"
        string updatedAt "ISO 8601"
    }

    SCOUT_CRITERIA {
        map criteria "ScoutCriteria (see below)"
        string updatedAt "ISO 8601"
    }
```

### Relationships

| Relationship                 | Cardinality | Kind                                          | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ---------------------------- | ----------- | --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Company → Application        | 1 : many    | `APPLICATION.companyId` → `COMPANY.id`        | An application always has a company. Companies are created with an application (de-duplicated by lowercased name) or on their own with no application. Company fields are never copied onto applications, so editing a company changes it for all of its applications. A company can be deleted only when it has no applications.                                                                                                                               |
| Application ↔ Contact        | many : many | `CONTACT_LINK` (`applicationId`, `contactId`) | A contact is one shared person (`CONTACT#<id>`); each application holds a small link item in its own partition. Edits to the contact show everywhere. Removing a link, or deleting the application, deletes the contact when no link is left (checked by a separate read, not a transaction). New details that match a contact on email (case-insensitive), phone (digits) or LinkedIn profile reuse it; there is no uniqueness marker, so this is best effort. |
| Application → Interview      | 1 : many    | `INTERVIEW.applicationId`                     | Same partition as the application.                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Interview → Note             | 1 : many    | `NOTE.interviewId` (+ `NOTE.applicationId`)   | Same partition as the application, sort key `NOTE#<interviewId>#<id>`. Deleting the interview deletes its notes; deleting the application deletes all of them. Reads drop notes whose interview is missing.                                                                                                                                                                                                                                                     |
| Application → Status history | 1 : many    | `STATUS_HISTORY.applicationId`                | Append-only log of status changes; same partition, sorted by time.                                                                                                                                                                                                                                                                                                                                                                                              |
| Interview → Status history   | 1 : 0..many | `STATUS_HISTORY.interviewId` (optional)       | Set when a history step was created by, or came from, an interview. Absent on older rows.                                                                                                                                                                                                                                                                                                                                                                       |
| Opportunity → Application    | many : 0..1 | `OPPORTUNITY.applicationId` (nullable)        | Set when a suggestion is promoted (`status = promoted`). Reverse lookup (application → opportunity) is served by GSI2.                                                                                                                                                                                                                                                                                                                                          |
| Scout criteria               | singleton   | none                                          | One item for the whole table (single user). Not related to other entities; it drives which opportunities the scout worker keeps.                                                                                                                                                                                                                                                                                                                                |

Not stored: the **action queue** (what needs doing today) is derived from applications and interviews by `deriveActions` in `packages/shared/src/actions`, and **gamification progress** is derived by `build-progress.ts`. Neither has items in the table.

### Enumerations

| Enum                        | Values                                                                                                                                                                                                                                                                                                                           |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ApplicationStatus` (shown) | `to_apply`, `applied`, `coffee_chat`, `hr_screening`, `phone_interview`, `technical_interview`, `home_assignment`, `onsite_interview`, `managerial_interview`, `final_interview`, `offer`, `accepted`, `rejected`, `withdrawn`, `ghosted`                                                                                        |
| Stored status               | Only the milestones: `to_apply`, `applied`, `offer`, `accepted`, `rejected`, `withdrawn`, `ghosted`. The round statuses (`coffee_chat` … `final_interview`) are never stored: they are derived from the interviews (next upcoming with a stage, else latest held, else the stored milestone) and exist as values only in the DTO |
| Status groups               | initial: `to_apply`, `applied`. active: the interview rounds and `offer`. closed: `accepted`, `rejected`, `withdrawn`, `ghosted`. "Open" = initial + active. Derived from status, never stored                                                                                                                                   |
| `CompanySize`               | `early_stage_startup`, `startup`, `scale_up`, `corporate`                                                                                                                                                                                                                                                                        |
| `InterviewType`             | `hr`, `phone`, `technical`, `system_design`, `home_assignment`, `home_assignment_review`, `onsite`, `managerial`, `final`, `coffee`, `other`                                                                                                                                                                                     |
| `ApplicationMethod`         | `referral`, `linkedin`, `company_site`, `job_board`, `recruiter_outreach`, `networking_event`, `other`                                                                                                                                                                                                                           |
| `ReferralChannel`           | `in_person`, `phone`, `whatsapp`, `linkedin`, `email`, `other`                                                                                                                                                                                                                                                                   |
| `OpportunityStatus`         | `new`, `filtered`, `dismissed`, `promoted`                                                                                                                                                                                                                                                                                       |

### Scout criteria payload

Stored as a JSON map in the `criteria` attribute and re-parsed with `ScoutCriteriaSchema` on read, so criteria saved before a field existed pick up its default.

| Field               | Type                                    | Default  |
| ------------------- | --------------------------------------- | -------- |
| `roles`             | list of string (trimmed, de-duplicated) | `[]`     |
| `seniorities`       | list of `SeniorityLevel`                | `[]`     |
| `track`             | `ic` \| `management` \| `either`        | `either` |
| `locations`         | list of string                          | `[]`     |
| `companySizes`      | list of `CompanySize` (empty = any)     | `[]`     |
| `excludedCompanies` | list of string (case-insensitive match) | `[]`     |
| `minScore`          | integer 0–100                           | `60`     |

## 2. Physical model (the table)

One table, composite primary key, two global secondary indexes, on-demand billing, point-in-time recovery on AWS.

| Attribute           | Type | Role                                          |
| ------------------- | ---- | --------------------------------------------- |
| `PK`                | S    | Table partition (hash) key                    |
| `SK`                | S    | Table sort (range) key                        |
| `GSI1PK` / `GSI1SK` | S    | `GSI1` partition / sort key, `ALL` projection |
| `GSI2PK` / `GSI2SK` | S    | `GSI2` partition / sort key, `ALL` projection |

All other attributes are schemaless; the columns and types are those in the ERD above. Dates are ISO 8601 strings (which sort chronologically as text), booleans are native, optional fields are either absent (rows written before the field existed) or explicit `null`.

### Item layout

| Entity               | PK                     | SK                        | GSI1PK / GSI1SK                                             | GSI2PK / GSI2SK                                                   |
| -------------------- | ---------------------- | ------------------------- | ----------------------------------------------------------- | ----------------------------------------------------------------- |
| Company              | `COMPANY#<id>`         | `META`                    | `COMPANIES` / `<lowercased name>#<id>`                      |                                                                   |
| Company-name marker  | `CNAME#<lowercased>`   | `META`                    |                                                             |                                                                   |
| Application          | `APP#<id>`             | `META`                    | `APPS` / `<updatedAt>#<id>`                                 |                                                                   |
| Contact              | `CONTACT#<id>`         | `META`                    | `CONTACTS` / `<lowercased name>#<id>`                       |                                                                   |
| Contact link         | `APP#<appId>`          | `CONTACT#<contactId>`     |                                                             | `CONTACT#<contactId>` / `<appId>` (applications of a contact)     |
| Interview            | `APP#<appId>`          | `INTERVIEW#<id>`          | `INTERVIEWS` / `<scheduledAt>#<id>`                         |                                                                   |
| Note                 | `APP#<appId>`          | `NOTE#<interviewId>#<id>` |                                                             |                                                                   |
| Status history entry | `APP#<appId>`          | `HISTORY#<at>#<id>`       |                                                             |                                                                   |
| Opportunity          | `OPP#<id>`             | `META`                    | `OPPSTATUS#<status>` / `<score, 5 digits>#<createdAt>#<id>` | `APPOPP#<applicationId>` / `<opportunityId>` (only once promoted) |
| Listing-URL marker   | `OPPURL#<sha256(url)>` | `META`                    |                                                             |                                                                   |
| Scout criteria       | `SCOUT`                | `CRITERIA`                |                                                             |                                                                   |

Marker items exist only to enforce uniqueness (they carry no data). They are written in the same transaction as their entity with `attribute_not_exists`, which gives the equivalent of `UNIQUE(company.name)` and `UNIQUE(opportunity.listingUrl)`.

### How the relationships map onto keys

```mermaid
flowchart LR
    subgraph P1["Partition APP#a1 (item collection)"]
        A["SK META<br/>Application"]
        C1["SK CONTACT#c1<br/>Contact link"]
        I1["SK INTERVIEW#i1<br/>Interview"]
        N1["SK NOTE#i1#n1<br/>Interview note"]
        H1["SK HISTORY#2026-01-05T..#h1<br/>Status history"]
    end
    subgraph P2["Partition COMPANY#k1"]
        K["SK META<br/>Company"]
    end
    subgraph P4["Partition CONTACT#c1"]
        CT["SK META<br/>Contact (shared person)"]
    end
    subgraph P3["Partition OPP#o1"]
        O["SK META<br/>Opportunity"]
    end
    A -- "companyId" --> K
    C1 -- "contactId" --> CT
    O -. "applicationId (when promoted)" .-> A
    H1 -. "interviewId (optional)" .-> I1
    N1 -. "interviewId (in the SK)" .-> I1
```

- **One-to-many inside the application aggregate** is expressed by sharing `PK = APP#<id>` and using a typed `SK` prefix (`CONTACT#` links, `INTERVIEW#`, `NOTE#`, `HISTORY#`). One `Query` on the partition loads the application with all its children; `begins_with(SK, 'CONTACT#')` loads one kind, and `begins_with(SK, 'NOTE#<interviewId>#')` loads the notes of one interview.
- **Many-to-one across aggregates** (application → company, opportunity → application) is a plain attribute holding the other item's id, resolved with a `GetItem`/`BatchGetItem` on its key.
- **History ordering:** the timestamp is embedded in the sort key, so history comes back in chronological order for free.

### Access patterns and the key that serves them

| Access pattern                                                          | Operation                                                                            |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Get one application with contacts, interviews, interview notes, history | `Query PK = APP#<id>`, then `BatchGet` the linked `CONTACT#<id> / META` profiles     |
| List contacts (reuse picker), search by name, role, email, phone        | `Query GSI1 GSI1PK = CONTACTS` (filtered in memory)                                  |
| Applications of a contact (count, contact page, orphan check)           | `Query GSI2 GSI2PK = CONTACT#<id>`                                                   |
| Match new contact details to a known contact                            | `Query GSI1 GSI1PK = CONTACTS`, compared on email / LinkedIn in memory               |
| Notes of one interview (delete cascade)                                 | `Query PK = APP#<id>, begins_with(SK, NOTE#<interviewId>#)`                          |
| List applications, newest updated first                                 | `Query GSI1 GSI1PK = APPS`, descending                                               |
| Upcoming interviews / next interview per application                    | `Query GSI1 GSI1PK = INTERVIEWS`, `GSI1SK > <now>`                                   |
| List or search companies                                                | `Query GSI1 GSI1PK = COMPANIES` (name search filtered in memory)                     |
| Applications per company (active / total counts, delete guard)          | `Query GSI1 GSI1PK = APPS`, grouped by `companyId` in memory (derived, never stored) |
| Does a company with this name exist                                     | `GetItem CNAME#<lowercased> / META`                                                  |
| List suggestions by status, best score first                            | `Query GSI1 GSI1PK = OPPSTATUS#<status>`, descending                                 |
| Has this listing already been suggested                                 | `GetItem OPPURL#<sha256(url)> / META`                                                |
| Which opportunity became this application                               | `Query GSI2 GSI2PK = APPOPP#<applicationId>`                                         |
| Scout criteria                                                          | `GetItem SCOUT / CRITERIA`                                                           |

Updating an application's `updatedAt` also rewrites its `GSI1SK`, and a status change rewrites it with the change time, so the list order stays correct. Changing an opportunity's status or score moves it to a different `GSI1PK`/`GSI1SK`; setting `applicationId` adds the `GSI2` keys.

### Multi-item writes

| Operation                           | What is written                                                                                                                                                                                                                                                 |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Create company                      | One transaction: company item + company-name marker (fails if the name exists)                                                                                                                                                                                  |
| Rename company                      | One transaction: company update + new marker + delete of the old marker                                                                                                                                                                                         |
| Delete company                      | One transaction: company item + its name marker. Allowed only when no application references the company; that check is a separate read, so an application created in between could slip through (accepted for one user; a per-company counter would close it). |
| Create application                  | One transaction: application + its contact links (plus the contact item for each new person) + first status history entry (`fromStatus = null`). The company is created beforehand.                                                                             |
| Change application status           | A milestone: one transaction: application update (`status`, `reachedStatuses`, `GSI1SK`) + new status history entry. A round: creates the interview instead (no status write)                                                                                   |
| Interview scheduled or round chosen | One update on the application (`statusChangedAt`, hand-over, snooze, applied date); a to-apply application also gets the `applied` milestone through the status-change transaction above                                                                        |
| Delete interview                    | Not a transaction: the interview is deleted (conditional), then its notes are found with `begins_with(SK, NOTE#<interviewId>#)` and batch-deleted. A failure in between leaves notes that reads ignore (their interview is gone).                               |
| Attach contact                      | One transaction: the contact item (only when new) + the link item. Attaching an already attached contact writes nothing.                                                                                                                                        |
| Delete application                  | The whole partition (`PK = APP#<id>`: application, contact links, interviews, notes, history) is batch-deleted, then contacts left with no link are deleted                                                                                                     |
| Save suggestions                    | One transaction per suggestion: opportunity + listing-URL marker (already-seen URLs are skipped)                                                                                                                                                                |
| Promote suggestion                  | Application is created as above, then the opportunity is moved to `promoted` and given `applicationId` with a compare-and-set on its old status                                                                                                                 |

## 3. Keeping this document current

When you add or change an attribute, update the item type in `db/mappers.ts`, the ERD and the tables above. When you add an item type or index, also update `db/dynamo.ts` (`key`), `db/table.ts`, `infra/modules/dynamodb`, and the item table in [ARCHITECTURE.md](ARCHITECTURE.md#item-types).
