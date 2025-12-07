
import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET(req: NextRequest, props: { params: Promise<{ shortCode: string }> }) {
    const params = await props.params;
    const { shortCode } = params;
    const SHORT_CODE_REGEX = /^[A-Za-z0-9]{6,8}$/;

    if (!SHORT_CODE_REGEX.test(shortCode)) {
        return new NextResponse('Short link not found.', { status: 404 });
    }

    try {
        const updateResult = await pool.query(
            `UPDATE links
             SET click_count = click_count + 1,
                 last_clicked_at = NOW()
             WHERE short_code = $1
             RETURNING long_url`,
            [shortCode]
        );

        if (!updateResult.rowCount) {
            return new NextResponse('Short link not found.', { status: 404 });
        }

        const long_url = updateResult.rows[0].long_url;
        return NextResponse.redirect(long_url, 302);
    } catch (err) {
        console.error('Database error on redirect:', err);
        return new NextResponse('Internal Server Error', { status: 500 });
    }
}
