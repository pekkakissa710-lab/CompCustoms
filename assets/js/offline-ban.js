// Check server connectivity and show a full-page overlay ("ban" screen) when unreachable.
// Default health endpoint: /health. Adjust HEALTH_URL if needed.
(function () {
  const HEALTH_URL = '/health';
  const TIMEOUT_MS = 3000;

  function timeout(ms) {
    return new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms));
  }

  function checkServer() {
    return Promise.race([
      fetch(HEALTH_URL, { cache: 'no-store', credentials: 'same-origin' }).then(resp => {
        if (!resp.ok) throw new Error('bad response');
        return true;
      }),
      timeout(TIMEOUT_MS)
    ]);
  }

  function makeOverlay() {
    if (document.getElementById('offline-ban-overlay')) return;

    const overlay = document.createElement('div');
    overlay.id = 'offline-ban-overlay';
    overlay.setAttribute('role', 'alertdialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.style.position = 'fixed';
    overlay.style.inset = '0';
    overlay.style.zIndex = '999999';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.flexDirection = 'column';
    overlay.style.padding = '2rem';
    overlay.style.background = getComputedStyle(document.body).backgroundColor || '#000';
    overlay.style.color = getComputedStyle(document.body).color || '#fff';
    overlay.style.fontFamily = getComputedStyle(document.body).fontFamily || 'inherit';
    overlay.style.textAlign = 'center';

    const backdrop = document.createElement('div');
    backdrop.style.position = 'absolute';
    backdrop.style.inset = '0';
    backdrop.style.background = 'rgba(0,0,0,0.45)';
    overlay.appendChild(backdrop);

    const content = document.createElement('div');
    content.style.position = 'relative';
    content.style.maxWidth = '960px';
    content.style.width = '100%';
    content.style.background = 'rgba(13,21,39,0.85)';
    content.style.padding = '2rem';
    content.style.borderRadius = '12px';
    content.style.boxShadow = '0 8px 32px rgba(0,0,0,0.3)';
    content.style.backdropFilter = 'blur(4px)';
    content.style.color = 'inherit';
    content.innerHTML = `
      <h1 style="margin:0 0 1rem; font-size:1.75rem; font-weight:800;">Connection error — site unavailable</h1>
      <p style="margin:0 0 1rem; font-size:1rem; color:rgba(203,213,225,0.9);">
        This site requires a server connection to function. A connection to the server could not be established,
        so the site is unusable at this time.
      </p>
      <p style="margin:0; font-size:0.9rem; opacity:0.9;">
        Please check your network connection or try again later.
      </p>
    `;
    overlay.appendChild(content);

    // Hide underlying content from assistive tech
    document.querySelectorAll('body > *').forEach(el => {
      if (el.id !== 'offline-ban-overlay') el.setAttribute('aria-hidden', 'true');
    });

    document.body.appendChild(overlay);
  }

  function init() {
    checkServer().catch(() => {
      makeOverlay();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
