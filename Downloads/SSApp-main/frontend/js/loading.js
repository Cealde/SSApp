document.addEventListener('DOMContentLoaded', () => {
  const savedAuth = localStorage.getItem('sathyasethu-auth') || sessionStorage.getItem('sathyasethu-auth');

  if (!savedAuth) {
    window.location.href = '/login';
    return;
  }

  window.setTimeout(() => {
    window.location.href = '/dashboard';
  }, 1600);
});
