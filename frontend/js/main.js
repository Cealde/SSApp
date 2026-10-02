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


        const formData = new FormData();
        formData.append('text', text);
        for (const file of files) {
            formData.append('files', file);
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
    fetch('/api/give-code', {
        method: 'POST',
    })
        .then(res => {
            if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
            return res.json();
        })
        .then(data => {
            const code = data.code || data.html || data;
            createSubPage(code);
        })
        .catch(err => {
            output.textContent = 'Error loading mini HTML from backend.';
            console.error('Error:', err);
        });
    
});

function createSubPage(htmlCode) {
    if (typeof htmlCode === 'object' && htmlCode !== null) {
        htmlCode = htmlCode.code || htmlCode.html || '';
    }

    const target = document.getElementById('query') || document.body;
    target.innerHTML = '';

    const mainBox = document.createElement('div');
    const htmlBox = document.createElement('iframe');

    mainBox.style.width = '100%';
    mainBox.style.height = '600px';
    mainBox.style.marginTop = '20px';

    htmlBox.style.width = '100%';
    htmlBox.style.height = '100%';
    htmlBox.style.border = '1px solid #ccc';
    htmlBox.style.borderRadius = '8px';

    htmlBox.srcdoc = htmlCode;
    
    mainBox.appendChild(htmlBox);
    target.appendChild(mainBox);
}