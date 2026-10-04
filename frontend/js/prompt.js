document.addEventListener('DOMContentLoaded', () => {
  const chatHistoryList = document.getElementById('chatHistoryList');
  const promptForm = document.getElementById('promptForm');
  const promptInput = document.getElementById('promptInput');
  const fileInput = document.getElementById('fileInput');
  const attachedFilesList = document.getElementById('attachedFilesList');
  const contentIframe = document.getElementById('contentIframe');
  const iframeWrapper = document.getElementById('iframeWrapper');
  const userMessageRow = document.getElementById('userMessageRow');
  const userMessageText = document.getElementById('userMessageText');
  const submitBtn = document.getElementById('submitBtn');
  const brandIconImg = document.getElementById('brandIconImg');
  
  // New UI Elements
  const configToggleBtn = document.getElementById('configToggleBtn');
  const configPanel = document.getElementById('configPanel');
  const aiSelectionArea = document.getElementById('aiSelectionArea');
  const paletteDisplay = document.getElementById('paletteDisplay');
  const fontDisplay = document.getElementById('fontDisplay');
  const confirmSelectionBtn = document.getElementById('confirmSelectionBtn');

  // Track attached files and chat entries
  let attachedFiles = [];
  const chatSessions = [];

  // Retrieve saved authentication and organization info from storage
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

  const brandText = document.getElementById('brandText');
  if (brandText && orgName && orgName.toLowerCase() !== 'unincorporated') {
    brandText.textContent = toTitleCase(orgName);
  }

  // Check if backend has initial code from /api/give-code
  fetch('/api/give-code')
    .then((res) => (res.ok ? res.json() : null))
    .then((data) => {
      const code = data?.code || data?.html;
      if (code && code.trim()) {
        displayAiResponse(code);
      }
    })
    .catch(() => {});
  const chatContainer = document.getElementById('chatContainer');
  
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
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
    
    const loadingHtml = `<!DOCTYPE html><html><body style="background:#110e08;color:#e2a221;font-family:sans-serif;padding:32px;display:flex;align-items:center;gap:12px;">
      <style>
        .spinner { width:22px; height:22px; border:3px solid rgba(226,162,33,0.3); border-top-color:#e2a221; border-radius:50%; animation:spin 0.8s linear infinite; }
        @keyframes spin { to { transform:rotate(360deg); } }
      </style>
      <div class="spinner"></div>
      <span style="font-size:15px;letter-spacing:0.02em;">Generating output with AI... Please wait...</span>
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
  
  // Update message group with final AI response
  function displayAiResponse(htmlContent, promptText, chatId) {
    if (!chatContainer) return;
    
    let groupWrapper = document.getElementById(`chat-group-${chatId}`);
    if (!groupWrapper && promptText && chatId) {
      groupWrapper = createLoadingMessageGroup(promptText, chatId);
    }
    if (!groupWrapper) return;
    
    const iframe = groupWrapper.querySelector('.preview-iframe');
    if (iframe) {
      iframe.srcdoc = htmlContent;
    }

    const downloadBtn = groupWrapper.querySelector('.download-result-btn');
    if (downloadBtn) {
      downloadBtn.style.display = 'inline-flex';
      downloadBtn.onclick = async () => {
        if (!window.JSZip) {
          alert('JSZip not loaded.');
          return;
        }
        const zip = new JSZip();
        const isHtml = htmlContent.includes('<html') || htmlContent.includes('<!DOCTYPE');
        const fileName = isHtml ? 'output.html' : 'output.md';
        zip.file(fileName, htmlContent);
        
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
    }
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

  // --- Drag and Drop File Handling ---
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

  // Handle File Input Selection (accepts any file format)
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
      promptInput.style.height = `${Math.min(promptInput.scrollHeight, 160)}px`;
    });

    promptInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        promptForm.requestSubmit();
      }
    });
  }

  // Submit Prompt to Backend
  if (promptForm) {
    promptForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const text = promptInput.value.trim();

      if (!text && attachedFiles.length === 0) {
        return;
      }

      const promptText = text || `Uploaded ${attachedFiles.length} file(s)`;
      const chatId = `chat-${Date.now()}`;

      // Immediately create loading message group with user bubble & spinner
      createLoadingMessageGroup(promptText, chatId);

      // Copy attached files array and reset inputs immediately
      const filesToSend = [...attachedFiles];
      promptInput.value = '';
      promptInput.style.height = 'auto';
      attachedFiles = [];
      renderAttachedFiles();
      if (fileInput) fileInput.value = '';

      submitBtn.disabled = true;

      try {
        // Collect Configuration Parameters
        const outFormatsSelect = document.getElementById('outFormats');
        const formats = outFormatsSelect ? Array.from(outFormatsSelect.selectedOptions).map(opt => opt.value) : [];
        const configData = {
          formats: formats,
          audience: document.getElementById('outAudience')?.value.trim() || '',
          tone: document.getElementById('outTone')?.value || 'professional',
          language: document.getElementById('outLanguage')?.value.trim() || 'English',
          level: document.getElementById('outLevel')?.value || 'standard',
          objective: document.getElementById('outObjective')?.value.trim() || '',
          style: document.getElementById('outStyle')?.value.trim() || '',
          orgName: typeof orgName !== 'undefined' ? orgName : '',
          orgIconUrl: typeof orgIconUrl !== 'undefined' ? orgIconUrl : ''
        };

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
          });
        } else {
          res = await fetch('/api/give', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text, config: configData }),
          });
        }

        const data = await res.json().catch(() => ({}));
        const aiResult = data.ai_result || data.ai_response || data.code;
        const msg = data.message || 'Output generated successfully.';

        let htmlToDisplay = '';
        if (aiResult) {
          if (typeof aiResult === 'object' && aiResult.palettes && aiResult.fonts) {
            // It's the website design choice step
            window.createButtonFunction(aiResult, async (selectedChoices) => {
              // Now that choices are made, call backend again!
              const nextConfig = { ...configData, ...selectedChoices };
              
              submitBtn.disabled = true;
              try {
                // Re-send original request but with updated config
                let followUpRes;
                if (filesToSend.length > 0) {
                  const followUpForm = new FormData();
                  followUpForm.append('text', text);
                  followUpForm.append('config', JSON.stringify(nextConfig));
                  filesToSend.forEach(f => followUpForm.append('files', f));
                  followUpRes = await fetch('/api/give-files', { method: 'POST', body: followUpForm });
                } else {
                  followUpRes = await fetch('/api/give', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ text, config: nextConfig }),
                  });
                }
                
                const followUpData = await followUpRes.json().catch(() => ({}));
                const finalResult = followUpData.ai_result || followUpData.ai_response || '<p>Generated successfully.</p>';
                const chatId = `chat-${Date.now()}`;
                
                displayAiResponse(finalResult, promptText + " (Generated Website)", chatId);
                
                chatSessions.push({
                  id: chatId,
                  prompt: promptText + " (Generated Website)",
                  htmlContent: finalResult,
                });
                if (chatHistoryList) {
                  chatHistoryList.querySelectorAll('.chat-item').forEach((i) => i.classList.remove('active'));
                  const newLi = document.createElement('li');
                  newLi.innerHTML = `
                    <button type="button" class="chat-item active" data-id="${chatId}">
                      <span class="item-title">${promptText.slice(0, 20)}...</span>
                      <span class="active-arrow" aria-hidden="true">&#9668;</span>
                    </button>
                  `;
                  chatHistoryList.prepend(newLi);
                }
              } catch(e) {
                console.error(e);
              } finally {
                submitBtn.disabled = false;
              }
            });
            
            // Clean up inputs so user can type next prompt while deciding
            promptInput.value = '';
            promptInput.style.height = 'auto';
            attachedFiles = [];
            renderAttachedFiles();
            if (fileInput) fileInput.value = '';
            
            return; // Halt here until they choose
          } else if (typeof aiResult === 'string' && (aiResult.includes('```mermaid') || aiResult.trim().startsWith('graph ') || aiResult.trim().startsWith('flowchart '))) {
            const cleanCode = aiResult.replace(/```mermaid/g, '').replace(/```/g, '').trim();
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
          } else if (typeof aiResult === 'string' && (aiResult.includes('<html') || aiResult.includes('<!DOCTYPE') || aiResult.includes('</'))) {
            htmlToDisplay = aiResult;
          } else {
            htmlToDisplay = `
              <!DOCTYPE html><html><body style="background:#110e08;color:#fbf7ee;font-family:sans-serif;padding:24px;">
                <pre style="white-space:pre-wrap;font-size:14px;line-height:1.6;">${typeof aiResult === 'object' ? JSON.stringify(aiResult, null, 2) : aiResult}</pre>
              </body></html>
            `;
          }
        } else if (data.final_output) {
          htmlToDisplay = `
            <!DOCTYPE html><html><body style="background:#110e08;color:#fbf7ee;font-family:sans-serif;padding:24px;">
              <h3 style="color:#e2a221;margin-bottom:12px;">Staged File Content</h3>
              <pre style="white-space:pre-wrap;font-size:13px;line-height:1.5;">${JSON.stringify(data.final_output, null, 2)}</pre>
            </body></html>
          `;
        } else {
          htmlToDisplay = `
            <!DOCTYPE html><html><body style="background:#110e08;color:#fbf7ee;font-family:sans-serif;padding:24px;">
              <p style="font-size:16px;">${msg}</p>
            </body></html>
          `;
        }

        const promptText = text || `Uploaded ${attachedFiles.length} file(s)`;
        const chatId = `chat-${Date.now()}`;
        
        displayAiResponse(htmlToDisplay, promptText, chatId);

        // Add entry to chat history with arrow indicator (◄)
        const chatTitle = text.length > 22 ? text.slice(0, 20) + '...' : promptText;
        chatSessions.push({
          id: chatId,
          prompt: promptText,
          htmlContent: htmlToDisplay,
        });

        if (chatHistoryList) {
          chatHistoryList.querySelectorAll('.chat-item').forEach((i) => i.classList.remove('active'));
          const newLi = document.createElement('li');
          newLi.innerHTML = `
            <button type="button" class="chat-item active" data-id="${chatId}">
              <span class="item-title">${chatTitle}</span>
              <span class="active-arrow" aria-hidden="true">&#9668;</span>
            </button>
          `;
          chatHistoryList.prepend(newLi);
        }

        // Reset inputs
        promptInput.value = '';
        promptInput.style.height = 'auto';
        attachedFiles = [];
        renderAttachedFiles();
        if (fileInput) fileInput.value = '';
      } catch (err) {
        displayAiResponse(`<!DOCTYPE html><html><body style="background:#110e08;color:#e2a221;padding:20px;">Error: ${err.message || 'Failed to process request'}</body></html>`);
      } finally {
        submitBtn.disabled = false;
      }
    });
  }

  // --- Configuration Panel Toggle ---
  if (configToggleBtn && configPanel) {
    configToggleBtn.addEventListener('click', () => {
      const isHidden = configPanel.style.display === 'none';
      configPanel.style.display = isHidden ? 'block' : 'none';
      configToggleBtn.classList.toggle('active', isHidden);
    });
  }

  // --- Dynamic Choice Function for Website Generation ---
  // Expose this globally so backend/iframe logic can trigger it if needed, or we use it here.
  window.createButtonFunction = function (options, callback) {
    if (!aiSelectionArea || !paletteDisplay || !fontDisplay || !confirmSelectionBtn) return;
    
    paletteDisplay.innerHTML = '<h3 style="width: 100%; margin-bottom: 8px;">Select a Color Palette</h3>';
    fontDisplay.innerHTML = '<h3 style="width: 100%; margin-bottom: 8px;">Select Fonts (1 Body, 1 Title)</h3>';
    aiSelectionArea.style.display = 'block';
    iframeWrapper.style.display = 'none';

    let selectedPalette = null;
    let selectedBodyFont = null;
    let selectedTitleFont = null;

    // Palettes
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
          document.querySelectorAll('.palette-btn').forEach(b => b.classList.remove('selected'));
          btn.classList.add('selected');
          selectedPalette = palette;
          checkSelections();
        };
        paletteDisplay.appendChild(btn);
      });
    }

    // Fonts
    if (options.fonts && Array.isArray(options.fonts)) {
      options.fonts.forEach((fontObj) => {
        const isTitle = fontObj.type === 'title';
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `selection-pill font-btn ${isTitle ? 'title-font' : 'body-font'}`;
        btn.innerHTML = `${fontObj.name} (${isTitle ? 'Title' : 'Body'})`;
        btn.style.fontFamily = `'${fontObj.name}', sans-serif`;
        
        btn.onclick = () => {
          document.querySelectorAll(`.${isTitle ? 'title-font' : 'body-font'}`).forEach(b => b.classList.remove('selected'));
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
          titleFont: selectedTitleFont
        });
      }
    };
  };
});
