document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('user-form');
    const input = document.getElementById('text-input');
    const fileInput = document.getElementById('file-input');
    const output = document.getElementById('output');

    createColorpalette(["#235E5E", "#558968", "#558968", "#EFECDE", "#381A1A"]);

    form.addEventListener('submit', (e) => {
        e.preventDefault();

        const text = input.value.trim();
        const files = fileInput.files;

        if (!text && files.length === 0) {
            output.textContent = 'Please enter text or select at least one file.';
            return;
        }

        const formData = new FormData();
        formData.append('text', text);
        for (const file of files) {
            formData.append('files', file);
        }

        output.textContent = 'Sending...';

        fetch('/api/give-files', {
            method: 'POST',
            body: formData
        })
            .then(res => {
                if (!res.ok) throw new Error('HTTP ' + res.status);
                return res.json();
            })
            .then(data => {
                output.textContent = '';
                const aiResult = data.ai_result || data.ai_response || data.code;
                if (aiResult) {
                    if (
                        typeof aiResult === 'string' &&
                        (aiResult.includes('<html') || aiResult.includes('<!DOCTYPE') || aiResult.includes('</'))
                    ) {
                        createSubPage(aiResult);
                    } else {
                        output.textContent = typeof aiResult === 'object' ? JSON.stringify(aiResult, null, 2) : aiResult;
                    }
                }
            })
            .catch(err => {
                output.textContent = 'Error: ' + err.message;
                console.error(err);
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
            const code = data.code || data.html;
            if (code && code.trim()) {
                createSubPage(code);
            }
        })
        .catch(err => {
            console.error('Error loading initial code:', err);
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

function createColorpalette(colors) {

    const palleteContainer = document.createElement('div');
    palleteContainer.className = "palette";

    colors.forEach(color => {
        const sw = document.createElement('div');

        sw.className = "sw";
        sw.style.backgroundColor = color;

        palleteContainer.appendChild(sw);
    });

    const target = document.getElementById('palette-container') || document.body;
    target.appendChild(palleteContainer);
}