# Career Testing — Automated Job Scanner

Scans 55 company career pages every 2 hours via GitHub Actions.
Hits Greenhouse, Ashby, and Lever public APIs directly — no tokens, no cost.
Opens a GitHub Issue when new matching roles appear, so you get an email notification instantly.

## How it works

1. GitHub Actions runs `scan.mjs` every 2 hours
2. `scan.mjs` fetches open roles from each company's ATS API
3. Filters by target role keywords (HR Coordinator, People Ops, Customer Success, Event Coordinator, etc.)
4. Compares against `seen-jobs.json` to find only NEW postings
5. If new jobs found → creates a GitHub Issue → GitHub emails you

## Files

| File | Purpose |
|------|---------|
| `scan.mjs` | Main scanner script |
| `companies.json` | List of companies + ATS type/slug |
| `seen-jobs.json` | Dedup history (auto-updated by Actions) |
| `.github/workflows/scan.yml` | Scheduled workflow |

## Run manually

```bash
node scan.mjs
```

Requires Node.js 18+. No npm install needed.

## Trigger a manual scan

Go to **Actions → Job Scanner → Run workflow** in the GitHub UI.
