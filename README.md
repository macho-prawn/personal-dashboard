<a id="top"></a>

# Table of Contents
- [Description](#description)
- [Main Features](#main-features)
- [Tech Stack](#tech-stack)
- [Data Model (Current)](#data-model-current)
- [Architecture Diagram](#architecture-diagram)
- [Run with Docker](#run-with-docker)
- [Local Development](#local-development)
- [TODO](#todo)
- [Development Attribution](#development-attribution)
- [Special Notes](#special-notes)

## Description
A personal dashboard built with Astro + Alpine.js + PostgreSQL, containerized with Docker Compose.

![Light-Mode Dashboard](images/dashboard_lightmode_screenshot.png)

[Back to top](#top)

## Main Features
- Frontend: renders the personal dashboard UI with profile metadata, panel/category/link views, search, news, clocks, theme toggle, and backup/restore controls.
- Frontend interactions: supports category/link CRUD, drag-and-drop ordering, keyboard panel switching, favicon loading, persisted theme state, and inactivity refresh.
- Backend: serves Astro pages and JSON APIs for dashboard data, CRUD/reorder actions, news fetching, and database operations.
- Backend persistence and ops: stores panels/categories/links in PostgreSQL, enforces validation/order rules, creates manual backups, keeps only the latest 5 backup files, and restores a selected backup with a restart-required state.

[Back to top](#top)

## Tech Stack
- Frontend: Astro + Alpine.js
- Database: PostgreSQL 17
- Runtime/Deployment: Docker, Docker Compose
- HostOS / Virtualization: Windows 11 / Hyper-V
- Linux Emulation: WSL Ubuntu

[Back to top](#top)

## Data Model (Current)
- `panels`: ordered tabs (`sort_order`)
- `categories`: belongs to panel (`panel_id`, `sort_order`)
- `links`: belongs to category (`category_id`, `sort_order`)

[Back to top](#top)

## Architecture Diagram
```mermaid
flowchart LR
  U[Browser UI\nAstro + Alpine] --> API[Astro Server/API]
  API --> DB[(PostgreSQL)]
  API --> J[Chuck Norris Joke API]
  API --> G[Google News RSS API]
  U --> F[Favicon Service]

  DB --- P[(panels)]
  DB --- C[(categories)]
  DB --- L[(links)]
```

[Back to top](#top)

## Run with Docker
1. Copy env file:
   ```bash
   cp .env.example .env
   ```
2. Create the volume directories and update your `.env` file accordingy:
   ```bash
   mkdir <db-vol-dir>; chown 70:70 <db-vol-dir>; chmod 700 <db-vol-dir>
   mkdir <dbbackup-vol-dir>
   cat >> .env << EOF
   DB_VOLUME=${pwd}/<db-vol-dir>
   DB_BACKUP_VOLUME=${pwd}/<dbbackup-vol-dir>
   EOF 
   ```
2. Start the stack from the repo root:
   ```bash
   docker compose up -f docker-compose.yml --env-file .env --build --detached
   ```
3. Open the dashboard:
   `http://localhost:8080`
   If you change `APP_PORT` in `.env`, use that port instead.
4. Stop the stack:
   ```bash
   docker compose -f docker-compose.yml --env-file .env down
   ```

[Back to top](#top)

## Local Development
The app source now lives under `docker/`.

```bash
cd docker
npm install
npm run dev
```

[Back to top](#top)

## TODO
1. Integrate TLS/SSL.
2. Architecture needs to redesigned to 3-tier.

[Back to top](#top)

## Development Attribution
- Principal developer: Codex (GPT-5 coding agent). _// old N00b 👴 assisted a bit_
- Collaboration model: iterative prompt-driven development in the local repo with incremental implementation, debugging, and UX refinement.

### Prompt Summary (Consolidated)
- Build a personal link dashboard with Astro + Alpine + PostgreSQL, Dockerfile, and Docker Compose.
- Variabilize `DATABASE_URL`; fix Astro connection reset and browser runtime errors.
- Remove old random-saying feature; add Chuck Norris joke line and control duplicate fetch behavior.
- Implement panelized architecture with dynamic panel lifecycle from categories.
- Add full CRUD for categories/links, modal-based create/edit UX, and logging visibility.
- Add drag-and-drop ordering for panels/categories/links with DB persistence, including cross-panel link moves.
- Add keyboard shortcuts (`1`-`9`) for panel switching and inactivity-based refresh.
- Add theme system: light/dark toggle, first-visit system fallback, pre-paint apply, and iterative dark-mode contrast tuning.
- Add favicon support with fallback graphic.
- Add world clocks (analog + digital), then multiple layout/styling passes to align pane sizing and responsiveness.
- Add Google News Global pane (headline links + images) with independent auto-refresh.
- Enforce data rules:
  - block duplicate link names globally
  - block category deletion until all links in that category are removed
- Continue iterative UI polish based on prompt feedback (buttons/icons, pane borders, spacing, shadows, and visibility).
- Add README back-to-top anchors without changing existing TOC anchors or contents.
- Implement manual PostgreSQL backup and restore from the dashboard, protected by an admin secret.
- Rename `.env_example` to `.env.example`, move the app source/build files under `docker/`, and update Docker Compose/build references.
- Verify backup/restore live in Docker, then fix PostgreSQL client/server version mismatch in the app image.
- Rename `DB Ops` to `DB Backup/Restore`, move the control beside the theme toggle, and switch restore from latest-only to selecting one of the five newest backups.
- Format restore names from backup timestamps, enforce a hard 5-backup retention cap, and delete older backups when new ones exceed that cap.
- Unify button theming so dark mode uses white button text and light mode uses green buttons with white text via shared theme variables.
- After restore, require a personal-dashboard restart, gray out the UI, block clicks, and keep the dashboard locked until the app restarts.
- Repeatedly rebuild, restart, and verify the app/database stack with `docker compose`.

[Back to top](#top)

## Special Notes
Manual database operations are controlled by:

- `DB_OPS_ENABLED`: enable the in-app backup/restore controls.
- `DB_OPS_SECRET`: required admin secret for backup/restore API calls.
- `DB_BACKUP_DIR`: backup directory inside the app container.
- `DB_BACKUP_VOLUME`: host path mounted to the backup directory.
- `DB_BACKUP_RETENTION_DAYS`: delete backups older than this after each successful backup.

With database ops enabled, use the `DB Backup/Restore` button in the dashboard to:

- Create an immediate PostgreSQL backup. Only the five most recent backup files are kept; creating a sixth or later backup deletes the older backup files.
- Restore one of the five most recent backup files, labeled from the backup timestamp as `day/month/year hours/minutes/seconds`.
- Restart the personal-dashboard after a restore so the restored database is picked up; the UI stays locked and mouse interaction is blocked until the app is restarted.

[Back to top](#top)
