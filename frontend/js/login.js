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

  const toTitleCase = (str) => {
    if (!str) return '';
    return str
      .toLowerCase()
      .split(' ')
      .map((word) => (word ? word.charAt(0).toUpperCase() + word.slice(1) : ''))
      .join(' ');
  };

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
      authSubtext.textContent = 'A confirmation link has been sent to your email. Please check your inbox and verify your email before logging in.';
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

      const userObj = data.user || data.data?.user || { email, first_name: '' };
      const orgObj = data.organization || data.data?.organization || {
        name: data.organization_name || 'Unincorporated',
        icon: data.organization_icon || data.icon || '',
      };
      const rawOrgName = orgObj.name || data.organization_name || 'Unincorporated';
      const orgName = toTitleCase(rawOrgName);
      const orgIconUrl = orgObj.icon || data.organization_icon || data.icon || data.data?.organization_icon || data.data?.icon || '';

      const username = data.user?.first_name || (data.user?.email || email).split('@')[0] || 'User';
      const authPayload = {
        token: data.access_token,
        email,
        username,
        user: userObj,
        organization: orgObj,
        organizationName: orgName,
        organizationIcon: orgIconUrl,
        remember: rememberInput.checked,
        timestamp: new Date().toISOString(),
      };

      // Store in BOTH localStorage and sessionStorage so all workspace pages have immediate access
      localStorage.setItem('sathyasethu-auth', JSON.stringify(authPayload));
      sessionStorage.setItem('sathyasethu-auth', JSON.stringify(authPayload));

      localStorage.setItem('organizationName', orgName);
      sessionStorage.setItem('organizationName', orgName);
      localStorage.setItem('organization-name', orgName);
      sessionStorage.setItem('organization-name', orgName);

      if (orgIconUrl) {
        localStorage.setItem('organizationIcon', orgIconUrl);
        sessionStorage.setItem('organizationIcon', orgIconUrl);
        localStorage.setItem('organization-icon', orgIconUrl);
        sessionStorage.setItem('organization-icon', orgIconUrl);
      } else {
        localStorage.removeItem('organizationIcon');
        sessionStorage.removeItem('organizationIcon');
        localStorage.removeItem('organization-icon');
        sessionStorage.removeItem('organization-icon');
      }

      localStorage.setItem('username', username);
      sessionStorage.setItem('username', username);

      setStatus(loginStatus, 'Preparing your secure workspace...', 'success');

      window.setTimeout(() => {
        window.location.href = '/dashboard';
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

    if (organization && organization !== 'unincorporated' && !organizationPassword) {
      showError('signupOrganizationPassword', 'Organization Password is required for this organization.');
      formValid = false;
    } else {
      clearFieldError('signupOrganizationPassword');
    }

    if (!formValid) {
      setStatus(signupStatus, 'Please complete the required fields.', 'error');
      return;
    }

    signUpButton.disabled = true;
    signUpButton.classList.add('is-loading');
    signUpButton.querySelector('.button-label').textContent = 'Creating Account...';

    try {
      const finalOrg = organization || 'Unincorporated';
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          first_name: firstName,
          email,
          password,
          organization: finalOrg,
          organization_password: organizationPassword || '',
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        let msg = 'Registration failed.';
        if (typeof data.detail === 'string') {
          msg = data.detail;
        } else if (Array.isArray(data.detail) && data.detail.length > 0) {
          msg = data.detail.map((err) => err.msg || err.message || JSON.stringify(err)).join(', ');
        } else if (data.message) {
          msg = data.message;
        }
        throw new Error(msg);
      }

      // Check if email confirmation is required or token is not immediately issued
      if (data.requires_confirmation || !data.access_token) {
        setConfirmationState(email);
        signUpButton.disabled = false;
        signUpButton.classList.remove('is-loading');
        signUpButton.querySelector('.button-label').textContent = 'Sign Up';
        return;
      }

      // Direct login: store authentication state and redirect immediately if session token was returned
      const userObj = data.user || data.data?.user || { email, first_name: firstName };
      const orgObj = data.organization || data.data?.organization || {
        name: data.organization_name || finalOrg,
        icon: data.organization_icon || data.icon || '',
      };
      const rawOrgName = orgObj.name || data.organization_name || finalOrg;
      const orgName = toTitleCase(rawOrgName);
      const orgIconUrl = orgObj.icon || data.organization_icon || data.icon || data.data?.organization_icon || data.data?.icon || '';
      const token = data.access_token || data.data?.access_token || 'active_session';

      const authPayload = {
        token,
        email,
        username: firstName || userObj.first_name || email.split('@')[0],
        user: userObj,
        organization: orgObj,
        organizationName: orgName,
        organizationIcon: orgIconUrl,
        remember: true,
        timestamp: new Date().toISOString(),
      };

      localStorage.setItem('sathyasethu-auth', JSON.stringify(authPayload));
      sessionStorage.setItem('sathyasethu-auth', JSON.stringify(authPayload));

      localStorage.setItem('organizationName', orgName);
      sessionStorage.setItem('organizationName', orgName);
      localStorage.setItem('organization-name', orgName);
      sessionStorage.setItem('organization-name', orgName);

      if (orgIconUrl) {
        localStorage.setItem('organizationIcon', orgIconUrl);
        sessionStorage.setItem('organizationIcon', orgIconUrl);
        localStorage.setItem('organization-icon', orgIconUrl);
        sessionStorage.setItem('organization-icon', orgIconUrl);
      } else {
        localStorage.removeItem('organizationIcon');
        sessionStorage.removeItem('organizationIcon');
        localStorage.removeItem('organization-icon');
        sessionStorage.removeItem('organization-icon');
      }

      localStorage.setItem('username', authPayload.username);
      sessionStorage.setItem('username', authPayload.username);

      setStatus(signupStatus, 'Account created! Redirecting to workspace...', 'success');

      window.setTimeout(() => {
        window.location.href = '/dashboard';
      }, 400);
    } catch (error) {
      setStatus(signupStatus, error.message || 'Registration failed.', 'error');
      signUpButton.disabled = false;
      signUpButton.classList.remove('is-loading');
      signUpButton.querySelector('.button-label').textContent = 'Sign Up';
    }
  });

  resendEmailButton.addEventListener('click', async () => {
    const email = signupEmailValue || 'your@email.com';
    resendEmailButton.disabled = true;
    resendEmailButton.classList.add('is-loading');
    resendEmailButton.textContent = 'Resending...';
    try {
      const resp = await fetch('/api/auth/resend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        throw new Error(data.detail || data.message || 'Could not resend email.');
      }
      setStatus(confirmationStatus, `A confirmation notification has been sent to ${email}.`, 'success');
    } catch (err) {
      setStatus(confirmationStatus, err.message || 'Could not resend confirmation email.', 'error');
    } finally {
      resendEmailButton.disabled = false;
      resendEmailButton.classList.remove('is-loading');
      resendEmailButton.textContent = 'Resend email';
    }
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
