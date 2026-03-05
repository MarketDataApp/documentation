import { initNavbarOverflow } from '@marketdataapp/ui/navbar-overflow';

export function onRouteDidUpdate() {
  const container = document.querySelector('.navbar__inner');
  if (!container || container._overflowInit) return;

  container._overflowInit = true;
  initNavbarOverflow({
    container,
    items: [
      // Priority order: lowest number = hidden first
      { selector: '.navbar-user-name', priority: 1 },
      { selector: '.navbar__items--right [class*="colorModeToggle"]', priority: 2 },
      { selector: '.navbar-user-avatar', priority: 3 },
      { selector: '.navbar__items--right .btn-hover-orange', priority: 4 },
      { selector: '.navbar__items--right .DocSearch-Button', priority: 5 },
    ],
  });
}
