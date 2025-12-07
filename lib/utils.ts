
import crypto from 'crypto';

export function generateShortCode(length = 8): string {
    let output = '';
    while (output.length < length) {
        output += crypto.randomBytes(6).toString('base64url').replace(/[^A-Za-z0-9]/g, '');
    }
    return output.slice(0, length);
}

export function isValidUrl(candidate: string): boolean {
    try {
        const parsed = new URL(candidate);
        return ['http:', 'https:'].includes(parsed.protocol);
    } catch {
        return false;
    }
}

export interface LinkRaw {
    short_code: string;
    long_url: string;
    click_count: string | number;
    last_clicked_at: Date | null;
    created_at: Date;
}

export interface LinkResponse {
    short_code: string;
    long_url: string;
    click_count: number;
    last_clicked_at: Date | null;
    created_at: Date;
    short_link: string;
}

export function formatLinkResponse(row: LinkRaw): LinkResponse {
    const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
    return {
        short_code: row.short_code,
        long_url: row.long_url,
        click_count: Number(row.click_count) || 0,
        last_clicked_at: row.last_clicked_at,
        created_at: row.created_at,
        short_link: `${BASE_URL}/${row.short_code}`,
    };
}
