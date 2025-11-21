## TinyLink – Take Home Assignment

Production-ready Express + Postgres service that powers a mini bit.ly clone with a thoughtful UI for managing URLs, viewing stats, and handling redirects.

### Prerequisites

- Node.js 18+
- PostgreSQL 13+ (Neon, Supabase, Railway, Render, etc.)

### Environment

Copy the provided `.env.example` to `.env` and adjust for your deployment target:

```
cp .env.example .env
```

Fields you must supply for hosted databases:

- `DATABASE_URL` **or** the individual `PG*` fields
- `BASE_URL` pointing to the deployed hostname (used when returning short links)
- `TRUST_PROXY=true` when running behind Vercel/Render/Railway load balancers

### Database Schema

```sql
CREATE TABLE IF NOT EXISTS links (
  id BIGSERIAL PRIMARY KEY,
  short_code VARCHAR(8) UNIQUE NOT NULL,
  long_url TEXT NOT NULL,
  click_count BIGINT NOT NULL DEFAULT 0,
  last_clicked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### Running Locally

```bash
npm install
npm run dev     # watch mode on Node 18+
# or
npm start
```

Visit `http://localhost:3000` for the dashboard and `http://localhost:3000/code/:code` for per-link stats.

### API Contract

| Method | Path                | Description                                     |
|--------|---------------------|-------------------------------------------------|
| POST   | `/api/links`        | Create link (optional `custom_code`, 409 on dup)|
| GET    | `/api/links`        | List links (optional `?q=search`)               |
| GET    | `/api/links/:code`  | Stats for a single link                         |
| DELETE | `/api/links/:code`  | Delete link                                     |
| GET    | `/healthz`          | Health/readiness probe                          |
| GET    | `/:code`            | Redirect + increments click count               |

All codes obey `[A-Za-z0-9]{6,8}`.

### Frontend Routes

- `/` – Dashboard with add form, search, responsive table, inline validation, toast-like feedback, and copy/delete actions.
- `/code/:code` – Stats page showing destination URL, total clicks, created time, last clicked time, and destructive actions.

Both pages are plain HTML + CSS + vanilla JS and are responsive down to mobile breakpoints, including empty/loading/error states.

### Deployment

Recommended free stack:

- Neon or Supabase for Postgres
- Render / Railway / Fly.io / Vercel (via Node serverless) for hosting

Set `BASE_URL` to your public hostname and `TRUST_PROXY=true`. A production deployment should also configure SSL (`PGSSLMODE=require`).

### Testing checklist

1. `GET /healthz` returns `{ ok: true, version, uptime }`.
2. Creating a link with/without custom code succeeds; duplicates return HTTP 409.
3. Visit `/:code` to ensure 302 redirect increments `click_count` and `last_clicked_at`.
4. Deleting a link removes it from the dashboard and `/:code` now returns 404.
5. UI: verify validation messages, disabled states, mobile layout, copy buttons, stats page flows.

