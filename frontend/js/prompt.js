document.addEventListener('DOMContentLoaded', () => {
  const chatHistoryList = document.getElementById('chatHistoryList');
  const promptForm = document.getElementById('promptForm');
  const promptInput = document.getElementById('promptInput');
  const fileInput = document.getElementById('fileInput');
  const attachedFilesList = document.getElementById('attachedFilesList');
  const submitBtn = document.getElementById('submitBtn');
  const brandIconImg = document.getElementById('brandIconImg');
  const brandText = document.getElementById('brandText');
  const chatContainer = document.getElementById('chatContainer');

  // Interactive AI Selection Area for website customization
  const aiSelectionArea = document.getElementById('aiSelectionArea');
  const paletteDisplay = document.getElementById('paletteDisplay');
  const fontDisplay = document.getElementById('fontDisplay');
  const confirmSelectionBtn = document.getElementById('confirmSelectionBtn');

  // State management
  let isGenerating = false;
  let activeAbortController = null;
  let activeChatId = null;
  let attachedFiles = [];
  const chatSessions = [];

  // Retrieve saved authentication and organization info
  const authPayload = localStorage.getItem('sathyasethu-auth') || sessionStorage.getItem('sathyasethu-auth');
  let parsedAuth = null;
  if (authPayload) {
    try {
      parsedAuth = JSON.parse(authPayload);
    } catch (e) {
      console.warn('Could not parse auth payload:', e);
    }
  }

  const orgIconUrl = localStorage.getItem('organizationIcon') ||
                     sessionStorage.getItem('organizationIcon') ||
                     localStorage.getItem('organization-icon') ||
                     sessionStorage.getItem('organization-icon') ||
                     parsedAuth?.organizationIcon ||
                     parsedAuth?.organization?.icon ||
                     parsedAuth?.icon ||
                     '';

  const orgName = localStorage.getItem('organizationName') ||
                  sessionStorage.getItem('organizationName') ||
                  localStorage.getItem('organization-name') ||
                  sessionStorage.getItem('organization-name') ||
                  parsedAuth?.organizationName ||
                  parsedAuth?.organization?.name ||
                  (typeof parsedAuth?.organization === 'string' ? parsedAuth.organization : null) ||
                  '';

  // Display organization logo if icon url is available
  if (brandIconImg) {
    if (orgIconUrl) {
      brandIconImg.src = orgIconUrl;
      brandIconImg.alt = orgName ? `${orgName} Logo` : 'Organization Logo';
      brandIconImg.style.display = 'block';
      brandIconImg.onerror = () => {
        brandIconImg.style.display = 'none';
      };
    } else {
      brandIconImg.style.display = 'none';
    }
  }

  function toTitleCase(str) {
    if (!str) return '';
    return str
      .toLowerCase()
      .split(' ')
      .map((word) => (word ? word.charAt(0).toUpperCase() + word.slice(1) : ''))
      .join(' ');
  }

  if (brandText && orgName && orgName.toLowerCase() !== 'unincorporated') {
    brandText.textContent = toTitleCase(orgName);
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Check if backend has initial code from /api/give-code
  fetch('/api/give-code')
    .then((res) => (res.ok ? res.json() : null))
    .then((data) => {
      const code = data?.code || data?.html;
      if (code && code.trim()) {
        const initialId = `chat-init-${Date.now()}`;
        createLoadingMessageGroup('Initial Workspace Draft', initialId);
        displayAiResponse(code, 'Initial Workspace Draft', initialId);
      }
    })
    .catch(() => {});

  // Unified Send / Stop Button State Management
  function setGeneratingState(generating, chatId = null) {
    isGenerating = generating;
    activeChatId = generating ? chatId : null;

    if (!submitBtn) return;

    if (generating) {
      submitBtn.classList.add('is-stopping');
      submitBtn.title = 'Stop AI Generation';
      submitBtn.setAttribute('aria-label', 'Stop AI Generation');
      submitBtn.innerHTML = '<span class="stop-icon" style="font-size:18px;color:#fff;line-height:1;font-weight:bold;">&#9632;</span>';
    } else {
      submitBtn.classList.remove('is-stopping');
      submitBtn.title = 'Send Prompt';
      submitBtn.setAttribute('aria-label', 'Send Prompt');
      submitBtn.innerHTML = '<img src="/assets/send.svg" alt="Send" class="action-icon-img" id="submitBtnIcon" />';
    }
  }

  function stopGeneration() {
    if (activeAbortController) {
      try {
        activeAbortController.abort();
      } catch (e) {}
      activeAbortController = null;
    }

    if (activeChatId) {
      const stoppedHtml = `<!DOCTYPE html><html><head>
        <meta charset="utf-8">
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,100..1000;1,9..40,100..1000&family=Momo+Trust+Display&display=swap" rel="stylesheet">
      </head><body style="background:#110e08;color:#dfd4c0;font-family:'DM Sans',sans-serif;padding:32px;display:flex;align-items:center;gap:12px;margin:0;box-sizing:border-box;">
        <span style="font-size:22px;">⏹️</span>
        <span style="font-size:15px;color:#fbf7ee;font-weight:500;">Generation stopped by user.</span>
      </body></html>`;

      const groupWrapper = document.getElementById(`chat-group-${activeChatId}`);
      if (groupWrapper) {
        const iframe = groupWrapper.querySelector('.preview-iframe');
        if (iframe) iframe.srcdoc = stoppedHtml;
      }
    }

    setGeneratingState(false);
  }

  // Intercept button click: if generating, stop generation immediately
  if (submitBtn) {
    submitBtn.addEventListener('click', (e) => {
      if (isGenerating) {
        e.preventDefault();
        e.stopPropagation();
        stopGeneration();
      }
    });
  }

  // Helper to render Markdown or Presentation outline as beautiful styled HTML
  function markdownToHtml(rawMarkdown) {
    const lines = rawMarkdown.split('\n');
    let inSlide = false;
    let htmlLines = [];

    htmlLines.push(`<!DOCTYPE html><html><head><meta charset="utf-8">
      <link rel="preconnect" href="https://fonts.googleapis.com">
      <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,100..1000;1,9..40,100..1000&family=Momo+Trust+Display&display=swap" rel="stylesheet">
      <style>
        body {
          background: #110e08;
          color: #fbf7ee;
          font-family: 'DM Sans', sans-serif;
          padding: 32px 28px;
          margin: 0;
          box-sizing: border-box;
          line-height: 1.6;
        }
        h1, h2, h3, h4 {
          font-family: 'Momo Trust Display', serif;
          color: #e2a221;
          margin-top: 24px;
          margin-bottom: 12px;
          letter-spacing: -0.01em;
        }
        h1 { font-size: 2rem; border-bottom: 1px solid rgba(226, 162, 33, 0.25); padding-bottom: 8px; }
        h2 { font-size: 1.5rem; }
        h3 { font-size: 1.25rem; }
        p { margin: 8px 0 14px; font-size: 0.98rem; color: #dfd4c0; }
        ul, ol { margin: 8px 0 16px 20px; padding: 0; }
        li { margin-bottom: 6px; color: #dfd4c0; font-size: 0.95rem; }
        strong { color: #fbf7ee; font-weight: 600; }
        code { background: rgba(226, 162, 33, 0.12); color: #e2a221; padding: 2px 6px; border-radius: 4px; font-size: 0.9em; }
        pre { background: #0a0907; border: 1px solid rgba(226, 162, 33, 0.2); padding: 14px; border-radius: 8px; overflow-x: auto; color: #fbf7ee; }
        .slide-card {
          background: rgba(25, 21, 13, 0.9);
          border: 1px solid rgba(226, 162, 33, 0.25);
          border-radius: 12px;
          padding: 20px 24px;
          margin-bottom: 20px;
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
        }
        .slide-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
          border-bottom: 1px solid rgba(226, 162, 33, 0.2);
          padding-bottom: 8px;
        }
        .slide-title {
          font-family: 'Momo Trust Display', serif;
          font-size: 1.25rem;
          color: #e2a221;
          margin: 0;
        }
      </style>
    </head><body>`);

    let currentCardContent = [];

    for (let line of lines) {
      const trimmed = line.trim();

      // Check for slide card markers like '--- Slide' or '## Slide' or '---'
      if (trimmed.startsWith('--- Slide') || (trimmed.startsWith('## Slide') && inSlide) || (trimmed === '---' && inSlide)) {
        if (inSlide) {
          htmlLines.push(`<div class="slide-card">${currentCardContent.join('\n')}</div>`);
          currentCardContent = [];
        }
        inSlide = true;
        const slideTitle = trimmed.replace(/^--- Slide \d+:?|^## Slide \d+:?|^---/i, '').trim() || 'Slide Content';
        currentCardContent.push(`<div class="slide-header"><h3 class="slide-title">${escapeHtml(slideTitle)}</h3></div>`);
        continue;
      }

      let formatted = line;
      if (formatted.startsWith('# ')) {
        formatted = `<h1>${escapeHtml(formatted.slice(2))}</h1>`;
      } else if (formatted.startsWith('## ')) {
        formatted = `<h2>${escapeHtml(formatted.slice(3))}</h2>`;
      } else if (formatted.startsWith('### ')) {
        formatted = `<h3>${escapeHtml(formatted.slice(4))}</h3>`;
      } else if (formatted.startsWith('- ') || formatted.startsWith('* ')) {
        formatted = `<li>${escapeHtml(formatted.slice(2))}</li>`;
      } else if (formatted.trim().length > 0) {
        formatted = `<p>${escapeHtml(formatted)}</p>`;
      }

      if (inSlide) {
        currentCardContent.push(formatted);
      } else {
        htmlLines.push(formatted);
      }
    }

    if (inSlide && currentCardContent.length > 0) {
      htmlLines.push(`<div class="slide-card">${currentCardContent.join('\n')}</div>`);
    }

    htmlLines.push(`</body></html>`);
    return htmlLines.join('\n');
  }

  // Create loading message group immediately on query submission
  function createLoadingMessageGroup(promptText, chatId) {
    if (!chatContainer) return null;

    const wrapperId = `chat-group-${chatId}`;
    let groupWrapper = document.getElementById(wrapperId);
    if (groupWrapper) return groupWrapper;

    groupWrapper = document.createElement('div');
    groupWrapper.id = wrapperId;
    groupWrapper.className = 'chat-message-group';
    groupWrapper.style.display = 'flex';
    groupWrapper.style.flexDirection = 'column';
    groupWrapper.style.gap = '16px';
    groupWrapper.style.marginBottom = '24px';

    const userRow = document.createElement('div');
    userRow.className = 'user-message-row';
    userRow.style.display = 'flex';
    userRow.innerHTML = `<div class="user-bubble">${escapeHtml(promptText)}</div>`;
    groupWrapper.appendChild(userRow);

    const iframeWrapper = document.createElement('div');
    iframeWrapper.className = 'iframe-wrapper glow-fade-in';
    iframeWrapper.style.display = 'block';

    const loadingHtml = `<!DOCTYPE html><html><head>
      <meta charset="utf-8">
      <link rel="preconnect" href="https://fonts.googleapis.com">
      <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,100..1000;1,9..40,100..1000&family=Momo+Trust+Display&display=swap" rel="stylesheet">
    </head><body style="background:#110e08;color:#e2a221;font-family:'DM Sans',sans-serif;padding:32px;display:flex;align-items:center;gap:14px;box-sizing:border-box;margin:0;">
      <style>
        .spinner { width:22px; height:22px; border:3px solid rgba(226,162,33,0.3); border-top-color:#e2a221; border-radius:50%; animation:spin 0.8s linear infinite; flex-shrink:0; }
        @keyframes spin { to { transform:rotate(360deg); } }
      </style>
      <div class="spinner"></div>
      <span style="font-size:15px;letter-spacing:0.02em;color:#fbf7ee;">Generating output with AI... Please wait...</span>
    </body></html>`;

    iframeWrapper.innerHTML = `
      <iframe class="preview-iframe" title="Rendered Output Preview" srcdoc="${escapeHtml(loadingHtml)}"></iframe>
      <button type="button" class="dashboard-btn download-result-btn" style="position: absolute; bottom: 12px; right: 12px; z-index: 10; display: none;">
        Download Zip
      </button>
    `;
    groupWrapper.appendChild(iframeWrapper);

    chatContainer.appendChild(groupWrapper);

    // Auto-scroll to bottom immediately
    setTimeout(() => {
      chatContainer.scrollTop = chatContainer.scrollHeight;
    }, 20);

    return groupWrapper;
  }

  // Update existing message group with final AI response
  function displayAiResponse(rawContent, promptText, chatId, isError = false) {
    if (!chatContainer) return;

    let groupWrapper = document.getElementById(`chat-group-${chatId}`);
    if (!groupWrapper) {
      groupWrapper = createLoadingMessageGroup(promptText || 'Workspace Query', chatId);
    }
    if (!groupWrapper) return;

    let htmlToDisplay = '';
    let rawTextContent = typeof rawContent === 'string' ? rawContent : JSON.stringify(rawContent, null, 2);

    if (isError) {
      htmlToDisplay = `<!DOCTYPE html><html><head>
        <meta charset="utf-8">
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,100..1000;1,9..40,100..1000&family=Momo+Trust+Display&display=swap" rel="stylesheet">
      </head><body style="background:#110e08;color:#ff6b6b;font-family:'DM Sans',sans-serif;padding:28px;margin:0;box-sizing:border-box;">
        <h3 style="font-family:'Momo Trust Display',serif;color:#ff6b6b;margin-top:0;font-size:1.3rem;">⚠️ Generation Error</h3>
        <p style="font-size:15px;line-height:1.6;color:#dfd4c0;">${escapeHtml(rawTextContent)}</p>
      </body></html>`;
    } else if (typeof rawContent === 'string' && (rawContent.includes('```mermaid') || rawContent.trim().startsWith('graph ') || rawContent.trim().startsWith('flowchart '))) {
      const cleanCode = rawContent.replace(/```mermaid/g, '').replace(/```/g, '').trim();
      htmlToDisplay = `<!DOCTYPE html><html><head><meta charset="utf-8">
        <script src="/js/mermaid.min.js"></script>
        <script>
          document.addEventListener("DOMContentLoaded", function() {
            try { mermaid.initialize({ startOnLoad: true, theme: "dark" }); } catch(e){}
          });
        </script>
        <style>
          body { margin: 0; background: #110e08; color: #fbf7ee; display: flex; justify-content: center; align-items: center; min-height: 100vh; font-family: sans-serif; padding: 20px; box-sizing: border-box; }
          .mermaid { width: 100%; text-align: center; }
        </style>
      </head><body>
        <div class="mermaid">
          ${cleanCode}
        </div>
      </body></html>`;
    } else if (typeof rawContent === 'string' && (rawContent.includes('<html') || rawContent.includes('<!DOCTYPE') || (rawContent.includes('<div') && rawContent.includes('</div>')))) {
      htmlToDisplay = rawContent;
    } else if (typeof rawContent === 'string') {
      htmlToDisplay = markdownToHtml(rawContent);
    } else {
      htmlToDisplay = `<!DOCTYPE html><html><body style="background:#110e08;color:#fbf7ee;font-family:sans-serif;padding:24px;margin:0;">
        <pre style="white-space:pre-wrap;font-size:14px;line-height:1.6;">${escapeHtml(rawTextContent)}</pre>
      </body></html>`;
    }

    const iframe = groupWrapper.querySelector('.preview-iframe');
    if (iframe) {
      iframe.srcdoc = htmlToDisplay;
    }

    const downloadBtn = groupWrapper.querySelector('.download-result-btn');
    if (downloadBtn && !isError) {
      downloadBtn.style.display = 'inline-flex';
      downloadBtn.onclick = async () => {
        if (!window.JSZip) {
          alert('JSZip library not available.');
          return;
        }
        const zip = new JSZip();
        zip.file('index.html', htmlToDisplay);
        if (typeof rawContent === 'string' && !rawContent.includes('<html')) {
          zip.file('content.md', rawContent);
        }

        const blob = await zip.generateAsync({ type: 'blob' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `SathyaSethu_Generated_${Date.now()}.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      };
    } else if (downloadBtn) {
      downloadBtn.style.display = 'none';
    }

    setTimeout(() => {
      chatContainer.scrollTop = chatContainer.scrollHeight;
    }, 40);
  }

  // Handle Chat History Selection with indicator arrow (◄)
  if (chatHistoryList) {
    chatHistoryList.addEventListener('click', (e) => {
      const btn = e.target.closest('.chat-item');
      if (!btn) return;

      const chatId = btn.dataset.id;
      const targetSession = chatSessions.find((s) => s.id === chatId);

      chatHistoryList.querySelectorAll('.chat-item').forEach((item) => {
        item.classList.remove('active');
      });
      btn.classList.add('active');

      if (targetSession) {
        const groupWrapper = document.getElementById(`chat-group-${chatId}`);
        if (groupWrapper) {
          groupWrapper.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
    });
  }

  // Drag and Drop File Handling
  let dropOverlay = document.getElementById('dropOverlay');
  if (!dropOverlay) {
    dropOverlay = document.createElement('div');
    dropOverlay.id = 'dropOverlay';
    dropOverlay.className = 'drop-overlay';
    dropOverlay.innerHTML = `
      <div class="drop-overlay-content">
        <span style="font-size: 48px;">📁</span>
        <p>Drop files here to attach</p>
      </div>
    `;
    document.body.appendChild(dropOverlay);
  }

  let dragCounter = 0;
  window.addEventListener('dragenter', (e) => {
    e.preventDefault();
    dragCounter++;
    dropOverlay.classList.add('active');
  });

  window.addEventListener('dragover', (e) => {
    e.preventDefault();
  });

  window.addEventListener('dragleave', (e) => {
    e.preventDefault();
    dragCounter--;
    if (dragCounter <= 0) {
      dragCounter = 0;
      dropOverlay.classList.remove('active');
    }
  });

  window.addEventListener('drop', (e) => {
    e.preventDefault();
    dragCounter = 0;
    dropOverlay.classList.remove('active');
    const files = Array.from(e.dataTransfer?.files || []);
    if (files.length > 0) {
      files.forEach((file) => {
        if (!attachedFiles.some((f) => f.name === file.name && f.size === file.size)) {
          attachedFiles.push(file);
        }
      });
      renderAttachedFiles();
    }
  });

  // Handle File Input Selection
  if (fileInput) {
    fileInput.addEventListener('change', () => {
      const files = Array.from(fileInput.files || []);
      files.forEach((file) => {
        if (!attachedFiles.some((f) => f.name === file.name && f.size === file.size)) {
          attachedFiles.push(file);
        }
      });
      renderAttachedFiles();
      fileInput.value = '';
    });
  }

  function renderAttachedFiles() {
    if (!attachedFilesList) return;
    attachedFilesList.innerHTML = '';
    attachedFiles.forEach((file, index) => {
      const chip = document.createElement('div');
      chip.className = 'file-chip';
      chip.innerHTML = `
        <span>📄 ${escapeHtml(file.name)}</span>
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

  // Auto-grow textarea & Enter-to-submit
  if (promptInput) {
    promptInput.addEventListener('input', () => {
      promptInput.style.height = 'auto';
      promptInput.style.height = `${Math.min(promptInput.scrollHeight, 160)}px`;
    });

    promptInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (isGenerating) return;
        promptForm.requestSubmit();
      }
    });
  }

  // Helper to read configuration parameters from right sidebar
  function readConfig() {
    const outFormatsSelect = document.getElementById('outFormats');
    const formats = outFormatsSelect
      ? Array.from(outFormatsSelect.selectedOptions).map((opt) => opt.value)
      : ['presentation'];

    return {
      formats: formats.length > 0 ? formats : ['presentation'],
      audience: document.getElementById('outAudience')?.value.trim() || '',
      tone: document.getElementById('outTone')?.value || 'professional',
      language: document.getElementById('outLanguage')?.value.trim() || 'English',
      level: document.getElementById('outLevel')?.value || 'standard',
      objective: document.getElementById('outObjective')?.value.trim() || '',
      style: document.getElementById('outStyle')?.value.trim() || '',
      orgName: orgName || '',
      orgIconUrl: orgIconUrl || '',
    };
  }

  // Form Submission
  if (promptForm) {
    promptForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      // Guard: do not double submit if generation is actively running
      if (isGenerating) {
        return;
      }

      const text = promptInput.value.trim();
      if (!text && attachedFiles.length === 0) {
        return;
      }

      const promptText = text || `Uploaded ${attachedFiles.length} file(s)`;
      const chatId = `chat-${Date.now()}`;

      // Create loading message group immediately with single persistent chatId
      createLoadingMessageGroup(promptText, chatId);

      // Store files and clear inputs immediately
      const filesToSend = [...attachedFiles];
      promptInput.value = '';
      promptInput.style.height = 'auto';
      attachedFiles = [];
      renderAttachedFiles();
      if (fileInput) fileInput.value = '';

      // Set state to generating (changes button to Stop square)
      activeAbortController = new AbortController();
      setGeneratingState(true, chatId);

      try {
        const configData = readConfig();

        let res;
        if (filesToSend.length > 0) {
          const formData = new FormData();
          formData.append('text', text);
          formData.append('config', JSON.stringify(configData));
          filesToSend.forEach((file) => {
            formData.append('files', file);
          });
          res = await fetch('/api/give-files', {
            method: 'POST',
            body: formData,
            signal: activeAbortController.signal,
          });
        } else {
          res = await fetch('/api/give', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text, config: configData }),
            signal: activeAbortController.signal,
          });
        }

        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          const errorMsg = data.detail || data.message || `Server responded with status ${res.status}`;
          throw new Error(errorMsg);
        }

        const aiResult = data.ai_result || data.ai_response || data.code;

        // Check if website interactive selection step is returned
        if (aiResult && typeof aiResult === 'object' && aiResult.palettes && aiResult.fonts) {
          setGeneratingState(false);
          window.createButtonFunction(aiResult, async (selectedChoices) => {
            const nextConfig = { ...configData, ...selectedChoices };
            const followUpChatId = `chat-${Date.now()}`;
            createLoadingMessageGroup(`${promptText} (Website Design)`, followUpChatId);

            activeAbortController = new AbortController();
            setGeneratingState(true, followUpChatId);

            try {
              let followUpRes;
              if (filesToSend.length > 0) {
                const followUpForm = new FormData();
                followUpForm.append('text', text);
                followUpForm.append('config', JSON.stringify(nextConfig));
                filesToSend.forEach((f) => followUpForm.append('files', f));
                followUpRes = await fetch('/api/give-files', {
                  method: 'POST',
                  body: followUpForm,
                  signal: activeAbortController.signal,
                });
              } else {
                followUpRes = await fetch('/api/give', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ text, config: nextConfig }),
                  signal: activeAbortController.signal,
                });
              }

              const followUpData = await followUpRes.json().catch(() => ({}));
              if (!followUpRes.ok) {
                throw new Error(followUpData.detail || 'Failed to generate website code');
              }

              const finalResult = followUpData.ai_result || followUpData.ai_response || '<p>Website generated successfully.</p>';
              displayAiResponse(finalResult, `${promptText} (Website)`, followUpChatId);

              chatSessions.push({
                id: followUpChatId,
                prompt: `${promptText} (Website)`,
                htmlContent: finalResult,
              });

              if (chatHistoryList) {
                chatHistoryList.querySelectorAll('.chat-item').forEach((i) => i.classList.remove('active'));
                const newLi = document.createElement('li');
                newLi.innerHTML = `
                  <button type="button" class="chat-item active" data-id="${followUpChatId}">
                    <span class="item-title">${escapeHtml(promptText.slice(0, 22))}...</span>
                    <span class="active-arrow" aria-hidden="true">&#9668;</span>
                  </button>
                `;
                chatHistoryList.prepend(newLi);
              }
            } catch (followUpErr) {
              if (followUpErr.name !== 'AbortError') {
                displayAiResponse(followUpErr.message, promptText, followUpChatId, true);
              }
            } finally {
              setGeneratingState(false);
              activeAbortController = null;
            }
          });
          return;
        }

        // Normal successful generation
        const contentToDisplay = aiResult || data.final_output || data.message || 'No response content';
        displayAiResponse(contentToDisplay, promptText, chatId);

        // Add entry to chat history with active indicator arrow (◄)
        const chatTitle = text.length > 22 ? text.slice(0, 20) + '...' : promptText;
        chatSessions.push({
          id: chatId,
          prompt: promptText,
          content: contentToDisplay,
        });

        if (chatHistoryList) {
          chatHistoryList.querySelectorAll('.chat-item').forEach((i) => i.classList.remove('active'));
          const newLi = document.createElement('li');
          newLi.innerHTML = `
            <button type="button" class="chat-item active" data-id="${chatId}">
              <span class="item-title">${escapeHtml(chatTitle)}</span>
              <span class="active-arrow" aria-hidden="true">&#9668;</span>
            </button>
          `;
          chatHistoryList.prepend(newLi);
        }
      } catch (err) {
        if (err.name === 'AbortError') {
          return;
        }
        displayAiResponse(err.message || 'Failed to process request', promptText, chatId, true);
      } finally {
        setGeneratingState(false);
        activeAbortController = null;
      }
    });
  }

  // Dynamic Choice Function for Website Generation
  window.createButtonFunction = function (options, callback) {
    if (!aiSelectionArea || !paletteDisplay || !fontDisplay || !confirmSelectionBtn) return;

    paletteDisplay.innerHTML = '<h3 style="width: 100%; margin-bottom: 8px; font-family:\'Momo Trust Display\',serif; color:#e2a221;">Select a Color Palette</h3>';
    fontDisplay.innerHTML = '<h3 style="width: 100%; margin-bottom: 8px; font-family:\'Momo Trust Display\',serif; color:#e2a221;">Select Fonts (1 Body, 1 Title)</h3>';
    aiSelectionArea.style.display = 'block';

    let selectedPalette = null;
    let selectedBodyFont = null;
    let selectedTitleFont = null;

    if (options.palettes && Array.isArray(options.palettes)) {
      options.palettes.forEach((palette, idx) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'selection-pill palette-btn';
        btn.innerHTML = `
          Palette ${idx + 1} 
          <span class="color-swatch" style="background:${palette[0] || '#fff'}"></span>
          <span class="color-swatch" style="background:${palette[1] || '#ccc'}"></span>
        `;
        btn.onclick = () => {
          document.querySelectorAll('.palette-btn').forEach((b) => b.classList.remove('selected'));
          btn.classList.add('selected');
          selectedPalette = palette;
          checkSelections();
        };
        paletteDisplay.appendChild(btn);
      });
    }

    if (options.fonts && Array.isArray(options.fonts)) {
      options.fonts.forEach((fontObj) => {
        const isTitle = fontObj.type === 'title';
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `selection-pill font-btn ${isTitle ? 'title-font' : 'body-font'}`;
        btn.innerHTML = `${escapeHtml(fontObj.name)} (${isTitle ? 'Title' : 'Body'})`;
        btn.style.fontFamily = `'${fontObj.name}', sans-serif`;

        btn.onclick = () => {
          document.querySelectorAll(`.${isTitle ? 'title-font' : 'body-font'}`).forEach((b) => b.classList.remove('selected'));
          btn.classList.add('selected');
          if (isTitle) selectedTitleFont = fontObj.name;
          else selectedBodyFont = fontObj.name;
          checkSelections();
        };
        fontDisplay.appendChild(btn);
      });
    }

    function checkSelections() {
      if (selectedPalette && selectedBodyFont && selectedTitleFont) {
        confirmSelectionBtn.style.display = 'inline-flex';
      }
    }

    confirmSelectionBtn.onclick = () => {
      aiSelectionArea.style.display = 'none';
      if (callback) {
        callback({
          palette: selectedPalette,
          bodyFont: selectedBodyFont,
          titleFont: selectedTitleFont,
        });
      }
    };
  };
});
