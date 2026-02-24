import {useEffect, useRef} from 'react';
import {useLocation} from '@docusaurus/router';

const CONTEXT7_WIDGETS = require('./context7-widgets');

const WIDGET_SRC = 'https://context7.com/widget.js';
const LIGHT_COLOR = '#00419a';
const DARK_COLOR = '#eb5c6d';

function getThemeColor() {
  return document.documentElement.getAttribute('data-theme') === 'dark'
    ? DARK_COLOR
    : LIGHT_COLOR;
}

function findWidget(pathname) {
  return CONTEXT7_WIDGETS.find((w) => w.pathPattern.test(pathname)) || null;
}

function cleanupWidget() {
  const script = document.getElementById('context7-widget-script');
  if (script) script.remove();

  document
    .querySelectorAll('[id*="context7"], [class*="context7"], [id*="c7-"], [class*="c7-"]')
    .forEach((el) => el.remove());
}

/** Build a map of library path → display name for all widgets that have one. */
const DISPLAY_NAME_MAP = Object.fromEntries(
  CONTEXT7_WIDGETS.filter((w) => w.displayName).map((w) => [w.library, w.displayName]),
);

/** Walk text nodes inside `root` and replace raw library paths with friendly names. */
function rewriteLibraryNames(root) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node = walker.currentNode;
    for (const [path, name] of Object.entries(DISPLAY_NAME_MAP)) {
      if (node.nodeValue.includes(path)) {
        node.nodeValue = node.nodeValue.replaceAll(path, name);
      }
    }
  }
}

function injectWidget(widget) {
  cleanupWidget();

  const script = document.createElement('script');
  script.id = 'context7-widget-script';
  script.src = `${WIDGET_SRC}?v=${Date.now()}`;
  script.async = true;
  script.setAttribute('data-library', widget.library);
  script.setAttribute('data-color', getThemeColor());
  script.setAttribute('data-placeholder', widget.placeholder);
  script.setAttribute('data-position', 'bottom-right');
  document.body.appendChild(script);
}

export default function Context7Widget() {
  const {pathname} = useLocation();
  const activeRef = useRef(false);

  const widget = findWidget(pathname);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (!widget) {
      cleanupWidget();
      activeRef.current = false;
      return;
    }

    injectWidget(widget);
    activeRef.current = true;

    // Watch for theme changes (re-inject with correct color).
    const themeObserver = new MutationObserver(() => {
      if (activeRef.current) {
        injectWidget(widget);
      }
    });

    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });

    // Watch for Context7 widget DOM additions and rewrite raw library paths.
    const nameObserver = new MutationObserver((mutations) => {
      for (const m of mutations) {
        for (const node of m.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            rewriteLibraryNames(node);
          }
        }
      }
    });

    nameObserver.observe(document.body, {childList: true, subtree: true});

    return () => {
      themeObserver.disconnect();
      nameObserver.disconnect();
      cleanupWidget();
      activeRef.current = false;
    };
  }, [widget]);

  return null;
}
