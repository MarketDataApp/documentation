import { initNavbarOverflow } from '@marketdataapp/ui/navbar-overflow';

const ITEMS = [
  // Priority order: lowest number = hidden first
  { selector: '.navbar__items--right [class*="colorModeToggle"]', priority: 1 },
  { selector: '.user-profile-container', priority: 2 },
  { selector: '.navbar__items--right .DocSearch-Button', priority: 3 },
];

export function onRouteDidUpdate() {
  const container = document.querySelector('.navbar__inner');
  if (!container || container._overflowInit) return;

  container._overflowInit = true;
  let cleanup = initNavbarOverflow({ container, items: ITEMS });

  // The overflow utility's ResizeObserver only fires when the container
  // itself resizes, but async-loaded components (e.g. user profile) can
  // add content without changing the container's dimensions. Watch for
  // child-list mutations and re-initialize to trigger a fresh reflow.
  let debounce;
  new MutationObserver(() => {
    clearTimeout(debounce);
    debounce = setTimeout(() => {
      cleanup();
      cleanup = initNavbarOverflow({ container, items: ITEMS });
    }, 100);
  }).observe(container, { childList: true, subtree: true });
}
