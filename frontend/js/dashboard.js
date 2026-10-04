document.addEventListener('DOMContentLoaded', () => {
  // Retrieve saved authentication if present (login check disabled for preview)
  const authPayload = localStorage.getItem('sathyasethu-auth') || sessionStorage.getItem('sathyasethu-auth');
  let parsedAuth = null;
  if (authPayload) {
    try {
      parsedAuth = JSON.parse(authPayload);
    } catch (e) {
      console.warn('Could not parse auth payload:', e);
    }
  }

  // 1. Dynamic Greeting based on time
  const greetingTimeWord = document.getElementById('greetingTimeWord');
  const greetingUserName = document.getElementById('greetingUserName');
  const now = new Date();
  const currentHour = now.getHours();

  let timeWord = 'Good Morning';
  if (currentHour >= 12 && currentHour < 17) {
    timeWord = 'Good Afternoon';
  } else if (currentHour >= 17 || currentHour < 5) {
    timeWord = 'Good Evening';
  }

  if (greetingTimeWord) {
    greetingTimeWord.textContent = timeWord;
  }

  // Extract user name without using 'Alex' placeholder
  const rawUsername = parsedAuth?.username || parsedAuth?.name || localStorage.getItem('username') || (parsedAuth?.email ? parsedAuth.email.split('@')[0] : '');
  const username = (rawUsername || '').trim();
  if (greetingUserName) {
    greetingUserName.textContent = username ? username : '';
  }

  // 2. Corner Clock (e.g., 8:23 AM)
  const cornerClock = document.getElementById('cornerClock');
  function updateClock() {
    if (!cornerClock) return;
    const d = new Date();
    let hours = d.getHours();
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    cornerClock.textContent = `${hours}:${minutes} ${ampm}`;
  }
  updateClock();
  setInterval(updateClock, 1000);

  // 3. Organization Info from Local Storage or Session Storage
  const orgName = localStorage.getItem('organizationName') ||
                  sessionStorage.getItem('organizationName') ||
                  localStorage.getItem('organization-name') ||
                  sessionStorage.getItem('organization-name') ||
                  parsedAuth?.organizationName ||
                  parsedAuth?.organization?.name ||
                  (typeof parsedAuth?.organization === 'string' ? parsedAuth.organization : null) ||
                  'Unincorporated';

  const orgIconUrl = localStorage.getItem('organizationIcon') ||
                     sessionStorage.getItem('organizationIcon') ||
                     localStorage.getItem('organization-icon') ||
                     sessionStorage.getItem('organization-icon') ||
                     parsedAuth?.organizationIcon ||
                     parsedAuth?.organization?.icon ||
                     parsedAuth?.icon ||
                     '';

  function toTitleCase(str) {
    if (!str) return '';
    return str
      .toLowerCase()
      .split(' ')
      .map((word) => (word ? word.charAt(0).toUpperCase() + word.slice(1) : ''))
      .join(' ');
  }

  const orgNameText = document.getElementById('orgNameText');
  if (orgNameText) {
    orgNameText.textContent = toTitleCase(orgName);
  }

  const orgLogoImg = document.getElementById('orgLogoImg');
  const orgLogoPlaceholder = document.getElementById('orgLogoPlaceholder');

  if (orgIconUrl && orgLogoImg) {
    orgLogoImg.src = orgIconUrl;
    orgLogoImg.style.display = 'block';
    if (orgLogoPlaceholder) orgLogoPlaceholder.style.display = 'none';

    orgLogoImg.onerror = () => {
      orgLogoImg.style.display = 'none';
      if (orgLogoPlaceholder) orgLogoPlaceholder.style.display = 'flex';
    };
  } else {
    if (orgLogoImg) orgLogoImg.style.display = 'none';
    if (orgLogoPlaceholder) orgLogoPlaceholder.style.display = 'flex';
  }

  // 4. Projects: Left empty for now (except for the plus card in HTML)
  // If projects are stored later in localStorage under 'projects', render them before the plus card
  const projectsGrid = document.getElementById('projectsGrid');
  const addProjectCard = projectsGrid?.querySelector('.add-project-card');

  try {
    const savedProjects = JSON.parse(localStorage.getItem('projects') || '[]');
    if (Array.isArray(savedProjects) && savedProjects.length > 0 && projectsGrid && addProjectCard) {
      savedProjects.forEach(proj => {
        const card = document.createElement('a');
        card.href = proj.url || '/prompt.html';
        card.className = 'bento-card project-item-card';
        card.innerHTML = `<span class="project-item-name">${proj.name || 'AI Project'}</span>`;
        projectsGrid.insertBefore(card, addProjectCard);
      });
    }
  } catch (err) {
    console.warn('Error reading projects:', err);
  }
});
