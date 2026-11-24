// Runs before first paint (a classic, blocking script in <head>). Kept out of index.html so the production
// Content-Security-Policy can be `script-src 'self'` with no inline scripts allowed.

// Apply the stored/OS color scheme so dark mode does not flash white.
(() => {
  try {
    const s = localStorage.getItem('mantine-color-scheme-value');
    const dark = s ? s === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.setAttribute('data-mantine-color-scheme', dark ? 'dark' : 'light');
  } catch (_e) {}
})();

// Local development (localhost / 127.0.0.1 / [::1] / *.localhost) gets a "DEV" title and an amber favicon,
// so it is easy to tell apart from the real deployment.
(() => {
  try {
    const h = location.hostname;
    const local =
      h === 'localhost' || h === '127.0.0.1' || h === '[::1]' || h.endsWith('.localhost');
    if (!local) return;
    document.title = 'DEV · Job Tracker';
    document.getElementById('favicon').setAttribute('href', '/favicon-dev.svg');
  } catch (_e) {}
})();
