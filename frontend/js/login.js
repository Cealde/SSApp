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

    authHeading.textContent = isLogin ? 'Login' : 'Create an Account';
    if (authSubtext) {
      authSubtext.textContent = '';
    }
    footerPrompt.textContent = isLogin ? "Don't have an account?" : 'Have an account?';
    toggleModeButton.textContent = isLogin ? 'Sign Up' : 'Login';

    clearStatus(loginStatus);
    clearStatus(signupStatus);
    clearStatus(confirmationStatus);
    clearFieldError('loginEmail');
    clearFieldError('loginPassword');
    clearFieldError('signupFirstName');
    clearFieldError('signupEmail');
    clearFieldError('signupPassword');
    clearFieldError('signupOrganization');
    clearFieldError('signupOrganizationPassword');

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
    if (authSubtext) {
      authSubtext.textContent = 'Account registered! You can now log in to your workspace.';
    }
    footerPrompt.textContent = 'Ready to continue?';
    toggleModeButton.textContent = 'Login';
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

  loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearStatus(loginStatus);
    clearFieldError('loginEmail');
    clearFieldError('loginPassword');

    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;

    const emailValid = validateEmail(email, 'loginEmail', 'Email');
    const passwordValid = validatePassword(password, 'loginPassword', 'Password', 6);

    if (!emailValid || !passwordValid) {
      setStatus(loginStatus, 'Please correct the highlighted fields.', 'error');
      return;
    }

    signInButton.disabled = true;
    signInButton.classList.add('is-loading');
    signInButton.querySelector('.button-label').textContent = 'Logging In...';

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.detail || data.message || 'Invalid credentials or login failed.');
      }

      const username = (data.user?.email || email).split('@')[0] || 'User';
      const authPayload = {
        token: data.access_token,
        email,
        username,
        user: data.user,
        organization: data.organization || {},
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
    } catch (error) {
      setStatus(loginStatus, error.message || 'Login failed.', 'error');
      signInButton.disabled = false;
      signInButton.classList.remove('is-loading');
      signInButton.querySelector('.button-label').textContent = 'Log In';
    }
  });

  signupForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearStatus(signupStatus);
    clearFieldError('signupFirstName');
    clearFieldError('signupEmail');
    clearFieldError('signupPassword');
    clearFieldError('signupOrganization');
    clearFieldError('signupOrganizationPassword');

    const firstName = document.getElementById('signupFirstName')?.value.trim() || '';
    const email = document.getElementById('signupEmail').value.trim();
    const password = document.getElementById('signupPassword').value;
    let organization = document.getElementById('signupOrganization')?.value.trim().toLowerCase() || '';
    const organizationPassword = document.getElementById('signupOrganizationPassword')?.value || '';

    let formValid = true;

    if (!firstName) {
      showError('signupFirstName', 'First Name is required.');
      formValid = false;
    } else {
      clearFieldError('signupFirstName');
    }

    if (!validateEmail(email, 'signupEmail', 'Email')) {
      formValid = false;
    }

    if (!validatePassword(password, 'signupPassword', 'Password', 6)) {
      formValid = false;
    }

    if (!organization) {
      showError('signupOrganization', 'Organization Name is required.');
      formValid = false;
    } else {
      clearFieldError('signupOrganization');
    }

    if (!organizationPassword) {
      showError('signupOrganizationPassword', 'Organization Password is required.');
      formValid = false;
    } else {
      clearFieldError('signupOrganizationPassword');
    }

    if (!formValid) {
      setStatus(signupStatus, 'Please complete all required fields.', 'error');
      return;
    }

    signUpButton.disabled = true;
    signUpButton.classList.add('is-loading');
    signUpButton.querySelector('.button-label').textContent = 'Creating Account...';

    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ first_name: firstName, email, password, organization, organization_password: organizationPassword }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.detail || data.message || 'Registration failed.');
      }

      setConfirmationState(email);
    } catch (error) {
      setStatus(signupStatus, error.message || 'Registration failed.', 'error');
      signUpButton.disabled = false;
      signUpButton.classList.remove('is-loading');
      signUpButton.querySelector('.button-label').textContent = 'Sign Up';
    }
  });

  resendEmailButton.addEventListener('click', () => {
    const email = signupEmailValue || 'your@email.com';
    resendEmailButton.disabled = true;
    resendEmailButton.classList.add('is-loading');
    resendEmailButton.textContent = 'Resending...';
    setStatus(confirmationStatus, `A confirmation notification has been sent to ${email}.`, 'success');

    window.setTimeout(() => {
      resendEmailButton.disabled = false;
      resendEmailButton.classList.remove('is-loading');
      resendEmailButton.textContent = 'Resend email';
    }, 1200);
  });

  if (openEmailButton) {
    openEmailButton.addEventListener('click', () => {
      const email = signupEmailValue || 'your@email.com';
      window.location.href = `mailto:${email}`;
    });
  }

  goToLoginButton.addEventListener('click', () => {
    setMode('login');
  });

  toggleModeButton.addEventListener('click', () => {
    setMode(currentMode === 'login' ? 'signup' : 'login');
  });

  document.addEventListener('keydown', (event) => {
    const active = document.activeElement;
    if (event.key === 'Enter' && active && (active.id === 'loginPassword' || active.id === 'signupPassword')) {
      const activeForm = active.closest('form');
      if (activeForm) {
        activeForm.requestSubmit();
      }
    }
  });

  setMode(currentMode);
});
