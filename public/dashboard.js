const yearEl = document.getElementById('year');
if (yearEl) {
    yearEl.textContent = new Date().getFullYear();
}

const form = document.getElementById('createForm');
const submitBtn = document.getElementById('submitBtn');
const formError = document.getElementById('formError');
const formSuccess = document.getElementById('formSuccess');
const tableBody = document.getElementById('linksTableBody');
const tableState = document.getElementById('tableState');
const searchInput = document.getElementById('searchInput');

let links = [];
let isLoading = false;
let searchTerm = '';
let debounceTimeout;

const formatDate = (iso) => {
    if (!iso) return '—';
    const date = new Date(iso);
    return date.toLocaleString();
};

const renderTable = () => {
    tableBody.innerHTML = '';
    if (!links.length) {
        tableState.textContent = searchTerm ? 'No links match your search.' : 'No links yet. Create your first short link!';
        return;
    }
    tableState.textContent = '';

    links.forEach((link) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>
                <div class="badge">
                    <span>${link.short_code}</span>
                </div>
            </td>
            <td>
                <span class="truncate" title="${link.long_url}">${link.long_url}</span>
            </td>
            <td>${link.click_count}</td>
            <td>${formatDate(link.last_clicked_at)}</td>
            <td>
                <div class="actions">
                    <button class="ghost-button" data-copy="${link.short_link}">Copy</button>
                    <a class="ghost-button" href="/code/${link.short_code}">Stats</a>
                    <button class="ghost-button danger" data-delete="${link.short_code}">Delete</button>
                </div>
            </td>
        `;
        tableBody.appendChild(tr);
    });
};

const setLoading = (state, message = 'Loading links...') => {
    isLoading = state;
    tableState.textContent = state ? message : '';
};

const fetchLinks = async () => {
    if (isLoading) return;
    try {
        setLoading(true);
        const query = searchTerm ? `?q=${encodeURIComponent(searchTerm)}` : '';
        const res = await fetch(`/api/links${query}`);
        if (!res.ok) {
            throw new Error('Failed to load links');
        }
        links = await res.json();
        renderTable();
    } catch (err) {
        console.error(err);
        tableState.textContent = 'Unable to load links. Please try again.';
    } finally {
        setLoading(false);
    }
};

const handleCreate = async (event) => {
    event.preventDefault();
    formError.textContent = '';
    formSuccess.textContent = '';

    const formData = new FormData(form);
    const payload = Object.fromEntries(formData.entries());

    if (!payload.long_url) {
        formError.textContent = 'Destination URL is required.';
        return;
    }

    if (payload.custom_code && !/^[A-Za-z0-9]{6,8}$/.test(payload.custom_code)) {
        formError.textContent = 'Custom code must be 6-8 letters/numbers.';
        return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Creating...';

    try {
        const res = await fetch('/api/links', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });

        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
            throw new Error(data.error || 'Unable to create link.');
        }

        form.reset();
        formSuccess.textContent = `Created ${data.short_link}`;
        await fetchLinks();
    } catch (err) {
        formError.textContent = err.message;
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Create link';
    }
};

const handleTableClick = async (event) => {
    const copyValue = event.target.getAttribute('data-copy');
    const deleteCode = event.target.getAttribute('data-delete');

    if (copyValue) {
        try {
            await navigator.clipboard.writeText(copyValue);
            event.target.textContent = 'Copied!';
            setTimeout(() => {
                event.target.textContent = 'Copy';
            }, 1500);
        } catch {
            event.target.textContent = 'Failed';
        }
    }

    if (deleteCode) {
        const confirmDelete = confirm(`Delete short link ${deleteCode}?`);
        if (!confirmDelete) return;
        event.target.disabled = true;
        event.target.textContent = 'Deleting...';
        try {
            const res = await fetch(`/api/links/${deleteCode}`, { method: 'DELETE' });
            if (!res.ok) {
                throw new Error('Unable to delete link.');
            }
            await fetchLinks();
        } catch (err) {
            alert(err.message);
        }
    }
};

const handleSearch = (event) => {
    window.clearTimeout(debounceTimeout);
    debounceTimeout = window.setTimeout(() => {
        searchTerm = event.target.value.trim();
        fetchLinks();
    }, 300);
};

form?.addEventListener('submit', handleCreate);
tableBody?.addEventListener('click', handleTableClick);
searchInput?.addEventListener('input', handleSearch);

fetchLinks();

