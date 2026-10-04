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

  // Clear any legacy saved chat sessions from localStorage if present
  try {
    localStorage.removeItem('sathyasethu_saved_chat_sessions');
  } catch (e) {}

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
                     '/assets/logo.svg';

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
      orgName: orgName || 'SatyaSetu',
      orgIconUrl: orgIconUrl || '/assets/logo.svg',
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

  // Image extraction regex
  const IMG_REGEX = /(?:!\[(.*?)\]\((https?:\/\/[^\s\)]+)\))|(?:\[(?:Image|Photo|Unsplash)[^\]]*\]\((https?:\/\/[^\s\)]+)\))|(?:\*?Image(?:\s+Suggestion)?:\s*\[?(.*?)\]?\(?(https?:\/\/[^\s\)\*]+)\)?\*?)/i;

  // --- Split Multiple Deliverables ---
  function splitDeliverables(rawContent, formats = []) {
    if (typeof rawContent !== 'string') {
      return { presentation: null, website: null, mermaid: null, twitter: null, linkedin: null, raw: rawContent };
    }

    let websiteHtml = null;
    let mermaidCode = null;
    let presentationMd = null;
    let twitterContent = null;
    let linkedinContent = null;

    // 1. Extract website HTML
    const htmlMatch = rawContent.match(/```html\s*([\s\S]*?)```/i) ||
                      rawContent.match(/(<!DOCTYPE html>[\s\S]*?<\/html>)/i);
    if (htmlMatch) {
      websiteHtml = (htmlMatch[1] || htmlMatch[0]).trim();
    }

    // 2. Extract Mermaid code
    const mermaidMatch = rawContent.match(/```mermaid\s*([\s\S]*?)```/i) ||
                         rawContent.match(/(?:graph TD|graph LR|flowchart TD|flowchart LR|xychart-beta)[\s\S]*?(?=\n\n#|\n\n```|$)/i);
    if (mermaidMatch) {
      mermaidCode = (mermaidMatch[1] || mermaidMatch[0]).trim();
    }

    // 3. Extract Twitter/X post
    const twitterMatch = rawContent.match(/#{1,3}\s+(?:\d+\.\s+)?(?:Deliverable:\s*)?(?:Twitter(?:\/X)?(?:\s+Post)?|Tweet(?:\s+Thread)?)\b([\s\S]*?)(?=\n#{1,3}\s+(?:\d+\.\s+)?Deliverable:|\n```html|\n```mermaid|$)/i);
    if (twitterMatch) {
      twitterContent = twitterMatch[1].trim();
    } else if (formats.includes('twitter') && !formats.includes('presentation') && !formats.includes('website')) {
      twitterContent = rawContent.trim();
    }

    // 4. Extract LinkedIn post
    const linkedinMatch = rawContent.match(/#{1,3}\s+(?:\d+\.\s+)?(?:Deliverable:\s*)?LinkedIn(?:\s+Post)?\b([\s\S]*?)(?=\n#{1,3}\s+(?:\d+\.\s+)?Deliverable:|\n```html|\n```mermaid|$)/i);
    if (linkedinMatch) {
      linkedinContent = linkedinMatch[1].trim();
    } else if (formats.includes('linkedin') && !formats.includes('presentation') && !formats.includes('website') && !twitterContent) {
      linkedinContent = rawContent.trim();
    }

    // 5. Extract Presentation markdown (slides)
    let presText = rawContent;
    const delivMatch = presText.match(/\n#{1,3}\s+(?:\d+\.\s+)?(?:Deliverable:\s*)?(?:Website|Mermaid|Infographic|Diagram|Twitter|LinkedIn|Tweet)\b|\n```html|\n```mermaid/i);
    if (delivMatch) {
      presText = presText.slice(0, delivMatch.index).trim();
    }
    presText = presText.replace(/^(?:#{1,3}\s+(?:\d+\.\s+)?(?:Deliverable:\s*)?(?:Presentation|Slides)\b[^\n]*\n+)/i, '').trim();

    // ONLY mark as presentation if explicit slide structures exist OR presentation format was requested
    const hasExplicitSlides = /##\s*(?:Slide\s*\d+|Title\s*Slide)|\bSlide\s+\d+:|---\s*Slide\s*\d+/i.test(presText) ||
                              (formats.includes('presentation') && (presText.includes('\n---\n') || presText.includes('\n## ')));

    const onlySocial = formats.length > 0 && formats.every((f) => f === 'twitter' || f === 'linkedin');
    if (hasExplicitSlides && !onlySocial) {
      presentationMd = presText;
    }

    return {
      presentation: presentationMd,
      website: websiteHtml,
      mermaid: mermaidCode,
      twitter: twitterContent,
      linkedin: linkedinContent,
      raw: rawContent
    };
  }

  // Generate Interactive 16:9 Presentation Slide Deck HTML with Logo & Images
  function generateInteractiveSlideDeck(rawMarkdown, theme = 'amber', company = 'SatyaSetu', logoUrl = '/assets/logo.svg') {
    let cleanText = rawMarkdown.replace(/^```[a-zA-Z]*\n?/, '').replace(/\n?```$/, '').trim();
    cleanText = cleanText.replace(/^(?:#{1,3}\s+(?:\d+\.\s+)?(?:Deliverable:\s*)?(?:Presentation|Slides)\b[^\n]*\n+)/i, '').trim();
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
      // Discard code block slides
      if (block.startsWith('```html') || block.startsWith('```mermaid') || block.includes('<!DOCTYPE')) {
        return null;
      }

      const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
      let title = '';
      let subtitle = '';
      let imageUrl = '';
      const bullets = [];
      const isTitle = idx === 0 || block.toLowerCase().slice(0, 80).includes('title slide');

      for (let line of lines) {
        // Ignore deliverable headers
        if (/^#{1,3}\s+(?:\d+\.\s+)?(?:Deliverable:\s*)?(?:Presentation|Slides)\b/i.test(line)) {
          continue;
        }

        // Match images
        const mImg = IMG_REGEX.exec(line);
        if (mImg) {
          const matchGroups = [mImg[1], mImg[2], mImg[3], mImg[4], mImg[5]].filter(Boolean);
          for (let g of matchGroups) {
            if (g.startsWith('http')) imageUrl = g;
          }
          continue; // Strip image suggestion text from bullets
        }

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
        imageUrl: imageUrl,
        isTitle: isTitle,
      };
    }).filter(Boolean);

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
            <div class="slide-title-header">
              ${logoUrl ? `<img src="${logoUrl}" alt="Logo" class="slide-title-logo" onerror="this.style.display='none'" />` : ''}
              <span class="slide-org-badge">${escapeHtml(company || 'SatyaSetu')} Presentation</span>
            </div>
            <h1 class="slide-main-title">${escapeHtml(s.title)}</h1>
            ${s.subtitle ? `<p class="slide-subtitle">${escapeHtml(s.subtitle)}</p>` : ''}
            <div class="slide-title-footer">Widescreen Presentation Deck  •  ${slides.length} Slides</div>
          </div>
        `;
      } else {
        const bulletList = s.bullets.map((b) => `<li>${escapeHtml(b.replace(/\*\*|__/g, ''))}</li>`).join('');
        const hasPhoto = Boolean(s.imageUrl);

        return `
          <div class="slide ${idx === 0 ? 'active' : ''}" data-index="${idx}">
            <div class="slide-header">
              <span class="slide-num-pill">Slide ${s.number}</span>
              <h2 class="slide-content-title">${escapeHtml(s.title)}</h2>
            </div>
            <div class="slide-body-layout ${hasPhoto ? 'has-photo-layout' : ''}">
              <ul class="slide-bullets">${bulletList}</ul>
              ${hasPhoto ? `
                <div class="slide-photo-col">
                  <img src="${s.imageUrl}" alt="${escapeHtml(s.title)}" class="slide-photo" onerror="this.parentElement.style.display='none';" />
                </div>
              ` : ''}
            </div>
            <div class="slide-footer">
              <div class="slide-footer-brand">
                ${logoUrl ? `<img src="${logoUrl}" alt="Logo" class="slide-footer-logo" onerror="this.style.display='none'" />` : ''}
                <span>${escapeHtml(company || 'SatyaSetu')}</span>
              </div>
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
      padding: 34px 44px;
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
    .slide-title-header {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .slide-title-logo {
      height: 38px;
      width: 38px;
      object-fit: contain;
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
      margin-bottom: 16px;
      border-bottom: 1px solid rgba(226, 162, 33, 0.2);
      padding-bottom: 10px;
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
      font-size: 1.65rem;
      color: ${titleColor};
      margin: 0;
    }
    .slide-body-layout {
      display: flex;
      gap: 24px;
      flex: 1;
      align-items: center;
    }
    .slide-bullets {
      list-style: none;
      display: flex;
      flex-direction: column;
      gap: 12px;
      flex: 1;
      justify-content: center;
    }
    .slide-bullets li {
      font-size: 1.02rem;
      color: ${text};
      line-height: 1.5;
      display: flex;
      align-items: flex-start;
      gap: 10px;
    }
    .slide-bullets li::before {
      content: '▪';
      color: ${accent};
      font-size: 1.3rem;
      line-height: 1;
      margin-top: 1px;
    }
    .slide-photo-col {
      width: 260px;
      height: 180px;
      flex-shrink: 0;
      border-radius: 10px;
      overflow: hidden;
      border: 1px solid rgba(226, 162, 33, 0.25);
      box-shadow: 0 4px 14px rgba(0, 0, 0, 0.5);
    }
    .slide-photo {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }
    .slide-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 0.8rem;
      color: ${muted};
      border-top: 1px solid rgba(255, 255, 255, 0.06);
      padding-top: 10px;
      margin-top: 8px;
    }
    .slide-footer-brand {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .slide-footer-logo {
      height: 18px;
      width: 18px;
      object-fit: contain;
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

  // Helper to wrap Mermaid code in standalone viewer HTML
  function renderMermaidHtml(cleanMermaidCode) {
    return `<!DOCTYPE html><html><head><meta charset="utf-8">
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
        ${cleanMermaidCode}
      </div>
    </body></html>`;
  }

  // Helper to render interactive Social Media (Twitter/X or LinkedIn) card with Copy to Clipboard
  function renderSocialMediaHtml(rawPostContent, platform = 'twitter', company = 'SatyaSetu', logoUrl = '/assets/logo.svg') {
    let cleanText = String(rawPostContent || '')
      .replace(/^```[a-zA-Z]*\n?/, '')
      .replace(/\n?```$/, '')
      .replace(/^#{1,3}\s+(?:\d+\.\s+)?(?:Deliverable:\s*)?(?:Twitter(?:\/X)?(?:\s+Post)?|LinkedIn(?:\s+Post)?|Social(?:\s+Media)?)[^\n]*\n+/i, '')
      .trim();

    const isTwitter = platform === 'twitter';
    const brandName = company || 'SatyaSetu';
    const handle = `@${brandName.toLowerCase().replace(/[^a-z0-9_]/g, '') || 'sathyasethu'}`;

    // Split into tweets if it's a thread
    let tweets = [];
    if (isTwitter) {
      if (cleanText.includes('\n---\n') || cleanText.includes('\n--- \n')) {
        tweets = cleanText.split(/\n\s*---\s*\n/).map((t) => t.trim()).filter(Boolean);
      } else if (/\n\n(?=(?:\[?\d+[\/\)]\d*|\d+\.\s+))/m.test(cleanText)) {
        tweets = cleanText.split(/\n\n(?=(?:\[?\d+[\/\)]\d*|\d+\.\s+))/m).map((t) => t.trim()).filter(Boolean);
      } else {
        tweets = [cleanText];
      }
    } else {
      tweets = [cleanText];
    }

    function formatSocialBody(text) {
      let escaped = escapeHtml(text);
      escaped = escaped.replace(/(#[a-zA-Z0-9_\u0900-\u097F]+)/g, '<span class="hashtag">$1</span>');
      escaped = escaped.replace(/(@[a-zA-Z0-9_]+)/g, '<span class="mention">$1</span>');
      escaped = escaped.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" class="social-link">$1</a>');
      return escaped.replace(/\n/g, '<br>');
    }

    const tweetCardsHtml = tweets.map((tweet, idx) => {
      const charCount = tweet.length;
      const countClass = charCount > 280 ? 'count-warning' : 'count-ok';
      const isThread = tweets.length > 1;

      return `
        <div class="tweet-card ${isThread && idx < tweets.length - 1 ? 'has-thread-line' : ''}">
          <div class="tweet-avatar-col">
            <div class="tweet-avatar">
              ${logoUrl ? `<img src="${logoUrl}" alt="${escapeHtml(brandName)}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';" />` : ''}
              <span class="avatar-fallback" style="${logoUrl ? 'display:none;' : 'display:flex;'}">${brandName.charAt(0).toUpperCase()}</span>
            </div>
            ${isThread && idx < tweets.length - 1 ? '<div class="thread-connector"></div>' : ''}
          </div>
          <div class="tweet-main">
            <div class="tweet-header">
              <span class="tweet-name">${escapeHtml(brandName)}</span>
              <span class="verified-badge" title="Verified">✓</span>
              <span class="tweet-handle">${escapeHtml(handle)}</span>
              <span class="tweet-dot">·</span>
              <span class="tweet-time">${isThread ? `Tweet ${idx + 1}/${tweets.length}` : 'Just now'}</span>
            </div>
            <div class="tweet-body">
              ${formatSocialBody(tweet)}
            </div>
            <div class="tweet-footer">
              <div class="tweet-metrics">
                <span class="metric-btn" title="Reply"><span class="icon">💬</span> 12</span>
                <span class="metric-btn" title="Repost"><span class="icon">🔁</span> 48</span>
                <span class="metric-btn" title="Like"><span class="icon">❤️</span> 186</span>
              </div>
              <div class="tweet-tools">
                <span class="char-pill ${countClass}">${charCount} / 280</span>
                <button type="button" class="mini-copy-btn" onclick="copySnippet(${idx})">📋 Copy</button>
              </div>
            </div>
          </div>
        </div>
      `;
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
      background: #0d0a06;
      color: #fbf7ee;
      font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      padding: 24px 20px;
      display: flex;
      flex-direction: column;
      align-items: center;
      min-height: 100vh;
    }
    .feed-container {
      width: 100%;
      max-width: 620px;
      background: #140f09;
      border: 1px solid rgba(226, 162, 33, 0.25);
      border-radius: 18px;
      padding: 20px;
      box-shadow: 0 12px 36px rgba(0, 0, 0, 0.6);
    }
    .top-action-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 18px;
      padding-bottom: 14px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    }
    .platform-badge {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 0.95rem;
      font-weight: 700;
      color: #e2a221;
      font-family: 'Momo Trust Display', serif;
    }
    .platform-icon {
      font-size: 1.15rem;
      color: #ffffff;
    }
    .main-copy-btn {
      background: #e2a221;
      color: #0a0907;
      border: none;
      padding: 8px 18px;
      border-radius: 20px;
      font-size: 0.86rem;
      font-weight: 700;
      font-family: 'DM Sans', sans-serif;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      transition: all 0.2s ease;
      box-shadow: 0 4px 14px rgba(226, 162, 33, 0.35);
    }
    .main-copy-btn:hover {
      background: #f5b73d;
      transform: translateY(-1px);
    }
    .main-copy-btn.copied {
      background: #22c55e !important;
      color: #ffffff !important;
      box-shadow: 0 4px 14px rgba(34, 197, 94, 0.35) !important;
    }
    .tweet-card {
      display: flex;
      gap: 14px;
      position: relative;
      padding-bottom: 16px;
    }
    .tweet-card.has-thread-line {
      padding-bottom: 24px;
    }
    .tweet-avatar-col {
      display: flex;
      flex-direction: column;
      align-items: center;
      flex-shrink: 0;
      width: 44px;
    }
    .tweet-avatar {
      width: 44px;
      height: 44px;
      border-radius: 50%;
      background: #221a10;
      border: 1.5px solid rgba(226, 162, 33, 0.4);
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      flex-shrink: 0;
    }
    .tweet-avatar img {
      width: 100%;
      height: 100%;
      object-fit: contain;
    }
    .avatar-fallback {
      font-size: 1.1rem;
      font-weight: 700;
      color: #e2a221;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      height: 100%;
    }
    .thread-connector {
      width: 2px;
      flex: 1;
      background: rgba(226, 162, 33, 0.25);
      margin-top: 8px;
    }
    .tweet-main {
      flex: 1;
      min-width: 0;
    }
    .tweet-header {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-wrap: wrap;
      margin-bottom: 8px;
    }
    .tweet-name {
      font-weight: 700;
      font-size: 0.98rem;
      color: #ffffff;
    }
    .verified-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 16px;
      height: 16px;
      border-radius: 50%;
      background: #1d9bf0;
      color: #ffffff;
      font-size: 10px;
      font-weight: bold;
    }
    .tweet-handle {
      color: #8b8070;
      font-size: 0.88rem;
    }
    .tweet-dot {
      color: #8b8070;
      font-size: 0.85rem;
    }
    .tweet-time {
      color: #8b8070;
      font-size: 0.85rem;
    }
    .tweet-body {
      font-size: 1rem;
      line-height: 1.55;
      color: #e8e2d5;
      word-break: break-word;
      margin-bottom: 12px;
    }
    .hashtag {
      color: #1d9bf0;
      font-weight: 500;
    }
    .mention {
      color: #1d9bf0;
      font-weight: 500;
    }
    .social-link {
      color: #e2a221;
      text-decoration: underline;
    }
    .tweet-footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-top: 1px solid rgba(255, 255, 255, 0.05);
      padding-top: 10px;
    }
    .tweet-metrics {
      display: flex;
      gap: 18px;
    }
    .metric-btn {
      color: #7a7060;
      font-size: 0.82rem;
      display: inline-flex;
      align-items: center;
      gap: 5px;
      user-select: none;
    }
    .tweet-tools {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .char-pill {
      font-size: 0.72rem;
      padding: 3px 8px;
      border-radius: 12px;
      font-weight: 600;
    }
    .count-ok {
      background: rgba(34, 197, 94, 0.15);
      color: #4ade80;
    }
    .count-warning {
      background: rgba(239, 68, 68, 0.15);
      color: #f87171;
    }
    .mini-copy-btn {
      background: rgba(226, 162, 33, 0.12);
      border: 1px solid rgba(226, 162, 33, 0.28);
      color: #dfd4c0;
      padding: 4px 10px;
      border-radius: 6px;
      font-size: 0.76rem;
      cursor: pointer;
      transition: all 0.2s ease;
      font-family: 'DM Sans', sans-serif;
    }
    .mini-copy-btn:hover {
      background: rgba(226, 162, 33, 0.25);
      color: #ffffff;
    }
    .mini-copy-btn.copied {
      background: #22c55e !important;
      color: #ffffff !important;
      border-color: #22c55e !important;
    }
    .raw-data-store {
      display: none;
    }
  </style>
</head>
<body>
  <div class="feed-container">
    <div class="top-action-bar">
      <div class="platform-badge">
        <span class="platform-icon">${isTwitter ? '𝕏' : 'in'}</span>
        <span>${isTwitter ? 'Twitter / X Post' : 'LinkedIn Post'}</span>
      </div>
      <button type="button" class="main-copy-btn" id="fullCopyBtn" onclick="copyFullPost()">
        📋 Copy Post
      </button>
    </div>

    ${tweetCardsHtml}
  </div>

  <div class="raw-data-store" id="rawFullPost">${escapeHtml(cleanText)}</div>
  <script>
    const tweetsData = ${JSON.stringify(tweets)};

    function executeCopy(text, btnElement) {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(() => {
          showCopied(btnElement);
        }).catch(() => fallbackCopy(text, btnElement));
      } else {
        fallbackCopy(text, btnElement);
      }
    }

    function fallbackCopy(text, btnElement) {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); } catch(e){}
      document.body.removeChild(ta);
      showCopied(btnElement);
    }

    function showCopied(btn) {
      if (!btn) return;
      const originalText = btn.innerHTML;
      btn.innerHTML = '✓ Copied!';
      btn.classList.add('copied');
      setTimeout(() => {
        btn.innerHTML = originalText;
        btn.classList.remove('copied');
      }, 2000);
    }

    function copyFullPost() {
      const fullText = document.getElementById('rawFullPost').textContent;
      const btn = document.getElementById('fullCopyBtn');
      executeCopy(fullText, btn);
    }

    function copySnippet(index) {
      const snippet = tweetsData[index] || '';
      const btns = document.querySelectorAll('.mini-copy-btn');
      const btn = btns[index];
      executeCopy(snippet, btn);
    }
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
    groupWrapper.style.gap = '14px';
    groupWrapper.style.marginBottom = '24px';

    const userRow = document.createElement('div');
    userRow.className = 'user-message-row';
    userRow.style.display = 'flex';
    userRow.innerHTML = `<div class="user-bubble">${escapeHtml(promptText)}</div>`;
    groupWrapper.appendChild(userRow);

    // Deliverables Tab Bar Slot
    const tabContainer = document.createElement('div');
    tabContainer.className = 'deliverables-tab-bar';
    tabContainer.style.display = 'none';
    groupWrapper.appendChild(tabContainer);

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
          Download PowerPoint (.pptx)
        </button>
        <button type="button" class="dashboard-btn download-result-btn" style="display: none;">
          Download ZIP
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

    const pptxBase64 = responseData?.pptx_base64 || null;
    const iframe = groupWrapper.querySelector('.preview-iframe');
    const tabContainer = groupWrapper.querySelector('.deliverables-tab-bar');
    const downloadPptxBtn = groupWrapper.querySelector('.download-pptx-btn');
    const downloadZipBtn = groupWrapper.querySelector('.download-result-btn');

    if (isError) {
      const errHtml = `<!DOCTYPE html><html><head>
        <meta charset="utf-8">
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,100..1000;1,9..40,100..1000&family=Momo+Trust+Display&display=swap" rel="stylesheet">
      </head><body style="background:#110e08;color:#ff6b6b;font-family:'DM Sans',sans-serif;padding:28px;margin:0;box-sizing:border-box;">
        <h3 style="font-family:'Momo Trust Display',serif;color:#ff6b6b;margin-top:0;font-size:1.3rem;">⚠️ Generation Error</h3>
        <p style="font-size:15px;line-height:1.6;color:#dfd4c0;">${escapeHtml(typeof rawContent === 'string' ? rawContent : JSON.stringify(rawContent, null, 2))}</p>
      </body></html>`;
      if (iframe) iframe.srcdoc = errHtml;
      if (downloadPptxBtn) downloadPptxBtn.style.display = 'none';
      if (downloadZipBtn) downloadZipBtn.style.display = 'none';
      return;
    }

    const currentFormats = (responseData && responseData.config && responseData.config.formats) ||
                           (typeof readConfig === 'function' ? readConfig().formats : []) || [];
    const deliverables = splitDeliverables(rawContent, currentFormats);
    const presTheme = (responseData && responseData.config && responseData.config.presTheme) ||
                      document.getElementById('presTheme')?.value || 'amber';

    // Build active deliverables dictionary
    const views = {};
    if (deliverables.twitter) {
      views.twitter = {
        title: 'Twitter / X Post',
        html: renderSocialMediaHtml(deliverables.twitter, 'twitter', orgName || 'SatyaSetu', orgIconUrl)
      };
    }
    if (deliverables.linkedin) {
      views.linkedin = {
        title: 'LinkedIn Post',
        html: renderSocialMediaHtml(deliverables.linkedin, 'linkedin', orgName || 'SatyaSetu', orgIconUrl)
      };
    }
    if (deliverables.presentation) {
      views.presentation = {
        title: 'Presentation Deck',
        html: generateInteractiveSlideDeck(deliverables.presentation, presTheme, orgName || 'SatyaSetu', orgIconUrl)
      };
    }
    if (deliverables.website) {
      views.website = {
        title: 'Interactive Website',
        html: deliverables.website
      };
    }
    if (deliverables.mermaid) {
      views.mermaid = {
        title: 'Mermaid Diagram',
        html: renderMermaidHtml(deliverables.mermaid)
      };
    }

    // Fallback if no specific deliverables were parsed
    if (Object.keys(views).length === 0) {
      if (currentFormats.includes('twitter')) {
        views.twitter = {
          title: 'Twitter / X Post',
          html: renderSocialMediaHtml(String(rawContent), 'twitter', orgName || 'SatyaSetu', orgIconUrl)
        };
      } else if (currentFormats.includes('linkedin')) {
        views.linkedin = {
          title: 'LinkedIn Post',
          html: renderSocialMediaHtml(String(rawContent), 'linkedin', orgName || 'SatyaSetu', orgIconUrl)
        };
      } else if (typeof rawContent === 'string' && (rawContent.includes('<html') || rawContent.includes('<!DOCTYPE'))) {
        views.website = { title: 'Website', html: rawContent };
      } else if (typeof rawContent === 'string' && (rawContent.includes('graph ') || rawContent.includes('flowchart ') || rawContent.includes('xychart-beta'))) {
        views.mermaid = { title: 'Mermaid Diagram', html: renderMermaidHtml(rawContent) };
      } else if ((currentFormats.includes('presentation') || responseData?.is_presentation || /slide/i.test(promptText)) && !currentFormats.includes('twitter') && !currentFormats.includes('linkedin')) {
        views.presentation = {
          title: 'Presentation Deck',
          html: generateInteractiveSlideDeck(String(rawContent), presTheme, orgName || 'SatyaSetu', orgIconUrl)
        };
      } else {
        views.document = { title: 'Document', html: markdownToHtml(String(rawContent)) };
      }
    }

    const keys = Object.keys(views);

    // Render Deliverables Tabs if more than 1 output exists
    if (tabContainer && keys.length > 1) {
      tabContainer.innerHTML = '';
      tabContainer.style.display = 'flex';
      keys.forEach((key, index) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `deliv-tab ${index === 0 ? 'active' : ''}`;
        btn.textContent = views[key].title;
        btn.dataset.key = key;
        btn.onclick = () => {
          tabContainer.querySelectorAll('.deliv-tab').forEach((t) => t.classList.remove('active'));
          btn.classList.add('active');
          if (iframe) iframe.srcdoc = views[key].html;
          if (downloadPptxBtn) {
            downloadPptxBtn.style.display = key === 'presentation' ? 'inline-flex' : 'none';
          }
        };
        tabContainer.appendChild(btn);
      });
    } else if (tabContainer) {
      tabContainer.style.display = 'none';
    }

    // Default view: first deliverable
    const defaultKey = keys[0];
    if (iframe && views[defaultKey]) {
      iframe.srcdoc = views[defaultKey].html;
    }

    // Configure PowerPoint Download Button
    const hasPresentation = Boolean(views.presentation);
    if (downloadPptxBtn) {
      downloadPptxBtn.style.display = (hasPresentation && defaultKey === 'presentation') ? 'inline-flex' : 'none';
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
          try {
            downloadPptxBtn.disabled = true;
            downloadPptxBtn.textContent = 'Generating PPTX...';
            const res = await fetch('/api/export-pptx', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                markdown: deliverables.presentation || rawContent,
                theme: presTheme,
                org_name: orgName || 'SatyaSetu',
                org_icon_url: orgIconUrl || '/assets/logo.svg'
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
            downloadPptxBtn.textContent = 'Download PowerPoint (.pptx)';
          }
        }
      };
    }

    // Configure ZIP Download Button (Packages all deliverables cleanly)
    if (downloadZipBtn) {
      downloadZipBtn.style.display = 'inline-flex';
      downloadZipBtn.onclick = async () => {
        if (!window.JSZip) {
          alert('JSZip library not available.');
          return;
        }
        const zip = new JSZip();

        // 1. Presentation
        if (hasPresentation) {
          let pptxBlob = null;
          if (pptxBase64) {
            pptxBlob = base64ToBlob(pptxBase64, 'application/vnd.openxmlformats-officedocument.presentationml.presentation');
          } else {
            try {
              const res = await fetch('/api/export-pptx', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  markdown: deliverables.presentation || rawContent,
                  theme: presTheme,
                  org_name: orgName || 'SatyaSetu',
                  org_icon_url: orgIconUrl || '/assets/logo.svg'
                })
              });
              if (res.ok) pptxBlob = await res.blob();
            } catch (e) {}
          }
          if (pptxBlob) zip.file('presentation.pptx', pptxBlob);
          zip.file('presentation.html', views.presentation.html);
          zip.file('slides.md', deliverables.presentation);
        }

        // 2. Website
        if (views.website) {
          zip.file('website.html', views.website.html);
        }

        // 3. Mermaid Diagram
        if (views.mermaid) {
          zip.file('diagram.html', views.mermaid.html);
          if (deliverables.mermaid) zip.file('diagram.mmd', deliverables.mermaid);
        }

        // 4. Twitter / X Post
        if (views.twitter) {
          zip.file('twitter_post.html', views.twitter.html);
          if (deliverables.twitter) zip.file('tweet.txt', deliverables.twitter);
        }

        // 5. LinkedIn Post
        if (views.linkedin) {
          zip.file('linkedin_post.html', views.linkedin.html);
          if (deliverables.linkedin) zip.file('linkedin_post.txt', deliverables.linkedin);
        }

        // 6. Raw text source
        if (typeof rawContent === 'string') {
          zip.file('full_output.md', rawContent);
        }

        const blob = await zip.generateAsync({ type: 'blob' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `SathyaSethu_Bundle_${Date.now()}.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      };
    }

    // Update in-memory chatSessions list
    const existingIdx = chatSessions.findIndex((s) => s.id === chatId);
    const sessionConfig = (responseData && responseData.config) || (currentFormats.length > 0 ? { formats: currentFormats } : {});
    const sessionObj = {
      id: chatId,
      prompt: promptText,
      content: rawContent,
      responseData: responseData,
      config: sessionConfig,
      timestamp: Date.now()
    };
    if (existingIdx >= 0) {
      chatSessions[existingIdx] = sessionObj;
    } else {
      chatSessions.push(sessionObj);
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
          const currentGroupWrapper = document.getElementById(`chat-group-${chatId}`);
          window.createButtonFunction(aiResult, async (selectedChoices) => {
            const nextConfig = { ...configData, ...selectedChoices };

            if (currentGroupWrapper) {
              const iframe = currentGroupWrapper.querySelector('.preview-iframe');
              if (iframe) {
                iframe.srcdoc = `<!DOCTYPE html><html><head>
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
                  <span style="font-size:15px;letter-spacing:0.02em;color:#fbf7ee;">Generating deliverables with chosen style... Please wait...</span>
                </body></html>`;
              }
              const iframeWrapper = currentGroupWrapper.querySelector('.iframe-wrapper');
              if (iframeWrapper) iframeWrapper.style.display = 'block';
            }

            activeAbortController = new AbortController();
            setGeneratingState(true, chatId);

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
                throw new Error(followUpData.detail || 'Failed to generate deliverables');
              }

              displayAiResponse(followUpData, promptText, chatId);
            } catch (followUpErr) {
              if (followUpErr.name !== 'AbortError') {
                displayAiResponse(followUpErr.message, promptText, chatId, true);
              }
            } finally {
              setGeneratingState(false);
              activeAbortController = null;
            }
          }, currentGroupWrapper);
          return;
        }

        // Display response (automatically persists to localStorage & updates chat history)
        displayAiResponse(data, promptText, chatId);
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

  // --- Dynamic Color Palette and Font Selection (using createColorpalette & createFontBox) ---
  window.createColorpalette = function (colors, targetContainer, onSelect) {
    const palleteContainer = document.createElement('div');
    palleteContainer.className = 'palette';

    colors.forEach((color) => {
      const sw = document.createElement('div');
      sw.className = 'sw';
      sw.style.backgroundColor = color;
      sw.title = color.toUpperCase();
      if (colors.length <= 3) {
        sw.textContent = color.toUpperCase();
      }
      palleteContainer.appendChild(sw);
    });

    palleteContainer.addEventListener('click', () => {
      targetContainer.querySelectorAll('.palette').forEach((p) => p.classList.remove('selected'));
      palleteContainer.classList.add('selected');
      if (onSelect) onSelect(colors);
    });

    targetContainer.appendChild(palleteContainer);
    return palleteContainer;
  };

  window.createFontBox = function (fontName, fontType, targetContainer, onSelect) {
    const fontContainer = document.createElement('div');
    fontContainer.className = `font-container ${fontType}-font`;

    const fontParam = encodeURIComponent(fontName).replace(/%20/g, '+');
    const fontLink = `https://fonts.googleapis.com/css2?family=${fontParam}&display=swap`;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = fontLink;
    document.head.appendChild(link);

    fontContainer.textContent = fontName;
    link.onload = () => {
      fontContainer.style.fontFamily = `"${fontName}", sans-serif`;
    };

    fontContainer.addEventListener('click', () => {
      targetContainer.querySelectorAll(`.${fontType}-font`).forEach((f) => f.classList.remove('selected'));
      fontContainer.classList.add('selected');
      if (onSelect) onSelect(fontName);
    });

    targetContainer.appendChild(fontContainer);
    return fontContainer;
  };

  window.createButtonFunction = function (options, callback, targetGroupWrapper) {
    if (!aiSelectionArea || !paletteDisplay || !fontDisplay || !confirmSelectionBtn) return;

    if (targetGroupWrapper) {
      const iframeWrapper = targetGroupWrapper.querySelector('.iframe-wrapper');
      if (iframeWrapper) iframeWrapper.style.display = 'none';
      targetGroupWrapper.appendChild(aiSelectionArea);
    }

    aiSelectionArea.style.display = 'block';
    paletteDisplay.innerHTML = '<div class="selection-subtitle">Color Palette (Pick 1)</div>';
    fontDisplay.innerHTML = '';
    confirmSelectionBtn.style.display = 'none';

    let selectedPalette = null;
    let selectedBodyFont = null;
    let selectedTitleFont = null;

    // Build color palettes
    if (options.palettes && Array.isArray(options.palettes)) {
      const paletteList = document.createElement('div');
      paletteList.className = 'selection-grid';
      options.palettes.forEach((palette) => {
        window.createColorpalette(palette, paletteList, (chosen) => {
          selectedPalette = chosen;
          checkSelections();
        });
      });
      paletteDisplay.appendChild(paletteList);
    }

    // Build font preview boxes into 2 neat rows: Title Fonts & Body Fonts
    if (options.fonts && Array.isArray(options.fonts)) {
      const fontWrapper = document.createElement('div');
      fontWrapper.className = 'font-sections-wrapper';

      const titleSection = document.createElement('div');
      titleSection.innerHTML = '<div class="selection-subtitle">Title Font (Pick 1)</div>';
      const titleRow = document.createElement('div');
      titleRow.className = 'font-options-row title-fonts-row';
      titleSection.appendChild(titleRow);

      const bodySection = document.createElement('div');
      bodySection.innerHTML = '<div class="selection-subtitle">Body Font (Pick 1)</div>';
      const bodyRow = document.createElement('div');
      bodyRow.className = 'font-options-row body-fonts-row';
      bodySection.appendChild(bodyRow);

      options.fonts.forEach((fontObj) => {
        const isTitle = fontObj.type === 'title';
        const targetRow = isTitle ? titleRow : bodyRow;
        window.createFontBox(fontObj.name, fontObj.type || 'body', targetRow, (chosen) => {
          if (isTitle) selectedTitleFont = chosen;
          else selectedBodyFont = chosen;
          checkSelections();
        });
      });

      fontWrapper.appendChild(titleSection);
      fontWrapper.appendChild(bodySection);
      fontDisplay.appendChild(fontWrapper);
    }

    function checkSelections() {
      if (selectedPalette && selectedBodyFont && selectedTitleFont) {
        confirmSelectionBtn.style.display = 'inline-flex';
      }
    }

    confirmSelectionBtn.onclick = () => {
      aiSelectionArea.style.display = 'none';
      if (targetGroupWrapper) {
        const iframeWrapper = targetGroupWrapper.querySelector('.iframe-wrapper');
        if (iframeWrapper) iframeWrapper.style.display = 'block';
      }
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
