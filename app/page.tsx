
'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { LinkResponse } from '@/lib/utils';

export default function Dashboard() {
  const [links, setLinks] = useState<LinkResponse[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [createError, setCreateError] = useState('');
  const [createSuccess, setCreateSuccess] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [tableState, setTableState] = useState('');

  const formRef = useRef<HTMLFormElement>(null);

  const fetchLinks = async (term = '') => {
    setIsLoading(true);
    setTableState('Loading links...');
    try {
      const query = term ? `?q=${encodeURIComponent(term)}` : '';
      const res = await fetch(`/api/links${query}`);
      if (!res.ok) throw new Error('Failed to load links');
      const data = await res.json();
      setLinks(data);
      setTableState(data.length ? '' : term ? 'No links match your search.' : 'No links yet. Create your first short link!');
    } catch (err) {
      console.error(err);
      setTableState('Unable to load links. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Debounce search
    const timeout = setTimeout(() => {
      fetchLinks(searchTerm);
    }, 300);
    return () => clearTimeout(timeout);
  }, [searchTerm]);

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setCreateError('');
    setCreateSuccess('');
    setIsCreating(true);

    const formData = new FormData(e.currentTarget);
    const payload = Object.fromEntries(formData.entries());

    try {
      const res = await fetch('/api/links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Unable to create link.');

      setCreateSuccess(`Created ${data.short_link}`);
      formRef.current?.reset();
      fetchLinks(searchTerm);
    } catch (err: any) {
      setCreateError(err.message);
    } finally {
      setIsCreating(false);
    }
  };

  const handleDelete = async (code: string) => {
    if (!confirm(`Delete short link ${code}?`)) return;
    try {
      const res = await fetch(`/api/links/${code}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Unable to delete link.');
      fetchLinks(searchTerm);
    } catch (err: any) {
      alert(err.message);
    }
  };

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

  return (
    <main className="dashboard">
      <section className="card">
        <h2>Add a new link</h2>
        <form ref={formRef} onSubmit={handleCreate} className="form-grid">
          <label>
            Destination URL
            <input type="url" name="long_url" placeholder="https://www.example.com/docs" required />
          </label>
          <label>
            Custom code (optional)
            <input type="text" name="custom_code" placeholder="letters or numbers" pattern="[A-Za-z0-9]{6,8}" />
          </label>
          <div className="form-actions">
            <button type="submit" disabled={isCreating}>
              {isCreating ? 'Creating...' : 'Create link'}
            </button>
          </div>
          {createError && <p className="error" role="alert">{createError}</p>}
          {createSuccess && <p className="success" role="status">{createSuccess}</p>}
        </form>
      </section>

      <section className="card">
        <div className="card-header">
          <h2>All links</h2>
          <input
            type="search"
            placeholder="Filter by code or URL"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="state">{tableState}</div>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Short code</th>
                <th>Destination</th>
                <th>Clicks</th>
                <th>Last clicked</th>
                <th></th>
              </tr>
            </thead>
            <tbody id="linksTableBody">
              {links.map((link) => (
                <tr key={link.short_code}>
                  <td>
                    <div className="badge">
                      <span>{link.short_code}</span>
                    </div>
                  </td>
                  <td>
                    <span className="truncate" title={link.long_url}>{link.long_url}</span>
                  </td>
                  <td>{link.click_count}</td>
                  <td>{link.last_clicked_at ? new Date(link.last_clicked_at).toLocaleString() : '—'}</td>
                  <td>
                    <div className="actions">
                      <button
                        className="ghost-button"
                        onClick={(e) => handleCopy(link.short_link, e.currentTarget)}
                      >
                        Copy
                      </button>
                      <Link className="ghost-button" href={`/code/${link.short_code}`}>Stats</Link>
                      <button
                        className="ghost-button danger"
                        onClick={() => handleDelete(link.short_code)}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
