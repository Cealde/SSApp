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
            output.textContent = 'Please enter text or select at least one file.';
            return;
        }

        const formData = new FormData();
        formData.append('text', text);
        for (const file of files) {
            formData.append('files', file);
        }

        output.textContent = 'Processing files & optimizing images...';

        fetch('/api/give-files', {
            method: 'POST',
            body: formData
        })
            .then(res => {
                if (!res.ok) throw new Error('HTTP ' + res.status);
                return res.json();
            })
            .then(data => renderResults(data))
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
            const code = data.code || data.html || data;
            createSubPage(code);
        })
        .catch(err => {
            console.error('Error loading mini HTML:', err);
        });

    function renderResults(data) {
        output.innerHTML = '';

        const summary = document.createElement('p');
        summary.textContent = data.message;
        summary.style.fontWeight = 'bold';
        output.appendChild(summary);

        if (data.final_output && data.final_output.batch_summary) {
            const stagingSummary = document.createElement('div');
            stagingSummary.className = 'staging-summary';
            stagingSummary.style.background = '#f0f4f8';
            stagingSummary.style.padding = '10px 15px';
            stagingSummary.style.borderRadius = '6px';
            stagingSummary.style.margin = '10px 0 20px 0';

            const summaryTitle = document.createElement('h3');
            summaryTitle.textContent = `AI Staging Batch (${data.final_output.total_files_processed} document(s) staged)`;
            stagingSummary.appendChild(summaryTitle);

            const list = document.createElement('ul');
            for (const item of data.final_output.batch_summary) {
                const li = document.createElement('li');
                li.textContent = `${item.file} [${item.type.toUpperCase()}] — Images: ${item.images}, Size Savings: ${item.savings}`;
                list.appendChild(li);
            }
            stagingSummary.appendChild(list);
            output.appendChild(stagingSummary);
        }

        for (const f of data.files) {
            const card = document.createElement('div');
            card.className = 'file-card';
            card.style.border = '1px solid #ddd';
            card.style.borderRadius = '8px';
            card.style.padding = '15px';
            card.style.marginBottom = '15px';

            const heading = document.createElement('h2');
            heading.textContent = `${f.filename} (${f.type.toUpperCase()})`;
            card.appendChild(heading);

            if (f.type === 'pdf') {
                const p = document.createElement('p');
                p.textContent = `PDF Size: ${f.size_bytes} bytes | Extracted Images: ${f.image_count || 0}`;
                card.appendChild(p);

                if (f.images && f.images.length > 0) {
                    const imgContainer = document.createElement('div');
                    imgContainer.className = 'pdf-images';
                    imgContainer.style.display = 'flex';
                    imgContainer.style.flexWrap = 'wrap';
                    imgContainer.style.gap = '10px';
                    imgContainer.style.marginTop = '10px';

                    for (const img of f.images) {
                        const el = document.createElement('img');
                        el.src = `data:image/${img.ext};base64,${img.data_b64}`;
                        el.alt = img.filename;
                        el.className = 'pdf-image';
                        el.style.maxWidth = '200px';
                        el.style.borderRadius = '6px';
                        el.style.border = '1px solid #ccc';
                        el.title = `Page ${img.page_number}: ${img.filename} (${img.size_bytes} bytes)`;
                        imgContainer.appendChild(el);
                    }
                    card.appendChild(imgContainer);
                }
            }

            if (f.type === 'pptx') {
                const meta = document.createElement('p');
                meta.textContent = `Slides: ${f.slide_count} | Extracted Images: ${f.images.length}`;
                card.appendChild(meta);

                const imgsBySlide = {};
                for (const img of f.images) {
                    (imgsBySlide[img.slide_number] ||= []).push(img);
                }

                for (const s of f.slides_text) {
                    const slide = document.createElement('div');
                    slide.className = 'slide';
                    slide.style.marginTop = '10px';
                    slide.style.padding = '10px';
                    slide.style.background = '#fafafa';
                    slide.style.borderRadius = '6px';

                    const h3 = document.createElement('h4');
                    h3.textContent = `Slide ${s.slide_number}`;
                    slide.appendChild(h3);

                    if (s.text) {
                        const pre = document.createElement('pre');
                        pre.className = 'slide-text';
                        pre.style.whiteSpace = 'pre-wrap';
                        pre.textContent = s.text;
                        slide.appendChild(pre);
                    } else {
                        const em = document.createElement('em');
                        em.textContent = '(no text)';
                        slide.appendChild(em);
                    }

                    const slideImgs = imgsBySlide[s.slide_number] || [];
                    if (slideImgs.length > 0) {
                        const imgBox = document.createElement('div');
                        imgBox.style.display = 'flex';
                        imgBox.style.flexWrap = 'wrap';
                        imgBox.style.gap = '8px';
                        imgBox.style.marginTop = '8px';

                        for (const img of slideImgs) {
                            const el = document.createElement('img');
                            el.src = `data:image/${img.ext};base64,${img.data_b64}`;
                            el.alt = img.filename;
                            el.style.maxWidth = '180px';
                            el.style.borderRadius = '4px';
                            el.style.border = '1px solid #ccc';
                            imgBox.appendChild(el);
                        }
                        slide.appendChild(imgBox);
                    }

                    card.appendChild(slide);
                }
            }

            if (f.type === 'audio') {
                const p = document.createElement('p');
                p.textContent = `Audio (${f.content_type}) — ${f.size_bytes} bytes`;
                card.appendChild(p);
            }

            if (f.type === 'video') {
                const p = document.createElement('p');
                p.textContent = `Video (${f.content_type}) — ${f.size_bytes} bytes`;
                card.appendChild(p);
            }

            output.appendChild(card);
        }
    }
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
