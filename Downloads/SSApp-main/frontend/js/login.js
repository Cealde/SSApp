document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('loginForm');
  const signupForm = document.getElementById('signupForm');
  const confirmationState = document.getElementById('confirmationState');
  const authHeading = document.getElementById('authHeading');
  const authSubtext = document.getElementById('authSubtext');
  const footerPrompt = document.getElementById('footerPrompt');
  const toggleModeButton = document.getElementById('toggleModeButton');
  const rememberInput = document.getElementById('rememberMe');
  const signInButton = document.getElementById('signInButton');
  const signUpButton = document.getElementById('signUpButton');
  const loginStatus = document.getElementById('loginStatus');
  const signupStatus = document.getElementById('signupStatus');
  const confirmationEmail = document.getElementById('confirmationEmail');
  const confirmationStatus = document.getElementById('confirmationStatus');
  const resendEmailButton = document.getElementById('resendEmailButton');
  const openEmailButton = document.getElementById('openEmailButton');
  const goToLoginButton = document.getElementById('goToLoginButton');
  const passwordToggles = document.querySelectorAll('[data-password-toggle]');

  let currentMode = window.location.hash === '#signup' ? 'signup' : 'login';
  let signupEmailValue = '';

  const clearStatus = (node) => {
    if (!node) return;
    node.textContent = '';
    node.classList.remove('success', 'error');
  };

  const setStatus = (node, text, type = '') => {
    if (!node) return;
    node.textContent = text;
    node.classList.remove('success', 'error');
    if (type) {
      node.classList.add(type);
    }
  };

  const showError = (fieldId, message) => {
    const field = document.getElementById(fieldId);
    const errorNode = document.getElementById(`${fieldId}Error`);
    if (!field) return;

    if (errorNode) {
      errorNode.textContent = message;
    }
    field.setAttribute('aria-invalid', message ? 'true' : 'false');
  };

  const clearFieldError = (fieldId) => {
    showError(fieldId, '');
  };

  const setMode = (mode) => {
    currentMode = mode;
    const isLogin = mode === 'login';

    loginForm.classList.toggle('hidden', !isLogin);
    signupForm.classList.toggle('hidden', isLogin);
    confirmationState.classList.toggle('hidden', true);

    authHeading.textContent = isLogin ? 'Log in to your workspace' : 'Create your account';
    authSubtext.textContent = isLogin
      ? 'Access your files, ideas, and workflows in one focused environment.'
      : 'Set up your workspace and start collaborating with confidence.';
    footerPrompt.textContent = isLogin ? "Don't have an account?" : 'Already have an account?';
    toggleModeButton.textContent = isLogin ? 'Sign Up' : 'Log In';

    clearStatus(loginStatus);
    clearStatus(signupStatus);
    clearStatus(confirmationStatus);

    if (isLogin) {
      window.location.hash = 'login';
    } else {
      window.location.hash = 'signup';
    }
  };

  const setConfirmationState = (email) => {
    signupEmailValue = email;
    confirmationEmail.textContent = email;
    loginForm.classList.add('hidden');
    signupForm.classList.add('hidden');
    confirmationState.classList.remove('hidden');
    authHeading.textContent = 'Check your email';
    authSubtext.textContent = 'We’ve sent a confirmation link to your inbox.';
    footerPrompt.textContent = 'Need another step?';
    toggleModeButton.textContent = 'Go to Login';
    clearStatus(confirmationStatus);
    window.location.hash = 'confirm';
  };

  const validateEmail = (value, fieldId, label) => {
    const trimmed = value.trim();
    if (!trimmed) {
      showError(fieldId, `${label} is required.`);
      return false;
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(trimmed)) {
      showError(fieldId, 'Please enter a valid email address.');
      return false;
    }

    clearFieldError(fieldId);
    return true;
  };

  const validatePassword = (value, fieldId, label, minLength = 6) => {
    if (!value.trim()) {
      showError(fieldId, `${label} is required.`);
      return false;
    }

    if (value.length < minLength) {
      showError(fieldId, `${label} must be at least ${minLength} characters.`);
      return false;
    }

    clearFieldError(fieldId);
    return true;
  };

  const validateOrganization = (value, fieldId) => {
    if (!value.trim()) {
      showError(fieldId, 'Organization is required.');
      return false;
    }
    clearFieldError(fieldId);
    return true;
  };

  passwordToggles.forEach((toggle) => {
    toggle.addEventListener('click', () => {
      const targetId = toggle.dataset.passwordToggle;
      const targetInput = document.getElementById(targetId);
      if (!targetInput) return;

      const isPassword = targetInput.type === 'password';
      targetInput.type = isPassword ? 'text' : 'password';
      toggle.textContent = isPassword ? 'Hide' : 'Show';
      toggle.setAttribute('aria-label', isPassword ? 'Hide password' : 'Show password');
      targetInput.focus();
    });
  });

  loginForm.addEventListener('submit', (event) => {
    event.preventDefault();
    clearStatus(loginStatus);
    clearFieldError('loginEmail');
    clearFieldError('loginPassword');

    const emailValid = validateEmail(document.getElementById('loginEmail').value, 'loginEmail', 'Email');
    const passwordValid = validatePassword(document.getElementById('loginPassword').value, 'loginPassword', 'Password', 6);

    if (!emailValid || !passwordValid) {
      setStatus(loginStatus, 'Please correct the highlighted fields.', 'error');
      return;
    }

    signInButton.disabled = true;
    signInButton.classList.add('is-loading');
    signInButton.querySelector('.button-label').textContent = 'Logging In';

    const email = document.getElementById('loginEmail').value.trim();
    const username = email.split('@')[0] || 'SathyaSethu User';
    const authPayload = {
      email,
      username,
      remember: rememberInput.checked,
      timestamp: new Date().toISOString(),
    };

    if (rememberInput.checked) {
      localStorage.setItem('sathyasethu-auth', JSON.stringify(authPayload));
    } else {
      sessionStorage.setItem('sathyasethu-auth', JSON.stringify(authPayload));
    }

    setStatus(loginStatus, 'Preparing your secure workspace...', 'success');

    window.setTimeout(() => {
      window.location.href = '/loading';
    }, 350);
  });

  signupForm.addEventListener('submit', (event) => {
    event.preventDefault();
    clearStatus(signupStatus);
    clearFieldError('signupEmail');
    clearFieldError('signupPassword');
    clearFieldError('organization');
    clearFieldError('organizationPassword');

    const emailValid = validateEmail(document.getElementById('signupEmail').value, 'signupEmail', 'Email');
    const passwordValid = validatePassword(document.getElementById('signupPassword').value, 'signupPassword', 'Password', 8);
    const orgValid = validateOrganization(document.getElementById('organization').value, 'organization');
    const orgPasswordValid = validatePassword(document.getElementById('organizationPassword').value, 'organizationPassword', 'Organization Password', 6);

    if (!emailValid || !passwordValid || !orgValid || !orgPasswordValid) {
      setStatus(signupStatus, 'Please complete all required fields.', 'error');
      return;
    }

    signUpButton.disabled = true;
    signUpButton.classList.add('is-loading');
    signUpButton.querySelector('.button-label').textContent = 'Creating Account';

    const email = document.getElementById('signupEmail').value.trim();
    setConfirmationState(email);
  });

  resendEmailButton.addEventListener('click', () => {
    const email = signupEmailValue || 'your@email.com';
    resendEmailButton.disabled = true;
    resendEmailButton.classList.add('is-loading');
    resendEmailButton.textContent = 'Resending...';
    setStatus(confirmationStatus, `A new confirmation email has been sent to ${email}.`, 'success');

    window.setTimeout(() => {
      resendEmailButton.disabled = false;
      resendEmailButton.classList.remove('is-loading');
      resendEmailButton.textContent = 'Resend email';
    }, 1200);
  });

  openEmailButton.addEventListener('click', () => {
    const email = signupEmailValue || 'your@email.com';
    window.location.href = `mailto:${email}`;
  });

  goToLoginButton.addEventListener('click', () => {
    setMode('login');
  });

  toggleModeButton.addEventListener('click', () => {
    setMode(currentMode === 'login' ? 'signup' : 'login');
  });

  document.addEventListener('keydown', (event) => {
    const active = document.activeElement;
    if (event.key === 'Enter' && active && (active.id === 'loginPassword' || active.id === 'signupPassword' || active.id === 'organizationPassword')) {
      const activeForm = active.closest('form');
      if (activeForm) {
        activeForm.requestSubmit();
      }
    }
  });

  setMode(currentMode);
});

