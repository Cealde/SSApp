document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('user-form');
    const input = document.getElementById('text-input');
    const fileInput = document.getElementById('file-input');
    const output = document.getElementById('output');

    form.addEventListener('submit', (e) => {
        e.preventDefault();

        const text = input.value.trim();
        const files = fileInput.files;   

        if (!text && files.length === 0) {
            output.textContent = 'Please enter text or select at least one PDF.';
            return;
        }

        // pdf appended to files and list into backend
        const formData = new FormData();
        formData.append('text', text);
        for (const file of files) {
            formData.append('files', file);   // must match backend parameter name
        }

        fetch('/api/give-files', {
            method: 'POST',
            body: formData
        })
            .then(res => res.json())
            .then(data => {
                output.textContent = JSON.stringify(data, null, 2);
            })
            .catch(err => {
                output.textContent = 'Error connecting to backend server.';
                console.error('Error:', err);
            });
    });
});