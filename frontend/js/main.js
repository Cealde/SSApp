document.addEventListener('DOMContentLoaded', () => {
    const statusEl = document.getElementById('status');
    const sendBtn = document.getElementById('send-btn');
    const messageInput = document.getElementById('message-input');
    const responseEl = document.getElementById('response');

    // Fetch backend status on page load
    fetch('/api/status')
        .then(res => res.json())
        .then(data => {
            statusEl.textContent = `Status: ${data.message}`;
        })
        .catch(err => {
            statusEl.textContent = 'Failed to connect to backend';
            console.error('Error fetching status:', err);
        });

    // Send message to backend
    sendBtn.addEventListener('click', () => {
        const message = messageInput.value.trim();
        if (!message) return;

        responseEl.textContent = 'Sending...';

        fetch('/api/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ message })
        })
            .then(res => res.json())
            .then(data => {
                responseEl.textContent = `Backend response: ${data.response}`;
            })
            .catch(err => {
                responseEl.textContent = 'Error sending message';
                console.error('Error in chat:', err);
            });
    });
});
