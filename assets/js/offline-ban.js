// Check server connectivity and show a full-page overlay when unreachable.
(function () {
  const HEALTH_URL = 'https://compcustoms-api.onrender.com/api/health';
  const TIMEOUT_MS = 5000;

  function timeout(ms) {
    return new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms));
  }

  function checkServer() {
    return Promise.race([
      fetch(HEALTH_URL, { cache: 'no-store', mode: 'cors' }).then(resp => {
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
    overlay.style.cssText = `
      position: fixed; inset: 0; z-index: 999999;
      display: flex; align-items: center; justify-content: center;
      flex-direction: column; padding: 2rem;
      background: #050B14; color: #f1f5f9;
      font-family: inherit; text-align: center;
    `;

    const content = document.createElement('div');
    content.style.cssText = `
      position: relative; max-width: 420px; width: 100%;
      background: rgba(15, 23, 42, 0.95);
      border: 1px solid #1e293b;
      padding: 2rem; border-radius: 1rem;
      box-shadow: 0 8px 32px rgba(0,0,0,0.4);
    `;
    content.innerHTML = `
      <div style="width:64px;height:64px;margin:0 auto 1.25rem;background:rgba(239,68,68,0.15);border:1px solid rgba(239,68,68,0.3);border-radius:1rem;display:flex;align-items:center;justify-content:center;color:#f87171;">
        <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h.01"/><path d="M8.5 16.429a5 5 0 0 1 7 0"/><path d="M5 12.859a10 10 0 0 1 5.17-2.69"/><path d="M19 12.859a10 10 0 0 0-2.007-1.523"/><path d="M2 8.82a15 15 0 0 1 4.177-2.643"/><path d="M22 8.82a15 15 0 0 0-11.288-3.764"/><path d="m2 2 20 20"/></svg>
      </div>
      <h1 style="margin:0 0 0.75rem; font-size:1.5rem; font-weight:800; color:#fff;">Connection error</h1>
      <p style="margin:0 0 0.5rem; font-size:0.9rem; color:#94a3b8; line-height:1.5;">
        Could not reach the CompCustoms server. The site is temporarily unavailable.
      </p>
      <p style="margin:0 0 1.5rem; font-size:0.8rem; color:#64748b;">
        Please check your connection or try again later.
      </p>
      <button onclick="location.reload()" style="
        width:100%; padding:0.7rem 1rem; background:#2563eb; color:#fff;
        border:none; border-radius:0.75rem; font-weight:700; font-size:0.875rem;
        cursor:pointer;
      ">Try Again</button>
    `;
    overlay.appendChild(content);

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
