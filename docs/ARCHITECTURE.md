# Gaming Life architecture

Gaming Life is the standalone app. Life OS may later be incorporated as the **character profile** within Gaming Life; it is not the parent app.

## V1
- Static, browser-based UI: today’s main quest and optional side quests, XP, level, chapter milestones, logs, task management.
- Records are held in browser localStorage under `gaming-life-v1-local`. They are not uploaded to GitHub or Supabase.
- Export/import JSON for manual backup. No cross-device sync or account login.
- Local keyword matching requires user confirmation. It is not an AI-powered parser.

## Planned local-first storage
- Use IndexedDB with record identifiers, revisions, modification times, and durable queued writes.
- Integrate a separate Supabase project for authentication and per-user sync.
- Enforce Row-Level Security (RLS), owner-scoped policies and no service-role keys in the browser.
- Resolve sync conflicts explicitly, avoid duplicate XP accrual and support repeatable/rollback-safe migrations.
- Retain JSON export/import and test restoration.
- Do not silently merge with Life OS or You-jile data, and never move private personal records into public GitHub commits.

## Future character profile
- Adapt established Life OS modules for fitness, sleep, finance, study, professional progress and lifestyle.
- Treat completed actions and measurable outcomes separately; XP is a game incentive, not an objective measure of ability.
- Version a stable shared event model before integration.

## Deployment
GitHub Actions deploys this repository as a standalone static GitHub Pages site from the repository root. No database setup is required for V1.
