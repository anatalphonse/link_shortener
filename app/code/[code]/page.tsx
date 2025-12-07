
'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { LinkResponse } from '@/lib/utils';
import Link from 'next/link';

export default function StatsPage() {
    const params = useParams();
    const router = useRouter();
    const code = params.code as string;

    const [stats, setStats] = useState<LinkResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!code) return;
        const fetchStats = async () => {
            try {
                const res = await fetch(`/api/links/${code}`);
                if (!res.ok) throw new Error('Not found');
                const data = await res.json();
                setStats(data);
            } catch (err) {
                setError('Link not found or has been deleted.');
            } finally {
                setLoading(false);
            }
        };
        fetchStats();
    }, [code]);

    const handleCopy = async (text: string, btn: HTMLButtonElement) => {
        try {
            await navigator.clipboard.writeText(text);
            const original = btn.textContent;
            btn.textContent = 'Copied!';
            setTimeout(() => {
                btn.textContent = original;
            }, 1500);
        } catch {
            btn.textContent = 'Failed';
        }
    };

    const handleDelete = async () => {
        if (!confirm(`Delete short link ${code}? This cannot be undone.`)) return;
        try {
            const res = await fetch(`/api/links/${code}`, { method: 'DELETE' });
            if (!res.ok) throw new Error('Failed to delete link.');
            router.push('/');
        } catch (err: any) {
            alert(err.message);
        }
    };

    if (loading) {
        return (
            <main className="dashboard">
                <section className="card">
                    <div className="state">Loading stats…</div>
                </section>
            </main>
        );
    }

    if (error || !stats) {
        return (
            <main className="dashboard">
                <section className="card">
                    <div className="state">{error}</div>
                </section>
            </main>
        );
    }

    return (
        <main className="dashboard">
            <section className="card" id="statsCard">
                <h2>/{stats.short_code}</h2>
                <p><strong>Destination:</strong> <a href={stats.long_url} target="_blank" rel="noreferrer">{stats.long_url}</a></p>

                <div className="stats-grid">
                    <div>
                        <p className="subtitle">Total clicks</p>
                        <h3>{stats.click_count}</h3>
                    </div>
                    <div>
                        <p className="subtitle">Last clicked</p>
                        <h3>{stats.last_clicked_at ? new Date(stats.last_clicked_at).toLocaleString() : 'Not clicked yet'}</h3>
                    </div>
                    <div>
                        <p className="subtitle">Created at</p>
                        <h3>{new Date(stats.created_at).toLocaleString()}</h3>
                    </div>
                </div>

                <div className="actions">
                    <button
                        className="ghost-button"
                        onClick={(e) => handleCopy(stats.short_link, e.currentTarget)}
                    >
                        Copy link
                    </button>
                    <button className="ghost-button danger" onClick={handleDelete}>Delete</button>
                </div>
            </section>
        </main>
    );
}
