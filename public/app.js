// public/app.js
document.getElementById('shortenForm').addEventListener('submit', async (e) => {
    e.preventDefault(); // Stop the form from performing a traditional submission
    
    const longUrlInput = document.getElementById('longUrl');
    const longUrl = longUrlInput.value.trim();
    const resultDiv = document.getElementById('result');
    const shortLinkAnchor = document.getElementById('shortLink');
    const errorElement = document.getElementById('error');

    // Reset previous states
    resultDiv.style.display = 'none';
    errorElement.style.display = 'none';
    errorElement.textContent = '';

    try {
        const response = await fetch('/api/shorten', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ long_url: longUrl })
        });

        const data = await response.json();

        if (response.ok) {
            // Success: Display the short link
            shortLinkAnchor.textContent = data.short_link;
            shortLinkAnchor.href = data.short_link;
            resultDiv.style.display = 'block';
            longUrlInput.value = ''; // Clear the input
        } else {
            // Error: Display the API error message
            errorElement.textContent = data.error || 'An unknown error occurred.';
            errorElement.style.display = 'block';
        }

    } catch (error) {
        console.error('Fetch error:', error);
        errorElement.textContent = 'Could not connect to the server.';
        errorElement.style.display = 'block';
    }
});