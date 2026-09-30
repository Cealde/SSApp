document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('user-form');
    const input = document.getElementById('text-input');
    const output = document.getElementById('output');

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const text = input.value.trim();
        if (!text) return;

        fetch('/api/submit', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ text })
        })
            .then(res => res.json())
            .then(data => {
                output.textContent = data.message;
            })
            .catch(err => {
                output.textContent = 'Error connecting to backend server.';
                console.error('Error:', err);
            });
    });
});
