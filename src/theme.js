// Light or dark theme. Loaded in the head so the page never flashes the wrong one.
(function (root) {
  'use strict';

  const KEY = 'alysion-theme';

  // A saved choice wins; otherwise the system setting decides.
  function createTheme({ element, storage, prefersDark }) {
    let saved = null;
    try {
      saved = storage.getItem(KEY);
    } catch {
      /* storage is blocked: follow the system */
    }
    let value = saved === 'dark' || saved === 'light' ? saved : prefersDark ? 'dark' : 'light';
    element.dataset.theme = value;
    return {
      current: () => value,
      toggle() {
        value = value === 'dark' ? 'light' : 'dark';
        element.dataset.theme = value;
        try {
          storage.setItem(KEY, value);
        } catch {
          /* the choice lasts until the page closes */
        }
        return value;
      },
    };
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { createTheme };
    return;
  }
  root.Theme = createTheme({
    element: root.document.documentElement,
    // Reading localStorage itself can throw, so it is only touched inside these calls.
    storage: {
      getItem: (key) => root.localStorage.getItem(key),
      setItem: (key, value) => root.localStorage.setItem(key, value),
    },
    prefersDark: root.matchMedia('(prefers-color-scheme: dark)').matches,
  });
})(globalThis);
