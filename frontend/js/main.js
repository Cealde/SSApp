document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('user-form');
    const input = document.getElementById('text-input');
    const fileInput = document.getElementById('file-input');
    const output = document.getElementById('output');
    console.log('mermaid loaded:', typeof mermaid, 'version:', mermaid?.version);
    // ===== EXISTING FILE UPLOAD =====
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

        output.textContent = 'Processing...';

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

    function renderResults(data) {
        output.innerHTML = '';

        const summary = document.createElement('p');
        summary.textContent = data.message;
        output.appendChild(summary);

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
                meta.textContent =
                    `${f.slide_count} slide(s), ${f.images.length} image(s)`;
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

    // ===== NEW: MERMAID RENDERING =====
    const mermaidInput  = document.getElementById('mermaid-input');
    const mermaidBtn    = document.getElementById('render-mermaid');
    const mermaidOutput = document.getElementById('mermaid-output');

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
            // Extract from markdown code fences if present anywhere in the text
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
                // Clean up any stale elements injected into the DOM by Mermaid
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
            const code = cleanMermaidCode(mermaidInput.value);
            if (!code) {
                mermaidOutput.innerHTML = '<em>Please enter some mermaid code.</em>';
                return;
            }
            renderMermaid(code);
        });
    }
});