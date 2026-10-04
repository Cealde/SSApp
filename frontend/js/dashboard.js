document.addEventListener('DOMContentLoaded', () => {
  const authPayload = localStorage.getItem('sathyasethu-auth') || sessionStorage.getItem('sathyasethu-auth');

  if (!authPayload) {
    window.location.href = '/login';
    return;
  }

  try {
    const parsedAuth = JSON.parse(authPayload);
    const currentName = document.getElementById('currentUserName');
    const heroName = document.getElementById('hero-name');
    const profileName = document.getElementById('profile-name');
    const username = (parsedAuth.username || parsedAuth.email?.split('@')[0] || 'SathyaSethu User').trim();

    if (currentName) currentName.textContent = username;
    if (heroName) heroName.textContent = username;
    if (profileName) profileName.textContent = username;
  } catch (error) {
    console.error('Invalid auth payload:', error);
  }

  const form = document.getElementById('user-form');
  const input = document.getElementById('text-input');
  const output = document.getElementById('output');
  const fileInput = document.getElementById('file-input');
  const submitButton = form?.querySelector('.submit-button');
  const mobileMenuButton = document.querySelector('.mobile-menu');
  const nav = document.querySelector('.main-nav');
  const toastContainer = document.querySelector('.toast-container');

  const showToast = (message, variant = 'success') => {
    if (!toastContainer) return;

    const toast = document.createElement('div');
    toast.className = `toast ${variant}`;
    toast.textContent = message;
    toastContainer.appendChild(toast);

    window.setTimeout(() => {
      toast.remove();
    }, 2600);
  };

  const setLoadingState = (isLoading) => {
    if (!submitButton) return;
    submitButton.disabled = isLoading;
    submitButton.classList.toggle('is-loading', isLoading);
    submitButton.textContent = isLoading ? 'Running...' : 'Run workflow';
  };

  if (mobileMenuButton && nav) {
    mobileMenuButton.addEventListener('click', () => {
      nav.classList.toggle('is-open');
    });
  }

  if (fileInput) {
    fileInput.addEventListener('change', () => {
      const fileName = fileInput.files?.[0]?.name ?? 'No file selected';
      const pickerLabel = fileInput.closest('.file-picker')?.querySelector('span');

      if (pickerLabel) {
        pickerLabel.textContent = fileName.length > 28 ? `${fileName.slice(0, 25)}...` : fileName;
      }
    });
  }

  if (form) {
    form.addEventListener('submit', async (event) => {
      event.preventDefault();

      const text = input ? input.value.trim() : '';

      if (!text) {
        if (output) {
          output.textContent = 'Please enter some text before submitting.';
          output.classList.add('error');
          output.classList.remove('success');
        }
        showToast('Please enter some text.', 'error');
        return;
      }

      setLoadingState(true);
      if (output) {
        output.textContent = 'Sending request to SathyaSethu backend...';
        output.classList.remove('error', 'success');
      }

      try {
        const response = await fetch('/api/give', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ text }),
        });

        const data = await response.json().catch(() => ({ message: 'Request processed successfully.' }));

        if (!response.ok) {
          throw new Error(data.detail || 'The service was unable to process the request.');
        }

        if (output) {
          output.textContent = data.message || 'Request processed successfully.';
          output.classList.add('success');
          output.classList.remove('error');
        }
        showToast('Request completed successfully.', 'success');
        form.reset();

        if (fileInput) {
          const pickerLabel = fileInput.closest('.file-picker')?.querySelector('span');
          if (pickerLabel) {
            pickerLabel.textContent = 'Attach file';
          }
        }
      } catch (error) {
        if (output) {
          output.textContent = 'Unable to reach the backend server. Please try again.';
          output.classList.add('error');
          output.classList.remove('success');
        }
        showToast(error.message || 'Request failed.', 'error');
        console.error('SathyaSethu request error:', error);
      } finally {
        setLoadingState(false);
      }
    });
  }
});
