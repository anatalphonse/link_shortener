
import { Pool, PoolConfig } from 'pg';

const poolConfig: PoolConfig = process.env.DATABASE_URL
    ? { connectionString: process.env.DATABASE_URL }
    : {
        user: process.env.PGUSER || 'postgres',
        host: process.env.PGHOST || 'localhost',
        database: process.env.PGDATABASE || 'short',
        password: process.env.PGPASSWORD || '1236',
        port: Number(process.env.PGPORT) || 5432,
    };

if (process.env.PGSSLMODE === 'require') {
    poolConfig.ssl = { rejectUnauthorized: false };
}

const pool = new Pool(poolConfig);

// Helper to ensure schema exists - straightforward port from server.js
export async function ensureSchema() {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS links (
          id BIGSERIAL PRIMARY KEY,
          short_code VARCHAR(8) UNIQUE NOT NULL,
          long_url TEXT NOT NULL,
          click_count BIGINT NOT NULL DEFAULT 0,
          last_clicked_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
  `);
    // Idempotent column additions
    await pool.query('ALTER TABLE links ADD COLUMN IF NOT EXISTS click_count BIGINT NOT NULL DEFAULT 0');
    await pool.query('ALTER TABLE links ADD COLUMN IF NOT EXISTS last_clicked_at TIMESTAMPTZ');
    await pool.query('ALTER TABLE links ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()');
}

// Run schema check lazily or on import? 
// For safety in this migration, let's export a query wrapper that ensures schema once or we assume it's done.
// We'll export the pool directly for use in API routes.

export default pool;
