## Link Shortener

Production-ready Express service that shortens URLs and stores them in PostgreSQL with a tiny frontend for submissions.

### Prerequisites

- Node.js 18+
- PostgreSQL 13+ (or managed equivalent)

### Setup

1. Install dependencies
   ```
   npm install
   ```
2. Copy the sample environment file and supply your values:
   ```
   cp env.example .env
   ```
3. Ensure your database has a `links` table with a unique `short_code` column:
   ```sql
   CREATE TABLE IF NOT EXISTS links (
     id BIGSERIAL PRIMARY KEY,
     short_code VARCHAR(16) UNIQUE NOT NULL,
     long_url TEXT NOT NULL,
     created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
   );
   ```

### Running

- Development (auto-reload on Node 18+): `npm run dev`
- Production: `npm start`

The app listens on `PORT` and exposes:

- `POST /api/shorten` – create a short link with validation, rate limiting, and collision handling
- `GET /:shortCode` – redirect to the stored URL
- `GET /healthz` – health probe for load balancers

Static assets in `public/` are served automatically.

