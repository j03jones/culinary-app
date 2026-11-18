/* Culinary Arts shell — class switcher + lazy iframes */
(() => {
  'use strict';

  const CLASSES = ['culinary2', 'baking', 'bar'];
  const DEFAULT = 'culinary2';
  const search = (location.search || '').replace(/^\?/, '?');

  const pills = {};
  const frames = {};
  const loading = document.getElementById('frameLoading');

  CLASSES.forEach(id => {
    pills[id] = document.getElementById('tab-' + id);
    frames[id] = document.getElementById('frame-' + id);
  });

  let current = null;

  function isClass(id) { return CLASSES.includes(id); }

  function activate(id, pushHash) {
    if (!isClass(id)) id = DEFAULT;
    if (id === current) return;

    /* unload previous */
    if (current) {
      pills[current].setAttribute('aria-selected', 'false');
      frames[current].classList.remove('active');
    }

    /* load target lazily */
    if (!frames[id].dataset.loaded) {
      loading.classList.add('show');
      frames[id].addEventListener('load', () => {
        loading.classList.remove('show');
      }, { once: true });
      // Trusted first-party content is loaded as srcdoc: published HTML URLs
      // may disallow framing even when they share this app's origin.
      const base = new URL(frames[id].dataset.dir, location.href);
      if (base.origin !== location.origin) throw new Error('Invalid class origin');

      // Inject custom data from localStorage if modified
      let customDataScript = '';
      try {
        const stored = localStorage.getItem('CULINARY_CUSTOM_DATA_' + id);
        if (stored) {
          customDataScript = '<script>window.CUSTOM_DATA=' + stored.replace(/</g, '\\u003c') + ';<\/script>';
        }
      } catch (e) {}

      const preamble = '<base href="' + base.href.replace(/&/g, '&amp;').replace(/"/g, '&quot;') + '">' +
        '<script>window.COURSE_SEARCH=' + JSON.stringify(search).replace(/</g, '\\u003c') + ';<\/script>' +
        customDataScript;
      frames[id].setAttribute('sandbox', 'allow-scripts allow-same-origin');
      frames[id].srcdoc = window.CLASS_PAGES[id].replace('<head>', '<head>' + preamble);
      frames[id].dataset.loaded = '1';
    } else {
      loading.classList.remove('show');
    }

    pills[id].setAttribute('aria-selected', 'true');
    frames[id].classList.add('active');
    current = id;

    if (pushHash !== false) {
      try { history.replaceState(null, '', '#' + id); } catch {}
    }
    document.title = 'Culinary Arts · ' + ({
      culinary2: 'Culinary 2',
      baking: 'Baking & Pastry',
      bar: 'Bar & Beverage'
    }[id]);
  }

  // Reload an iframe when data is updated in the Admin panel
  window.reloadClass = function(id) {
    if (frames[id]) {
      delete frames[id].dataset.loaded;
      frames[id].removeAttribute('data-loaded');
      if (current === id) {
        current = null;
        activate(id, false);
      }
    }
  };

  /* hash routing */
  function fromHash() {
    let h = '';
    try { h = decodeURIComponent((location.hash || '').replace(/^#/, '')); } catch {}
    return isClass(h) ? h : DEFAULT;
  }

  pills.culinary2.addEventListener('click', () => activate('culinary2'));
  pills.baking.addEventListener('click', () => activate('baking'));
  pills.bar.addEventListener('click', () => activate('bar'));
  window.addEventListener('hashchange', () => activate(fromHash(), false));

  /* keyboard navigation across pills */
  document.getElementById('classSwitch').addEventListener('keydown', e => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const i = CLASSES.indexOf(current);
    const next = CLASSES[(i + (e.key === 'ArrowRight' ? 1 : CLASSES.length - 1)) % CLASSES.length];
    pills[next].focus();
    activate(next);
    e.preventDefault();
  });

  activate(fromHash());
})();
