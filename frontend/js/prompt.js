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

  // Function to show iframe directly without response box
  function displayAiResponse(htmlContent) {
    if (iframeWrapper) {
      iframeWrapper.style.display = 'block';
    }
    if (contentIframe) {
      contentIframe.srcdoc = htmlContent;
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
        if (userMessageRow && userMessageText) {
          userMessageText.textContent = targetSession.prompt;
          userMessageRow.style.display = 'flex';
        }
        displayAiResponse(targetSession.htmlContent);
      }
    });
  }

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

      // Display user message bubble
      if (userMessageRow && userMessageText) {
        userMessageText.textContent = text || `Uploaded ${attachedFiles.length} file(s)`;
        userMessageRow.style.display = 'flex';
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
        const msg = data.message || 'Output generated successfully.';

        let htmlToDisplay = '';
        if (aiResult) {
          if (typeof aiResult === 'string' && (aiResult.includes('<html') || aiResult.includes('<!DOCTYPE') || aiResult.includes('</'))) {
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

        displayAiResponse(htmlToDisplay);

        // Add entry to chat history with arrow indicator (◄)
        const chatTitle = text.length > 22 ? text.slice(0, 20) + '...' : (text || (attachedFiles[0]?.name ?? 'Untitled Prompt'));
        const chatId = `chat-${Date.now()}`;
        chatSessions.push({
          id: chatId,
          prompt: text || `Uploaded ${attachedFiles.length} file(s)`,
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
});
