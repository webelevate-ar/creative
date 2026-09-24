// Progressive enhancement only: every feature works without JavaScript.
document.documentElement.classList.add('js');

document.addEventListener('submit', (event) => {
  const form = event.target;
  if (!(form instanceof HTMLFormElement)) return;
  const message = form.getAttribute('data-confirm');
  if (message && !window.confirm(message)) {
    event.preventDefault();
    return;
  }
  // Prevent double submits (the server also rejects repeated applies).
  if (form.classList.contains('is-busy')) {
    event.preventDefault();
    return;
  }
  if ((form.method || 'get').toLowerCase() === 'post') {
    form.classList.add('is-busy');
    const busy = form.getAttribute('data-busy');
    const button = form.querySelector('button[type="submit"]');
    if (busy && button) button.textContent = busy;
  }
});

document.addEventListener('change', (event) => {
  const el = event.target;
  if (el instanceof HTMLSelectElement && el.hasAttribute('data-autosubmit') && el.form) {
    if (typeof el.form.requestSubmit === 'function') el.form.requestSubmit();
    else el.form.submit();
  }
});

document.addEventListener('click', (event) => {
  const el = event.target;
  if (el instanceof Element && el.closest('[data-print]')) window.print();
});

// Browsers restore pages from the back/forward cache with the busy state on; clear it.
window.addEventListener('pageshow', () => {
  document.querySelectorAll('form.is-busy').forEach((f) => f.classList.remove('is-busy'));
});
