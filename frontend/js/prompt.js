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
  const formatToggleGrid = document.getElementById('formatToggleGrid');
  const presentationSettingsPanel = document.getElementById('presentationSettingsPanel');

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

  // --- Output Formats Interactive Toggle Setup ---
  if (formatToggleGrid) {
    const chips = formatToggleGrid.querySelectorAll('.format-chip');
    chips.forEach((chip) => {
      chip.addEventListener('click', () => {
        const wasActive = chip.classList.contains('active');
        const checkEl = chip.querySelector('.chip-check');

        if (wasActive) {
          chip.classList.remove('active');
          chip.setAttribute('aria-pressed', 'false');
          if (checkEl) checkEl.textContent = '';
        } else {
          chip.classList.add('active');
          chip.setAttribute('aria-pressed', 'true');
          if (checkEl) checkEl.textContent = '✓';
        }

        // Toggle Presentation Settings visibility
        if (chip.dataset.value === 'presentation' && presentationSettingsPanel) {
          presentationSettingsPanel.style.display = !wasActive ? 'flex' : 'none';
        }
      });
    });
  }

  // Helper to read configuration parameters from right sidebar
  function readConfig() {
    const activeChips = formatToggleGrid
      ? Array.from(formatToggleGrid.querySelectorAll('.format-chip.active'))
      : [];
    let formats = activeChips.map((c) => c.dataset.value);
    if (formats.length === 0) {
      formats = ['presentation'];
    }

    return {
      formats: formats,
      presTheme: document.getElementById('presTheme')?.value || 'amber',
      presSlideCount: document.getElementById('presSlideCount')?.value || 'auto',
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

  // Check if backend has initial code from /api/give-code
  fetch('/api/give-code')
    .then((res) => (res.ok ? res.json() : null))
    .then((data) => {
      const code = data?.code || data?.html;
      if (code && code.trim()) {
        const initialId = `chat-init-${Date.now()}`;
        createLoadingMessageGroup('Initial Workspace Draft', initialId);
        displayAiResponse({ ai_result: code }, 'Initial Workspace Draft', initialId);
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

  // Helper to convert base64 string to a downloadable Blob
  function base64ToBlob(base64, mimeType = 'application/octet-stream') {
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: mimeType });
  }

  // Generate Interactive 16:9 Presentation Slide Deck HTML
  function generateInteractiveSlideDeck(rawMarkdown, theme = 'amber', company = 'SatyaSetu') {
    const cleanText = rawMarkdown.replace(/^```[a-zA-Z]*\n?/, '').replace(/\n?```$/, '').trim();
    let rawBlocks = [];

    if (cleanText.includes('\n---\n') || cleanText.includes('\n--- \n') || cleanText.includes('\n---\r\n')) {
      rawBlocks = cleanText.split(/\n\s*---\s*\n/).filter((b) => b.trim());
    } else if (/##\s+Slide/i.test(cleanText)) {
      rawBlocks = cleanText.split(/(?=##\s+Slide)/i).filter((b) => b.trim());
    } else if (/##\s+/i.test(cleanText)) {
      rawBlocks = cleanText.split(/(?=##\s+)/i).filter((b) => b.trim());
    } else {
      rawBlocks = [cleanText];
    }

    const slides = rawBlocks.map((block, idx) => {
      const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
      let title = '';
      let subtitle = '';
      const bullets = [];
      const isTitle = idx === 0 || block.toLowerCase().slice(0, 80).includes('title slide');

      for (let line of lines) {
        if (line.startsWith('# ') || line.startsWith('## ') || line.startsWith('### ')) {
          const cand = line.replace(/^#{1,3}\s+/, '').replace(/^Slide\s+\d+:?\s*/i, '').trim();
          if (!title) title = cand;
          else bullets.push(cand);
        } else if (/^\*\*(?:Slide\s+\d+:?\s*)?(.*?)\*\*$/i.test(line)) {
          const cand = line.replace(/^\*\*(?:Slide\s+\d+:?\s*)?|\*\*$/gi, '').trim();
          if (!title) title = cand;
          else bullets.push(cand);
        } else if (line.startsWith('* ') || line.startsWith('- ') || line.startsWith('• ')) {
          bullets.push(line.replace(/^[\*\-•]\s+/, '').trim());
        } else if (/^\d+\.\s+/.test(line)) {
          bullets.push(line.replace(/^\d+\.\s+/, '').trim());
        } else {
          if (!title) title = line.replace(/[#*]/g, '').trim();
          else if (isTitle && !subtitle) subtitle = line.replace(/[#*]/g, '').trim();
          else bullets.push(line);
        }
      }

      return {
        number: idx + 1,
        title: title || `Slide ${idx + 1}`,
        subtitle: subtitle,
        bullets: bullets,
        isTitle: isTitle,
      };
    });

    const isLight = theme === 'light';
    const isNavy = theme === 'navy';
    const bg = isLight ? '#f8fafc' : isNavy ? '#0f172a' : '#110e08';
    const cardBg = isLight ? '#ffffff' : isNavy ? '#1e293b' : '#17130b';
    const text = isLight ? '#1e293b' : isNavy ? '#e2e8f0' : '#fbf7ee';
    const titleColor = isLight ? '#0f172a' : isNavy ? '#38bdf8' : '#e2a221';
    const accent = isLight ? '#0284c7' : isNavy ? '#38bdf8' : '#e2a221';
    const muted = isLight ? '#64748b' : isNavy ? '#94a3b8' : '#dfd4c0';

    let slidesHtml = slides.map((s, idx) => {
      if (s.isTitle) {
        return `
          <div class="slide slide-title-slide ${idx === 0 ? 'active' : ''}" data-index="${idx}">
            <span class="slide-org-badge">${escapeHtml(company || 'SatyaSetu')} Presentation</span>
            <h1 class="slide-main-title">${escapeHtml(s.title)}</h1>
            ${s.subtitle ? `<p class="slide-subtitle">${escapeHtml(s.subtitle)}</p>` : ''}
            <div class="slide-title-footer">Widescreen Presentation Deck  •  ${slides.length} Slides</div>
          </div>
        `;
      } else {
        const bulletList = s.bullets.map((b) => `<li>${escapeHtml(b.replace(/\*\*|__/g, ''))}</li>`).join('');
        return `
          <div class="slide ${idx === 0 ? 'active' : ''}" data-index="${idx}">
            <div class="slide-header">
              <span class="slide-num-pill">Slide ${s.number}</span>
              <h2 class="slide-content-title">${escapeHtml(s.title)}</h2>
            </div>
            <ul class="slide-bullets">${bulletList}</ul>
            <div class="slide-footer">
              <span>${escapeHtml(company || 'SatyaSetu')}</span>
              <span>Slide ${s.number} of ${slides.length}</span>
            </div>
          </div>
        `;
      }
    }).join('\n');

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,100..1000;1,9..40,100..1000&family=Momo+Trust+Display&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: ${bg};
      color: ${text};
      font-family: 'DM Sans', sans-serif;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 16px;
      overflow-x: hidden;
    }
    .deck-container {
      width: 100%;
      max-width: 860px;
      aspect-ratio: 16 / 9;
      background: ${cardBg};
      border: 1.5px solid rgba(226, 162, 33, 0.25);
      border-radius: 16px;
      box-shadow: 0 16px 40px rgba(0, 0, 0, 0.7);
      position: relative;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }
    .slide {
      flex: 1;
      padding: 36px 44px;
      display: none;
      flex-direction: column;
      justify-content: space-between;
      animation: slideIn 0.25s ease-out;
    }
    .slide.active { display: flex; }
    @keyframes slideIn {
      from { opacity: 0; transform: scale(0.985); }
      to { opacity: 1; transform: scale(1); }
    }
    .slide-title-slide {
      align-items: center;
      text-align: center;
      justify-content: center;
      gap: 16px;
    }
    .slide-org-badge {
      display: inline-flex;
      align-items: center;
      background: rgba(226, 162, 33, 0.15);
      border: 1px solid ${accent};
      padding: 6px 16px;
      border-radius: 20px;
      font-size: 0.82rem;
      color: ${titleColor};
      font-weight: 600;
      letter-spacing: 0.04em;
    }
    .slide-main-title {
      font-family: 'Momo Trust Display', serif;
      font-size: 2.3rem;
      color: ${titleColor};
      margin: 8px 0;
      line-height: 1.25;
      max-width: 90%;
    }
    .slide-subtitle {
      font-size: 1.15rem;
      color: ${muted};
      max-width: 80%;
      line-height: 1.5;
    }
    .slide-title-footer {
      font-size: 0.85rem;
      color: ${muted};
      margin-top: 14px;
      opacity: 0.8;
    }
    .slide-header {
      margin-bottom: 20px;
      border-bottom: 1px solid rgba(226, 162, 33, 0.2);
      padding-bottom: 12px;
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .slide-num-pill {
      font-size: 0.72rem;
      background: rgba(226, 162, 33, 0.2);
      color: ${titleColor};
      padding: 3px 8px;
      border-radius: 6px;
      font-weight: 700;
    }
    .slide-content-title {
      font-family: 'Momo Trust Display', serif;
      font-size: 1.7rem;
      color: ${titleColor};
      margin: 0;
    }
    .slide-bullets {
      list-style: none;
      display: flex;
      flex-direction: column;
      gap: 14px;
      flex: 1;
      justify-content: center;
    }
    .slide-bullets li {
      font-size: 1.05rem;
      color: ${text};
      line-height: 1.55;
      display: flex;
      align-items: flex-start;
      gap: 12px;
    }
    .slide-bullets li::before {
      content: '▪';
      color: ${accent};
      font-size: 1.4rem;
      line-height: 1;
      margin-top: 1px;
    }
    .slide-footer {
      display: flex;
      justify-content: space-between;
      font-size: 0.8rem;
      color: ${muted};
      border-top: 1px solid rgba(255, 255, 255, 0.06);
      padding-top: 10px;
      margin-top: 10px;
    }
    .deck-controls {
      display: flex;
      align-items: center;
      justify-content: space-between;
      width: 100%;
      max-width: 860px;
      margin-top: 14px;
      padding: 0 4px;
    }
    .deck-btn {
      background: rgba(226, 162, 33, 0.15);
      border: 1px solid rgba(226, 162, 33, 0.35);
      color: #fbf7ee;
      padding: 8px 18px;
      border-radius: 8px;
      font-family: 'DM Sans', sans-serif;
      font-size: 0.88rem;
      font-weight: 600;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      transition: all 0.2s ease;
    }
    .deck-btn:hover:not(:disabled) {
      background: ${accent};
      color: #0a0907;
      transform: translateY(-1px);
    }
    .deck-btn:disabled {
      opacity: 0.25;
      cursor: not-allowed;
      transform: none;
    }
    .deck-counter {
      font-size: 0.88rem;
      color: ${muted};
      font-weight: 600;
      letter-spacing: 0.05em;
    }
  </style>
</head>
<body>
  <div class="deck-container" id="deckContainer">
    ${slidesHtml}
  </div>
  <div class="deck-controls">
    <button type="button" class="deck-btn" id="prevBtn" onclick="prevSlide()">◀ Previous</button>
    <div class="deck-counter" id="slideCounter">Slide 1 of ${slides.length}</div>
    <button type="button" class="deck-btn" id="nextBtn" onclick="nextSlide()">Next ▶</button>
  </div>
  <script>
    let currentSlide = 0;
    const slides = document.querySelectorAll('.slide');
    function updateSlide() {
      slides.forEach((s, idx) => s.classList.toggle('active', idx === currentSlide));
      document.getElementById('slideCounter').textContent = 'Slide ' + (currentSlide + 1) + ' of ' + slides.length;
      document.getElementById('prevBtn').disabled = (currentSlide === 0);
      document.getElementById('nextBtn').disabled = (currentSlide === slides.length - 1);
    }
    function prevSlide() { if (currentSlide > 0) { currentSlide--; updateSlide(); } }
    function nextSlide() { if (currentSlide < slides.length - 1) { currentSlide++; updateSlide(); } }
    window.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight' || e.key === ' ') { nextSlide(); }
      else if (e.key === 'ArrowLeft') { prevSlide(); }
    });
    updateSlide();
  </script>
</body>
</html>`;
  }

  // Helper to render Markdown or outline text as clean HTML
  function markdownToHtml(rawMarkdown) {
    const lines = rawMarkdown.split('\n');
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
      </style>
    </head><body>`);

    for (let line of lines) {
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
      htmlLines.push(formatted);
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
      <div class="message-actions-bar" style="position: absolute; bottom: 12px; right: 12px; z-index: 10; display: flex; gap: 8px;">
        <button type="button" class="dashboard-btn download-pptx-btn" style="display: none; background: #e2a221; color: #000; font-weight: 600;">
          📊 Download PowerPoint (.pptx)
        </button>
        <button type="button" class="dashboard-btn download-result-btn" style="display: none;">
          📦 Download ZIP
        </button>
      </div>
    `;
    groupWrapper.appendChild(iframeWrapper);

    chatContainer.appendChild(groupWrapper);

    setTimeout(() => {
      chatContainer.scrollTop = chatContainer.scrollHeight;
    }, 20);

    return groupWrapper;
  }

  // Update existing message group with final AI response
  function displayAiResponse(responseData, promptText, chatId, isError = false) {
    if (!chatContainer) return;

    let groupWrapper = document.getElementById(`chat-group-${chatId}`);
    if (!groupWrapper) {
      groupWrapper = createLoadingMessageGroup(promptText || 'Workspace Query', chatId);
    }
    if (!groupWrapper) return;

    const rawContent = typeof responseData === 'object' && responseData.ai_result !== undefined
      ? responseData.ai_result
      : responseData;

    const isPresentation = (responseData?.is_presentation) ||
      (typeof rawContent === 'string' && (/--- Slide|\bSlide \d+:/i.test(rawContent) || /## Slide/i.test(rawContent))) ||
      (promptText && /presentation|slide deck|slides/i.test(promptText));

    const pptxBase64 = responseData?.pptx_base64 || null;

    let htmlToDisplay = '';
    const rawTextContent = typeof rawContent === 'string' ? rawContent : JSON.stringify(rawContent, null, 2);

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
    } else if (isPresentation && typeof rawContent === 'string') {
      // Render as interactive slide deck!
      const presTheme = document.getElementById('presTheme')?.value || 'amber';
      htmlToDisplay = generateInteractiveSlideDeck(rawContent, presTheme, orgName || 'SatyaSetu');
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

    // Configure Action Buttons
    const downloadPptxBtn = groupWrapper.querySelector('.download-pptx-btn');
    const downloadZipBtn = groupWrapper.querySelector('.download-result-btn');

    if (!isError && isPresentation) {
      if (downloadPptxBtn) {
        downloadPptxBtn.style.display = 'inline-flex';
        downloadPptxBtn.onclick = async () => {
          if (pptxBase64) {
            const blob = base64ToBlob(pptxBase64, 'application/vnd.openxmlformats-officedocument.presentationml.presentation');
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `SathyaSethu_Presentation_${Date.now()}.pptx`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
          } else {
            // Request PPTX export from backend
            try {
              downloadPptxBtn.disabled = true;
              downloadPptxBtn.textContent = 'Generating PPTX...';
              const res = await fetch('/api/export-pptx', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  markdown: rawTextContent,
                  theme: document.getElementById('presTheme')?.value || 'amber',
                  org_name: orgName || 'SatyaSetu'
                })
              });
              if (!res.ok) throw new Error('PPTX export failed');
              const blob = await res.blob();
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `SathyaSethu_Presentation_${Date.now()}.pptx`;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              URL.revokeObjectURL(url);
            } catch (err) {
              alert('Could not download PPTX: ' + err.message);
            } finally {
              downloadPptxBtn.disabled = false;
              downloadPptxBtn.textContent = '📊 Download PowerPoint (.pptx)';
            }
          }
        };
      }
    } else if (downloadPptxBtn) {
      downloadPptxBtn.style.display = 'none';
    }

    if (downloadZipBtn && !isError) {
      downloadZipBtn.style.display = 'inline-flex';
      downloadZipBtn.onclick = async () => {
        if (!window.JSZip) {
          alert('JSZip library not available.');
          return;
        }
        const zip = new JSZip();

        // If it's a presentation, include the real PPTX file in the ZIP!
        if (isPresentation) {
          let pptxBlob = null;
          if (pptxBase64) {
            pptxBlob = base64ToBlob(pptxBase64, 'application/vnd.openxmlformats-officedocument.presentationml.presentation');
          } else {
            try {
              const res = await fetch('/api/export-pptx', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  markdown: rawTextContent,
                  theme: document.getElementById('presTheme')?.value || 'amber',
                  org_name: orgName || 'SatyaSetu'
                })
              });
              if (res.ok) pptxBlob = await res.blob();
            } catch (e) {}
          }
          if (pptxBlob) {
            zip.file('presentation.pptx', pptxBlob);
          }
          zip.file('presentation.html', htmlToDisplay);
          zip.file('slides.md', rawTextContent);
        } else {
          zip.file('index.html', htmlToDisplay);
          if (typeof rawContent === 'string' && !rawContent.includes('<html')) {
            zip.file('content.md', rawContent);
          }
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
    } else if (downloadZipBtn) {
      downloadZipBtn.style.display = 'none';
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

  // Form Submission
  if (promptForm) {
    promptForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      if (isGenerating) {
        return;
      }

      const text = promptInput.value.trim();
      if (!text && attachedFiles.length === 0) {
        return;
      }

      const promptText = text || `Uploaded ${attachedFiles.length} file(s)`;
      const chatId = `chat-${Date.now()}`;

      createLoadingMessageGroup(promptText, chatId);

      const filesToSend = [...attachedFiles];
      promptInput.value = '';
      promptInput.style.height = 'auto';
      attachedFiles = [];
      renderAttachedFiles();
      if (fileInput) fileInput.value = '';

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

              displayAiResponse(followUpData, `${promptText} (Website)`, followUpChatId);

              chatSessions.push({
                id: followUpChatId,
                prompt: `${promptText} (Website)`,
                content: followUpData.ai_result,
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

        // Display response
        displayAiResponse(data, promptText, chatId);

        // Add entry to chat history with active indicator arrow (◄)
        const chatTitle = text.length > 22 ? text.slice(0, 20) + '...' : promptText;
        chatSessions.push({
          id: chatId,
          prompt: promptText,
          content: aiResult || data.final_output,
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
