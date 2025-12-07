
import { NextResponse } from 'next/server';

export async function GET() {
    return NextResponse.json({
        ok: true,
        uptime: process.uptime(), // Node.js uptime for the API process
        timestamp: new Date().toISOString(),
    });
}
