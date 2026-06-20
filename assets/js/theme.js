// theme.js — System theme detection + manual override

const THEME_KEY = 'open-iptv-theme';

// Determine the initial theme:
function getInitialTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  if (saved === 'dark' || saved === 'light') return saved;
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

// Apply theme to <html> element
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
}

// Toggle between dark and light, persist choice
function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'dark';
  const next = current === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  localStorage.setItem(THEME_KEY, next);
  return next;
}

// Init: apply theme immediately (before paint) to avoid flash
function initTheme() {
  const theme = getInitialTheme();
  applyTheme(theme);

  // Listen for OS preference changes (only when user hasn't manually set)
  window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', (e) => {
    const saved = localStorage.getItem(THEME_KEY);
    if (!saved) {
      applyTheme(e.matches ? 'light' : 'dark');
    }
  });

  return theme;
}

export { initTheme, toggleTheme, applyTheme, getInitialTheme };
