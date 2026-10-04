document.addEventListener('DOMContentLoaded', () => {
  const chatHistoryList = document.getElementById('chatHistoryList');
  const promptForm = document.getElementById('promptForm');
  const promptInput = document.getElementById('promptInput');
  const fileInput = document.getElementById('fileInput');
  const attachedFilesList = document.getElementById('attachedFilesList');
  const contentIframe = document.getElementById('contentIframe');
  const userMessageText = document.getElementById('userMessageText');
  const aiStatusText = document.getElementById('aiStatusText');
  const submitBtn = document.getElementById('submitBtn');

  // Track attached files
  let attachedFiles = [];

  // Default sample news page mockup matching the blueprint and photo
  const defaultNewsHtml = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
        body { background: #120909; color: #f0f0f0; padding: 24px; min-height: 100vh; }
        .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #ff5722; padding-bottom: 12px; margin-bottom: 20px; }
        .title-bar { display: flex; align-items: center; gap: 8px; }
        .accent-bar { width: 4px; height: 20px; background: #ff5722; border-radius: 2px; }
        .title { font-size: 1.25rem; font-weight: 700; color: #fff; }
        .org-name { font-size: 0.9rem; color: #a08c8c; display: flex; align-items: center; gap: 8px; }
        .avatar-circle { width: 26px; height: 26px; border-radius: 50%; border: 1.5px solid #a08c8c; display: inline-flex; align-items: center; justify-content: center; font-size: 0.75rem; }
        .headline { font-size: 1.35rem; font-weight: 700; margin-bottom: 18px; line-height: 1.3; color: #ffffff; }
        .media-box { width: 100%; height: 220px; border-radius: 12px; border: 1px solid rgba(255, 90, 95, 0.2); background: rgba(255, 90, 95, 0.04); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; margin-bottom: 20px; }
        .media-icon { font-size: 2rem; color: #ff5722; opacity: 0.8; }
        .media-placeholder-text { font-size: 0.82rem; letter-spacing: 0.08em; text-transform: uppercase; color: #a08c8c; font-weight: 600; }
        .article-body { font-size: 0.95rem; line-height: 1.6; color: #d0c0c0; }
        .article-body p { margin-bottom: 12px; }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="title-bar">
          <div class="accent-bar"></div>
          <div class="title">Daily News</div>
        </div>
        <div class="org-name">
          Organization Name
          <span class="avatar-circle">👤</span>
        </div>
      </div>
      <h1 class="headline">Breakthrough in Autonomous Systems & Neural Knowledge Networks</h1>
      <div class="media-box">
        <div class="media-icon">🖼️</div>
        <div class="media-placeholder-text">Article Image Placeholder (1200 x 600)</div>
      </div>
      <div class="article-body">
        <p>Synthesized multi-source reporting: distributed computational clusters deploy real-time intelligence feeds across global communication nodes.</p>
        <p>Editorial styling dynamically harmonized with your organization's custom color palette, responsive glassmorphism hierarchy, and typography.</p>
      </div>
    </body>
    </html>
  `;

  // Fetch initial code if backend has /api/give-code setup, else fallback to default mockup
  fetch('/api/give-code')
    .then((res) => (res.ok ? res.json() : null))
    .then((data) => {
      const code = data?.code || data?.html;
      if (code && code.trim()) {
        contentIframe.srcdoc = code;
      } else {
        contentIframe.srcdoc = defaultNewsHtml;
      }
    })
    .catch(() => {
      contentIframe.srcdoc = defaultNewsHtml;
    });

  // Handle Chat History Selection with indicator arrow (◄)
  if (chatHistoryList) {
    chatHistoryList.addEventListener('click', (e) => {
      const btn = e.target.closest('.chat-item');
      if (!btn) return;

      // Update active state
      chatHistoryList.querySelectorAll('.chat-item').forEach((item) => {
        item.classList.remove('active');
      });
      btn.classList.add('active');

      const chatTitle = btn.querySelector('.item-title')?.textContent.trim() || 'Chat';
      if (userMessageText) {
        userMessageText.textContent = `${chatTitle}`;
      }
      if (aiStatusText) {
        aiStatusText.textContent = `Displaying generated result for: ${chatTitle}`;
      }
    });
  }

  // Handle File Input Selection (supports any file type)
  if (fileInput) {
    fileInput.addEventListener('change', () => {
      const files = Array.from(fileInput.files || []);
      files.forEach((file) => {
        if (!attachedFiles.some((f) => f.name === file.name && f.size === file.size)) {
          attachedFiles.push(file);
        }
      });
      renderAttachedFiles();
    });
  }

  function renderAttachedFiles() {
    if (!attachedFilesList) return;
    attachedFilesList.innerHTML = '';
    attachedFiles.forEach((file, index) => {
      const chip = document.createElement('div');
      chip.className = 'file-chip';
      chip.innerHTML = `
        <span>📄 ${file.name}</span>
        <span class="remove-file" data-index="${index}" title="Remove file">&times;</span>
      `;
      attachedFilesList.appendChild(chip);
    });

    attachedFilesList.querySelectorAll('.remove-file').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const idx = parseInt(e.target.dataset.index, 10);
        attachedFiles.splice(idx, 1);
        renderAttachedFiles();
      });
    });
  }

  // Auto-grow textarea
  if (promptInput) {
    promptInput.addEventListener('input', () => {
      promptInput.style.height = 'auto';
      promptInput.style.height = `${Math.min(promptInput.scrollHeight, 140)}px`;
    });

    promptInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        promptForm.requestSubmit();
      }
    });
  }

  // Submit Prompt to Backend (/api/give-files or /api/give)
  if (promptForm) {
    promptForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const text = promptInput.value.trim();

      if (!text && attachedFiles.length === 0) {
        return;
      }

      if (userMessageText) {
        userMessageText.textContent = text || `Uploaded ${attachedFiles.length} file(s)`;
      }

      if (aiStatusText) {
        aiStatusText.textContent = 'Processing request with SS Engine...';
      }

      submitBtn.disabled = true;

      try {
        let res;
        if (attachedFiles.length > 0) {
          const formData = new FormData();
          formData.append('text', text);
          attachedFiles.forEach((file) => {
            formData.append('files', file);
          });
          res = await fetch('/api/give-files', {
            method: 'POST',
            body: formData,
          });
        } else {
          res = await fetch('/api/give', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text }),
          });
        }

        const data = await res.json().catch(() => ({}));
        const aiResult = data.ai_result || data.ai_response || data.code;

        if (aiResult) {
          if (typeof aiResult === 'string' && (aiResult.includes('<html') || aiResult.includes('<!DOCTYPE') || aiResult.includes('</'))) {
            contentIframe.srcdoc = aiResult;
          } else {
            contentIframe.srcdoc = `
              <html><body style="background:#120909;color:#fff;font-family:sans-serif;padding:20px;">
                <pre style="white-space:pre-wrap;">${typeof aiResult === 'object' ? JSON.stringify(aiResult, null, 2) : aiResult}</pre>
              </body></html>
            `;
          }
        }

        if (aiStatusText) {
          aiStatusText.textContent = data.message || 'Output generated successfully.';
        }

        // Add to chat history as new entry
        if (text && chatHistoryList) {
          const newLi = document.createElement('li');
          newLi.innerHTML = `
            <button type="button" class="chat-item active" data-id="chat-${Date.now()}">
              <span class="item-title">${text.length > 20 ? text.slice(0, 18) + '...' : text}</span>
              <span class="active-arrow" aria-hidden="true">&#9668;</span>
            </button>
          `;
          chatHistoryList.querySelectorAll('.chat-item').forEach((i) => i.classList.remove('active'));
          chatHistoryList.appendChild(newLi);
        }

        // Reset inputs
        promptInput.value = '';
        promptInput.style.height = 'auto';
        attachedFiles = [];
        renderAttachedFiles();
        if (fileInput) fileInput.value = '';
      } catch (err) {
        if (aiStatusText) {
          aiStatusText.textContent = `Error: ${err.message || 'Failed to process request'}`;
        }
      } finally {
        submitBtn.disabled = false;
      }
    });
  }
});
