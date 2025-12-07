
import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { formatLinkResponse } from '@/lib/utils';

export async function GET(req: NextRequest, props: { params: Promise<{ code: string }> }) {
    const params = await props.params;
    const { code } = params;
    try {
        const result = await pool.query(
            `SELECT short_code, long_url, click_count, last_clicked_at, created_at
             FROM links WHERE short_code = $1`,
            [code]
        );
        if (!result.rowCount) {
            return NextResponse.json({ error: 'Not found' }, { status: 404 });
        }
        return NextResponse.json(formatLinkResponse(result.rows[0]));
    } catch (err) {
        console.error('Error fetching link:', err);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest, props: { params: Promise<{ code: string }> }) {
    const params = await props.params;
    const { code } = params;
    try {
        const result = await pool.query('DELETE FROM links WHERE short_code = $1 RETURNING short_code', [code]);
        if (!result.rowCount) {
            return NextResponse.json({ error: 'Not found' }, { status: 404 });
        }
        return new NextResponse(null, { status: 204 });
    } catch (err) {
        console.error('Error deleting link:', err);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
