# 12. Company priority

Status: **Built**

## Goal

Let the user tell the AI scout which companies matter. Every company gets a priority bucket, from companies to look at first down to a blacklist of companies that are never suggested. The scout then spends its limited search on the companies the user prefers. It builds on the company records from [11](11-companies.md).

## Requirements

1. **Five buckets**, highest to lowest: **Top target**, **High**, **Moderate**, **Low**, **Blacklist**. Moderate is the middle and the default.
2. **New companies start at Moderate.** This holds for every way a company is created: the Companies page, an application created with a new company name, a suggestion added to applications, and the assistant (MCP). The user decides later whether it should be higher or lower. Companies that existed before this feature read as Moderate.
3. **Priority can be set when a company is created**, not only afterwards: in the Add company form, in the company section of the new-application form, and through the MCP tools `create_company` and `create_application` (new company). `update_company` and `update_application` change it later. If an application names an existing company, the company is reused unchanged, including its priority (change it with `update_company`).
4. **Prioritize companies page** at `/scout/companies`, reached from a button next to "Scout settings" on the Suggestions page. It shows the five buckets with their companies and lets the user move a company to any other bucket by dragging its card onto the bucket, or with the menu on the card (the keyboard and touch path). Companies can be searched by name. Moderate doubles as the "to review" bucket, since that is where new companies land.
5. **Companies page** shows each company's priority, and can filter and sort by it. The company form edits it.
6. **Effect on the scout** (see [04](04-ai-opportunity-scout.md)):
   - Blacklist: listings from these companies are never suggested (dropped before scoring, no model call).
   - Top and High: the search agent looks at these companies' career pages first, and their listings get a score boost (top +15, high +8).
   - Low: searched last, with a score penalty (-8).
   - Moderate: no special treatment.
     The adjusted score is capped at 0–100 and the reason is shown on the suggestion.
7. **One source of truth.** The old free-text "Excluded companies" list in Scout settings is removed. Blacklist replaces it. Existing excluded names are not migrated.
8. **Matching by name.** Scout listings carry the company name as text, so a listing is matched to a company by its name, case-insensitively. A different spelling ("Acme Ltd" vs "Acme") will not match.

## Acceptance criteria

- A company created without a priority is Moderate, in every creation path.
- Creating a company with priority Top through the Add company form, the new-application form or MCP stores Top.
- On the Prioritize companies page, moving a company to Blacklist saves it; the next scout run drops its listings.
- A listing from a Top company that scores 50 is suggested (65 with the boost, minimum score 60); the same listing from a Moderate company is not.
- The Scout settings page no longer has an excluded companies field, and links to the Prioritize companies page.

## Data model

One new optional attribute `priority` on `Company` (`COMPANY#<id>` / `META`). No new item type, key or index. Absent means Moderate. See [DATA-MODEL.md](../DATA-MODEL.md). No new REST route: the page uses `GET /companies/with-counts` and `PATCH /companies/:id`.

## Not included (v1)

A separate "reviewed" flag (an untouched Moderate company and a deliberately Moderate one look the same), company aliases for name matching, per-bucket tuning of the boost, and a dedicated search of the Top and High companies' job boards (planned in [04](04-ai-opportunity-scout.md)).
