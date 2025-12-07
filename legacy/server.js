// server.js
require('dotenv').config();

const express = require('express');
const { Pool } = require('pg');
const path = require('path');
const crypto = require('crypto');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3000;
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;
const APP_VERSION = process.env.APP_VERSION || '1.0.0';
const SHORT_CODE_REGEX = /^[A-Za-z0-9]{6,8}$/;

// --- Configuration ---
const poolConfig = process.env.DATABASE_URL
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

async function ensureSchema() {
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
    await pool.query('ALTER TABLE links ADD COLUMN IF NOT EXISTS click_count BIGINT NOT NULL DEFAULT 0');
    await pool.query('ALTER TABLE links ADD COLUMN IF NOT EXISTS last_clicked_at TIMESTAMPTZ');
    await pool.query('ALTER TABLE links ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()');
}

ensureSchema().catch((err) => {
    console.error('Failed to ensure schema:', err);
    process.exit(1);
});

// Helper functions
function generateShortCode(length = 8) {
    let output = '';
    while (output.length < length) {
        output += crypto.randomBytes(6).toString('base64url').replace(/[^A-Za-z0-9]/g, '');
    }
    return output.slice(0, length);
}

function isValidUrl(candidate) {
    try {
        const parsed = new URL(candidate);
        return ['http:', 'https:'].includes(parsed.protocol);
    } catch {
        return false;
    }
}

// --- Middleware ---
const shouldTrustProxy = process.env.TRUST_PROXY ?? (process.env.NODE_ENV === 'production' ? 'true' : 'false');
if (shouldTrustProxy === 'true') {
    app.set('trust proxy', 1);
}

app.use(helmet());
app.use(compression());
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express.json({ limit: '1mb' })); // To parse JSON request bodies

const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: Number(process.env.RATE_LIMIT_MAX || 100),
    standardHeaders: true,
    legacyHeaders: false,
});

app.use('/api/', apiLimiter);
app.use(express.static(path.join(__dirname, 'public'))); // Serve static frontend files

function formatLinkResponse(row) {
    return {
        short_code: row.short_code,
        long_url: row.long_url,
        click_count: Number(row.click_count) || 0,
        last_clicked_at: row.last_clicked_at,
        created_at: row.created_at,
        short_link: `${BASE_URL}/${row.short_code}`,
    };
}

async function ensureUniqueCode(preferredCode) {
    if (preferredCode) {
        return preferredCode;
    }

    const maxAttempts = 5;
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        const generated = generateShortCode(8);
        const exists = await pool.query('SELECT 1 FROM links WHERE short_code = $1', [generated]);
        if (exists.rowCount === 0) {
            return generated;
        }
    }
    throw new Error('Failed to generate unique short code');
}

// --- API: Create Link ---
app.post('/api/links', async (req, res, next) => {
    const long_url = typeof req.body?.long_url === 'string' ? req.body.long_url.trim() : '';
    const custom_code_raw = typeof req.body?.custom_code === 'string' ? req.body.custom_code.trim() : '';

    if (!long_url) {
        return res.status(400).json({ error: 'long_url is required' });
    }
    if (!isValidUrl(long_url)) {
        return res.status(400).json({ error: 'URL must start with http:// or https://' });
    }

    if (custom_code_raw && !SHORT_CODE_REGEX.test(custom_code_raw)) {
        return res.status(400).json({ error: 'custom_code must match [A-Za-z0-9]{6,8}' });
    }

    try {
        const short_code = await ensureUniqueCode(custom_code_raw || '');
        const insertResult = await pool.query(
            `INSERT INTO links (short_code, long_url, click_count)
             VALUES ($1, $2, 0)
             ON CONFLICT (short_code) DO NOTHING
             RETURNING short_code, long_url, click_count, last_clicked_at, created_at`,
            [short_code, long_url],
        );

        if (insertResult.rowCount === 0) {
            return res.status(409).json({ error: 'Short code already exists' });
        }

        return res.status(201).json(formatLinkResponse(insertResult.rows[0]));
    } catch (err) {
        if (err.code === '23505') {
            return res.status(409).json({ error: 'Short code already exists' });
        }
        console.error('Error creating link:', err);
        return next(err);
    }
});

// --- API: List Links ---
app.get('/api/links', async (req, res, next) => {
    const search = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const filterClauses = [];
    const values = [];

    if (search) {
        values.push(`%${search}%`);
        filterClauses.push('(short_code ILIKE $1 OR long_url ILIKE $1)');
    }

    const whereClause = filterClauses.length ? `WHERE ${filterClauses.join(' AND ')}` : '';

    try {
        const result = await pool.query(
            `SELECT short_code, long_url, click_count, last_clicked_at, created_at
             FROM links
             ${whereClause}
             ORDER BY created_at DESC`,
            values,
        );
        return res.json(result.rows.map(formatLinkResponse));
    } catch (err) {
        console.error('Error listing links:', err);
        return next(err);
    }
});

// --- API: Single Link ---
app.get('/api/links/:code', async (req, res, next) => {
    const { code } = req.params;
    try {
        const result = await pool.query(
            `SELECT short_code, long_url, click_count, last_clicked_at, created_at
             FROM links WHERE short_code = $1`,
            [code],
        );
        if (!result.rowCount) {
            return res.status(404).json({ error: 'Not found' });
        }
        return res.json(formatLinkResponse(result.rows[0]));
    } catch (err) {
        console.error('Error fetching link:', err);
        return next(err);
    }
});

// --- API: Delete Link ---
app.delete('/api/links/:code', async (req, res, next) => {
    const { code } = req.params;
    try {
        const result = await pool.query('DELETE FROM links WHERE short_code = $1 RETURNING short_code', [code]);
        if (!result.rowCount) {
            return res.status(404).json({ error: 'Not found' });
        }
        return res.status(204).send();
    } catch (err) {
        console.error('Error deleting link:', err);
        return next(err);
    }
});

// --- Redirect Route ---
app.get('/:shortCode', async (req, res, next) => {
    const { shortCode } = req.params;

    if (!SHORT_CODE_REGEX.test(shortCode)) {
        return res.status(404).send('Short link not found.');
    }

    try {
        const updateResult = await pool.query(
            `UPDATE links
             SET click_count = click_count + 1,
                 last_clicked_at = NOW()
             WHERE short_code = $1
             RETURNING long_url`,
            [shortCode],
        );

        if (!updateResult.rowCount) {
            return res.status(404).send('Short link not found.');
        }

        const long_url = updateResult.rows[0].long_url;
        return res.redirect(302, long_url);
    } catch (err) {
        console.error('Database error on redirect:', err);
        return next(err);
    }
});

// --- Health Check ---
app.get('/healthz', (req, res) => {
    res.status(200).json({
        ok: true,
        version: APP_VERSION,
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
    });
});

// --- Frontend Routes ---
app.get('/code/:code', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'stats.html'));
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// --- Error Handler ---
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
    const status = err.status || 500;
    res.status(status).json({
        error: status === 500 ? 'Internal server error' : err.message,
    });
});

// --- Start Server ---
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});