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



});

function createSubPage(htmlCode) {
    const mainBox = document.createElement('div');
    const htmlBox = document.createElement('iframe');

    htmlBox.style.height = '100%';
    htmlBox.style.width = '100%';
    htmlBox.style.border = '1px solid black'

    mainBox.style.height = '50%';
    mainBox.style.width = '50%';

    mainBox.appendChild(htmlBox);

    const doc = htmlBox.document || htmlBox.contentWindow.document;

    doc.open();
    doc.write(htmlCode);
    doc.close();
}