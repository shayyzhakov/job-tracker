# 04. AI opportunity scout

Status: **Built** (open-web search source); watchlist job-board sources are **Planned**

- Once a day the scout finds new job listings, scores each against the user's criteria with an AI model, and stores the matches as **suggestions**.
- The user edits the criteria on a **Scout settings** page: roles, seniority, IC or management, locations, company sizes and a minimum match score. Which companies to favour or never suggest is set separately, per company, on the **Prioritize companies** page (see [12](12-company-priority.md)). The scout doesn't run until criteria are saved once.
- Each suggestion shows its match score, a short summary and the reasons for the score.
- On the **Suggestions** page the user can add a suggestion to applications (it becomes a "to apply" application) or dismiss it.
- A listing is never suggested twice: listings are recognised by their normalised URL, and each is scored only once.
- Listings that don't fit (below the minimum score, wrong track or wrong company size, blacklisted company) are not shown as suggestions.
- Listings come from an **open-web search**: an AI agent searches the web and opens career pages and public job boards for recent listings that match the criteria, and returns what it found. It runs inside the daily run and is capped in searches, page fetches and time, so a run has a bounded cost (roughly cents) and always finishes. Sample listings still exist for local development.
- **Company priority.** Each company has a priority bucket ([12](12-company-priority.md)). The agent is told to search the career pages of top and high priority companies first, and never to return blacklisted ones. After scoring, a listing from a top or high priority company gets a score boost and one from a low priority company a penalty, and the reason is shown with the suggestion. Listings from blacklisted companies are dropped before scoring.
- LinkedIn is out of scope because it has no public API and scraping breaks its terms; the agent is told not to use it.
- **Planned:** a second kind of source, the public job boards of the top and high priority companies, for predictable coverage of the companies the user cares about most.
