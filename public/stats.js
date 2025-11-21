const code = window.location.pathname.split('/').pop();
const statsState = document.getElementById('statsState');
const statsContent = document.getElementById('statsContent');
const codeLabel = document.getElementById('codeLabel');
const shortCodeDisplay = document.getElementById('shortCodeDisplay');
const longUrl = document.getElementById('longUrl');
const clicks = document.getElementById('clicks');
const lastClicked = document.getElementById('lastClicked');
const createdAt = document.getElementById('createdAt');
const shortLinkAnchor = document.getElementById('shortLink');
const copyBtn = document.getElementById('copyBtn');
const deleteBtn = document.getElementById('deleteBtn');

const formatDate = (iso) => {
    if (!iso) return 'Not clicked yet';
    return new Date(iso).toLocaleString();
};

const fetchStats = async () => {
    statsState.textContent = 'Loading stats…';
    try {
        const res = await fetch(`/api/links/${code}`);
        if (!res.ok) {
            throw new Error('Not found');
        }
        const data = await res.json();
        codeLabel.textContent = data.short_code;
        shortCodeDisplay.textContent = `/${data.short_code}`;
        longUrl.textContent = data.long_url;
        longUrl.href = data.long_url;
        clicks.textContent = data.click_count;
        lastClicked.textContent = formatDate(data.last_clicked_at);
        createdAt.textContent = formatDate(data.created_at);
        shortLinkAnchor.href = data.short_link;
        shortLinkAnchor.textContent = 'Open short link';

        statsState.textContent = '';
        statsContent.hidden = false;
    } catch (err) {
        statsState.textContent = 'Link not found or has been deleted.';
        statsContent.hidden = true;
    }
};

const handleCopy = async () => {
    const link = shortLinkAnchor.href;
    try {
        await navigator.clipboard.writeText(link);
        copyBtn.textContent = 'Copied!';
        setTimeout(() => {
            copyBtn.textContent = 'Copy link';
        }, 1500);
    } catch {
        copyBtn.textContent = 'Failed';
    }
};

const handleDelete = async () => {
    const confirmDelete = confirm(`Delete short link ${code}? This cannot be undone.`);
    if (!confirmDelete) return;
    deleteBtn.disabled = true;
    deleteBtn.textContent = 'Deleting…';
    try {
        const res = await fetch(`/api/links/${code}`, { method: 'DELETE' });
        if (!res.ok) {
            throw new Error('Failed to delete link.');
        }
        window.location.href = '/';
    } catch (err) {
        alert(err.message);
        deleteBtn.disabled = false;
        deleteBtn.textContent = 'Delete';
    }
};

copyBtn?.addEventListener('click', handleCopy);
deleteBtn?.addEventListener('click', handleDelete);

fetchStats();

