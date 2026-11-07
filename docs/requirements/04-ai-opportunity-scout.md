# 04. AI opportunity scout

Status: **Built** (without real sources); real listing sources are **Planned**

- Once a day the scout finds new job listings, scores each against the user's criteria with an AI model, and stores the matches as **suggestions**.
- The user edits the criteria on a **Scout settings** page: roles, seniority, IC or management, locations, company sizes, excluded companies and a minimum match score. The scout doesn't run until criteria are saved once.
- Each suggestion shows its match score, a short summary and the reasons for the score.
- On the **Suggestions** page the user can add a suggestion to applications (it becomes a "to apply" application) or dismiss it.
- A listing is never suggested twice: listings are recognised by their normalised URL, and each is scored only once.
- Listings that don't fit (below the minimum score, wrong track or wrong company size, excluded company) are not shown as suggestions.
- Only sample listings exist today, so no real listings are fetched yet.
- **Planned:** real listing sources, such as the public job boards of a watchlist of companies. LinkedIn is out of scope because it has no public API and scraping breaks its terms.
