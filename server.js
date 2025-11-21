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

// Helper function to generate a short code
function generateShortCode(length = 8) {
    return crypto.randomBytes(6).toString('base64url').slice(0, length);
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

// --- API Endpoint: Create Short Link ---
app.post('/api/shorten', async (req, res, next) => {
    const long_url = typeof req.body?.long_url === 'string' ? req.body.long_url.trim() : '';
    
    if (!long_url) {
        return res.status(400).json({ error: 'long_url is required' });
    }

    if (!isValidUrl(long_url)) {
        return res.status(400).json({ error: 'URL must start with http:// or https://' });
    }
    
    const maxAttempts = 5;
    let attempt = 0;
    let short_code;

    try {
        while (attempt < maxAttempts) {
            short_code = generateShortCode();
            const result = await pool.query(
                'INSERT INTO links (short_code, long_url) VALUES ($1, $2) ON CONFLICT (short_code) DO NOTHING RETURNING short_code',
                [short_code, long_url]
            );

            if (result.rows.length) {
                const short_link = `${BASE_URL}/${result.rows[0].short_code}`;
                return res.status(201).json({ short_link });
            }

            attempt += 1;
        }

        throw new Error('Failed to generate unique short code');
    } catch (err) {
        console.error('Database error on shortening:', err);
        next(err);
    }
});

// --- Redirect Route (Handles the short link click) ---
app.get('/:shortCode', async (req, res, next) => {
    const { shortCode } = req.params;

    try {
        const result = await pool.query(
            'SELECT long_url FROM links WHERE short_code = $1',
            [shortCode]
        );

        if (result.rows.length === 0) {
            return res.status(404).send('Short link not found.');
        }

        const long_url = result.rows[0].long_url;
        
        // HTTP 302 Temporary Redirect is commonly used for shorteners
        res.redirect(302, long_url); 
    } catch (err) {
        console.error('Database error on redirect:', err);
        next(err);
    }
});

// --- Health Check ---
app.get('/healthz', (req, res) => {
    res.status(200).json({ status: 'ok', uptime: process.uptime() });
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