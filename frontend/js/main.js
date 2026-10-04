/**
 * SATYASETHU - 3-SCREEN WORKSPACE JAVASCRIPT CONTROLLER
 * Flow:
 * Screen 1 (Sign-Up) -> Screen 2 (Projects Dashboard) -> Screen 3 (Main Workspace with Top Navbar)
 * - Navigation links in top navbar navigate between Overview (Dashboard) & Workspace.
 * - Dynamic username, organization, live clock, and prompt stream.
 * - Password Show / Hide toggle inside input fields.
 */

document.addEventListener('DOMContentLoaded', () => {
  // Screens
  const screens = {
    signup: document.getElementById('screen-signup'),
    projects: document.getElementById('screen-projects-dashboard'),
    workspace: document.getElementById('screen-workspace'),
  };

  // Screen 1: Sign-Up Elements
  const signupForm = document.getElementById('signup-form');
  const inputEmail = document.getElementById('input-email');
  const inputOrg = document.getElementById('input-org');

  // Screen 2: Projects Dashboard Elements
  const usernameText = document.getElementById('username-text');
  const orgCardName = document.getElementById('org-card-name');
  const liveTimeDisplay = document.getElementById('live-time-display');
  const btnCreateNewProject = document.getElementById('btn-create-new-project');
  const btnGridCreateCard = document.getElementById('btn-grid-create-card');
  const projectCards = document.querySelectorAll('.project-item-card');

  // Screen 3: Main Workspace Navbar Elements
  const navBrandHome = document.getElementById('nav-brand-home');
  const navLinkOverview = document.getElementById('nav-link-overview');
  const navLinkWorkspace = document.getElementById('nav-link-workspace');
  const navLinkActivity = document.getElementById('nav-link-activity');
  const navLinkHelp = document.getElementById('nav-link-help');
  const navUserName = document.getElementById('nav-user-name');
  const navUserInitial = document.getElementById('nav-user-initial');
  const btnNavbarProfile = document.getElementById('btn-navbar-profile');

  // Screen 3: Workspace 3-Column Elements
  const previewOrgNameText = document.getElementById('preview-org-name-text');
  const navButtons = document.querySelectorAll('.nav-link-btn');
  const toolboxPills = document.querySelectorAll('.toolbox-pill');
  const chatFeedStream = document.getElementById('chat-feed-stream');
  const workspacePinnedForm = document.getElementById('workspace-pinned-form');
  const workspaceQueryInput = document.getElementById('workspace-query-input');

  // ==========================================================================
  // Micro-detail: Password Show / Hide Toggle
  // ==========================================================================
  const toggleButtons = document.querySelectorAll('.password-toggle-btn');
  toggleButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const targetId = btn.dataset.target;
      const targetInput = document.getElementById(targetId);
      const textSpan = btn.querySelector('.toggle-text');
      const eyeIcon = btn.querySelector('.eye-icon');

      if (!targetInput) return;

      if (targetInput.type === 'password') {
        targetInput.type = 'text';
        if (textSpan) textSpan.textContent = 'Hide';
        if (eyeIcon) {
          eyeIcon.innerHTML = `
            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
            <line x1="1" y1="1" x2="23" y2="23"></line>
          `;
        }
      } else {
        targetInput.type = 'password';
        if (textSpan) textSpan.textContent = 'Show';
        if (eyeIcon) {
          eyeIcon.innerHTML = `
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
            <circle cx="12" cy="12" r="3"></circle>
          `;
        }
      }
    });
  });

  // ==========================================================================
  // Screen Transition Controller
  // ==========================================================================
  function navigateTo(targetKey) {
    Object.keys(screens).forEach((key) => {
      const el = screens[key];
      if (el) {
        if (key === targetKey) {
          el.classList.add('active');
        } else {
          el.classList.remove('active');
        }
      }
    });

    if (targetKey === 'workspace' && navLinkWorkspace && navLinkOverview) {
      navLinkWorkspace.classList.add('active');
      navLinkOverview.classList.remove('active');
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ==========================================================================
  // Live Clock Updater (Screen 2)
  // ==========================================================================
  function updateClock() {
    if (!liveTimeDisplay) return;
    const now = new Date();
    let hours = now.getHours();
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    liveTimeDisplay.textContent = `${hours}:${minutes} ${ampm}`;
  }
  updateClock();
  setInterval(updateClock, 1000);

  // ==========================================================================
  // Screen 1 -> Screen 2: Sign-Up Form Submission
  // ==========================================================================
  if (signupForm) {
    signupForm.addEventListener('submit', (e) => {
      e.preventDefault();

      // Extract username from email
      const rawEmail = inputEmail.value.trim();
      let displayName = 'User';
      if (rawEmail) {
        const usernamePart = rawEmail.split('@')[0];
        displayName = usernamePart.charAt(0).toUpperCase() + usernamePart.slice(1);
      }

      // Extract organization
      const rawOrg = inputOrg.value.trim() || 'Organization Name';
      const initial = displayName.charAt(0).toUpperCase() || 'U';

      // Update Screen 2 & 3 with details
      if (usernameText) usernameText.textContent = displayName;
      if (orgCardName) orgCardName.textContent = rawOrg;
      if (previewOrgNameText) previewOrgNameText.textContent = rawOrg;
      if (navUserName) navUserName.textContent = displayName;
      if (navUserInitial) navUserInitial.textContent = initial;

      // Navigate to Screen 2: Projects Dashboard
      navigateTo('projects');
    });
  }

  // ==========================================================================
  // Screen 2 -> Screen 3: Project Selection / Creation
  // ==========================================================================
  if (btnCreateNewProject) {
    btnCreateNewProject.addEventListener('click', () => {
      navigateTo('workspace');
    });
  }

  if (btnGridCreateCard) {
    btnGridCreateCard.addEventListener('click', () => {
      navigateTo('workspace');
    });
  }

  projectCards.forEach((card) => {
    card.addEventListener('click', () => {
      navigateTo('workspace');
    });
  });

  // ==========================================================================
  // Screen 3: Top Navigation Bar Actions
  // ==========================================================================
  if (navBrandHome) {
    navBrandHome.addEventListener('click', () => {
      navigateTo('projects');
    });
  }

  if (navLinkOverview) {
    navLinkOverview.addEventListener('click', () => {
      navigateTo('projects');
    });
  }

  if (navLinkWorkspace) {
    navLinkWorkspace.addEventListener('click', () => {
      navigateTo('workspace');
    });
  }

  [navLinkActivity, navLinkHelp].forEach((btn) => {
    if (btn) {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.nav-inline-item-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
      });
    }
  });

  if (btnNavbarProfile) {
    btnNavbarProfile.addEventListener('click', () => {
      if (confirm('Do you want to sign out and return to the Sign-Up screen?')) {
        navigateTo('signup');
      }
    });
  }

  // ==========================================================================
  // Screen 3: Left Sidebar Navigation Module Selection
  // ==========================================================================
  navButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      navButtons.forEach((b) => {
        b.classList.remove('active-news');
        b.classList.remove('active');
        const dot = b.querySelector('.active-indicator-dot');
        if (dot) dot.remove();
      });

      btn.classList.add('active-news');
      if (!btn.querySelector('.active-indicator-dot')) {
        const dot = document.createElement('span');
        dot.className = 'active-indicator-dot';
        btn.appendChild(dot);
      }
    });
  });

  // ==========================================================================
  // Screen 3: Right Sidebar Toolbox Actions
  // ==========================================================================
  toolboxPills.forEach((pill) => {
    pill.addEventListener('click', () => {
      const tool = pill.dataset.tool;
      if (workspaceQueryInput) {
        workspaceQueryInput.value = `Generate ${tool} for `;
        workspaceQueryInput.focus();
      }
    });
  });

  // ==========================================================================
  // Screen 3: Center Workspace Chat & Input Form
  // ==========================================================================
  if (workspacePinnedForm && workspaceQueryInput && chatFeedStream) {
    workspacePinnedForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const prompt = workspaceQueryInput.value.trim();
      if (!prompt) return;

      const userBubble = document.createElement('div');
      userBubble.className = 'chat-row-user';
      userBubble.innerHTML = `
        <div class="chat-bubble-user">
          ${escapeHtml(prompt)}
        </div>
      `;
      chatFeedStream.appendChild(userBubble);
      workspaceQueryInput.value = '';
      chatFeedStream.scrollTop = chatFeedStream.scrollHeight;

      setTimeout(() => {
        const systemResponse = document.createElement('div');
        systemResponse.className = 'chat-row-system';
        systemResponse.innerHTML = `
          <div class="system-badge-meta">
            <span class="badge-ss-engine">SS ENGINE</span>
          </div>
          <p class="system-text-line">
            Processing directive: "<strong>${escapeHtml(prompt)}</strong>". Generating requested content according to your color palette and typography choices.
          </p>
        `;
        chatFeedStream.appendChild(systemResponse);
        chatFeedStream.scrollTop = chatFeedStream.scrollHeight;
      }, 500);
    });
  }

  function escapeHtml(str) {
    const p = document.createElement('p');
    p.textContent = str;
    return p.innerHTML;
  }

  // Initial screen: Sign Up
  navigateTo('signup');
});
