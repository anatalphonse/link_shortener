
import { NextRequest, NextResponse } from 'next/server';
import pool, { ensureSchema } from '@/lib/db';
import { generateShortCode, isValidUrl, formatLinkResponse } from '@/lib/utils';

// Ensure schema on first use might be safer to do at app start, but for now we do it lazily or assume done.
// We'll call it once here to be safe if server restarts.
ensureSchema().catch(console.error);

async function ensureUniqueCode(preferredCode?: string): Promise<string> {
    if (preferredCode) return preferredCode;
    const maxAttempts = 5;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const generated = generateShortCode(8);
        const res = await pool.query('SELECT 1 FROM links WHERE short_code = $1', [generated]);
        if (res.rowCount === 0) return generated;
    }
    throw new Error('Failed to generate unique short code');
}

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('q')?.trim() || '';

    try {
        let result;
        if (search) {
            result = await pool.query(
                `SELECT short_code, long_url, click_count, last_clicked_at, created_at
                 FROM links
                 WHERE short_code ILIKE $1 OR long_url ILIKE $1
                 ORDER BY created_at DESC`,
                [`%${search}%`]
            );
        } else {
            result = await pool.query(
                `SELECT short_code, long_url, click_count, last_clicked_at, created_at
                 FROM links
                 ORDER BY created_at DESC`
            );
        }
        return NextResponse.json(result.rows.map(formatLinkResponse));
    } catch (err: any) {
        console.error('Error listing links:', err);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const long_url = typeof body.long_url === 'string' ? body.long_url.trim() : '';
        const custom_code_raw = typeof body.custom_code === 'string' ? body.custom_code.trim() : '';

        if (!long_url) return NextResponse.json({ error: 'long_url is required' }, { status: 400 });
        if (!isValidUrl(long_url)) return NextResponse.json({ error: 'URL must start with http:// or https://' }, { status: 400 });

        const SHORT_CODE_REGEX = /^[A-Za-z0-9]{6,8}$/;
        if (custom_code_raw && !SHORT_CODE_REGEX.test(custom_code_raw)) {
            return NextResponse.json({ error: 'custom_code must match [A-Za-z0-9]{6,8}' }, { status: 400 });
        }

        const short_code = await ensureUniqueCode(custom_code_raw || undefined);

        const insertResult = await pool.query(
            `INSERT INTO links (short_code, long_url, click_count)
             VALUES ($1, $2, 0)
             ON CONFLICT (short_code) DO NOTHING
             RETURNING short_code, long_url, click_count, last_clicked_at, created_at`,
            [short_code, long_url]
        );

        if (insertResult.rowCount === 0) {
            return NextResponse.json({ error: 'Short code already exists' }, { status: 409 });
        }

        return NextResponse.json(formatLinkResponse(insertResult.rows[0]), { status: 201 });

    } catch (err: any) {
        if (err.code === '23505') {
            return NextResponse.json({ error: 'Short code already exists' }, { status: 409 });
        }
        console.error('Error creating link:', err);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
