document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('user-form');
    const input = document.getElementById('text-input');
    const fileInput = document.getElementById('file-input');
    const output = document.getElementById('output');

    // Color palettes and sample font boxes
    createColorpalette(["#235E5E", "#558968", "#a2af9f", "#EFECDE", "#381A1A"]);
    createColorpalette(["#2f00b1", "#195981", "#6fffa2", "#d5ffef", "#220035"]);
    createFontBox("https://fonts.googleapis.com/css2?family=Isometra&display=swap");
    createFontBox("https://fonts.googleapis.com/css2?family=UnifrakturMaguntia&display=swap");
    createFontBox("https://fonts.googleapis.com/css2?family=Ewert&display=swap");

    console.log('mermaid loaded:', typeof mermaid, 'version:', typeof mermaid !== 'undefined' ? mermaid?.version : 'not loaded');

    // ===== FILE UPLOAD & PROMPT FORM =====
    if (form) {
        form.addEventListener('submit', (e) => {
            e.preventDefault();

            const text = input ? input.value.trim() : '';
            const files = fileInput ? fileInput.files : [];

            if (!text && files.length === 0) {
                if (output) output.textContent = 'Please enter text or select at least one file.';
                return;
            }

            const formData = new FormData();
            formData.append('text', text);
            for (const file of files) {
                formData.append('files', file);
            }

            if (output) output.textContent = 'Processing...';

            fetch('/api/give-files', {
                method: 'POST',
                body: formData
            })
                .then(res => {
                    if (!res.ok) throw new Error('HTTP ' + res.status);
                    return res.json();
                })
                .then(data => {
                    if (data.files && data.files.length > 0) {
                        renderResults(data);
                    } else if (output) {
                        output.textContent = data.message || 'Processed successfully.';
                    }

                    const aiResult = data.ai_result || data.ai_response || data.code;
                    if (aiResult) {
                        if (
                            typeof aiResult === 'string' &&
                            (aiResult.includes('<html') || aiResult.includes('<!DOCTYPE') || aiResult.includes('</'))
                        ) {
                            createSubPage(aiResult);
                        } else if (output) {
                            const pre = document.createElement('pre');
                            pre.textContent = typeof aiResult === 'object' ? JSON.stringify(aiResult, null, 2) : aiResult;
                            output.appendChild(pre);
                        }
                    }
                })
                .catch(err => {
                    if (output) output.textContent = 'Error: ' + err.message;
                    console.error(err);
                });
        });
    }

    function renderResults(data) {
        if (!output) return;
        output.innerHTML = '';

        if (data.message) {
            const summary = document.createElement('p');
            summary.textContent = data.message;
            output.appendChild(summary);
        }

        if (data.files) {
            for (const f of data.files) {
                const card = document.createElement('div');
                card.className = 'file-card';

                const heading = document.createElement('h2');
                heading.textContent = `${f.filename} (${f.type})`;
                card.appendChild(heading);

                if (f.type === 'pdf') {
                    const p = document.createElement('p');
                    p.textContent = `PDF — ${f.size_bytes} bytes`;
                    card.appendChild(p);
                }

                if (f.type === 'pptx') {
                    const meta = document.createElement('p');
                    meta.textContent = `${f.slide_count} slide(s), ${f.images.length} image(s)`;
                    card.appendChild(meta);

                    const imgsBySlide = {};
                    for (const img of f.images) {
                        (imgsBySlide[img.slide_number] ||= []).push(img);
                    }

                    for (const s of f.slides_text) {
                        const slide = document.createElement('div');
                        slide.className = 'slide';

                        const h3 = document.createElement('h3');
                        h3.textContent = `Slide ${s.slide_number}`;
                        slide.appendChild(h3);

                        if (s.text) {
                            const pre = document.createElement('pre');
                            pre.className = 'slide-text';
                            pre.textContent = s.text;
                            slide.appendChild(pre);
                        } else {
                            const em = document.createElement('em');
                            em.textContent = '(no text)';
                            slide.appendChild(em);
                        }

                        for (const img of (imgsBySlide[s.slide_number] || [])) {
                            const el = document.createElement('img');
                            el.src = `data:image/${img.ext};base64,${img.data_b64}`;
                            el.alt = img.filename;
                            el.className = 'slide-image';
                            slide.appendChild(el);
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
    }

    // ===== MERMAID RENDERING =====
    const mermaidInput = document.getElementById('mermaid-input');
    const mermaidBtn = document.getElementById('render-mermaid');
    const mermaidOutput = document.getElementById('mermaid-output');

    if (mermaidBtn && mermaidOutput) {
        if (typeof mermaid === 'undefined') {
            mermaidOutput.innerHTML =
                '<p class="mermaid-error">Mermaid library failed to load. Check that mermaid.min.js exists in frontend/js/.</p>';
            mermaidBtn.addEventListener('click', () => {
                mermaidOutput.innerHTML =
                    '<p class="mermaid-error">Mermaid library is not loaded. Cannot render diagram.</p>';
            });
        } else {
            mermaid.initialize({ startOnLoad: false, theme: 'default' });

            let renderCounter = 0;

            function cleanMermaidCode(raw) {
                if (!raw) return '';
                let code = raw.trim();
                const fence = code.match(/```(?:mermaid)?\s*([\s\S]*?)```/i);
                if (fence) {
                    code = fence[1];
                }
                return code.trim();
            }

            async function renderMermaid(code) {
                mermaidOutput.innerHTML = '';
                const id = 'mermaid-svg-' + (++renderCounter);

                try {
                    const { svg } = await mermaid.render(id, code);
                    mermaidOutput.innerHTML = svg;
                } catch (err) {
                    const staleD = document.getElementById('d' + id);
                    if (staleD) staleD.remove();
                    const staleSvg = document.getElementById(id);
                    if (staleSvg) staleSvg.remove();

                    const p = document.createElement('p');
                    p.className = 'mermaid-error';
                    p.textContent = 'Mermaid error: ' + (err?.message ?? err);
                    mermaidOutput.appendChild(p);
                    console.error('Mermaid render failed:', err);
                }
            }

            mermaidBtn.addEventListener('click', () => {
                const code = cleanMermaidCode(mermaidInput ? mermaidInput.value : '');
                if (!code) {
                    mermaidOutput.innerHTML = '<em>Please enter some mermaid code.</em>';
                    return;
                }
                renderMermaid(code);
            });
        }
    }

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
    htmlBox.style.border = 'none';
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

function createFontBox(fontLink) {
    const fontContainer = document.createElement('div');
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = fontLink;

    fontContainer.className = "font-container";

    const url = new URL(fontLink);
    const fontName = url.searchParams.get("family").split(":")[0].replace(/\+/g, " ");

    document.head.appendChild(link);
    fontContainer.textContent = fontName;
    link.onload = () => {
        fontContainer.style.fontFamily = `"${fontName}"`;
    };

    const target = document.getElementById('fonts-container') || document.body;
    if (target) {
        target.appendChild(fontContainer);
    }
}
