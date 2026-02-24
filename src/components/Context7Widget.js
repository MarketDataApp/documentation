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

/**
 * Monkey-patch attachShadow so we can observe inside closed shadow roots.
 * When the Context7 widget creates its shadow DOM, we capture the root and
 * set up a MutationObserver to rewrite library paths in any new text content.
 */
let _shadowCleanup = null;

function installShadowPatch() {
  if (typeof window === 'undefined') return;
  // Only patch once.
  if (Element.prototype.__c7PatchedAttachShadow) return;

  const origAttachShadow = Element.prototype.attachShadow;
  Element.prototype.attachShadow = function (init) {
    const shadowRoot = origAttachShadow.call(this, {...init, mode: 'open'});

    // Only observe shadow roots created inside the Context7 widget container.
    if (this.closest?.('#context7-widget') || this.id === 'context7-widget') {
      const observer = new MutationObserver(() => rewriteLibraryNames(shadowRoot));
      observer.observe(shadowRoot, {childList: true, subtree: true, characterData: true});
      _shadowCleanup = () => observer.disconnect();
    }

    return shadowRoot;
  };
  Element.prototype.__c7PatchedAttachShadow = true;
}

function uninstallShadowPatch() {
  if (_shadowCleanup) {
    _shadowCleanup();
    _shadowCleanup = null;
  }
}

function injectWidget(widget) {
  cleanupWidget();
  installShadowPatch();

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

// ---------------------------------------------------------------------------
// Chat state detection helpers
// ---------------------------------------------------------------------------

/** Returns true when the chat panel is open AND the user has sent at least one message. */
function isChatEngaged() {
  const container = document.getElementById('context7-widget');
  const sr = container?.shadowRoot;
  if (!sr) return false;

  const panelOpen = sr.querySelector('.c7-panel')?.classList.contains('open');
  const hasUserMessages = sr.querySelectorAll('.c7-msg.user').length > 0;
  return panelOpen && hasUserMessages;
}

/** Returns true when the chat panel is currently open. */
function isPanelOpen() {
  const container = document.getElementById('context7-widget');
  const sr = container?.shadowRoot;
  if (!sr) return false;
  return sr.querySelector('.c7-panel')?.classList.contains('open') ?? false;
}

/**
 * Watch for the chat panel to open for the first time.
 * Calls `callback` once when that happens, then auto-disconnects.
 * Returns a cleanup function to cancel the observer early.
 */
function observePanelOpen(callback) {
  const container = document.getElementById('context7-widget');
  const sr = container?.shadowRoot;
  if (!sr) return () => {};

  const panel = sr.querySelector('.c7-panel');
  if (!panel) return () => {};

  // Already open.
  if (panel.classList.contains('open')) {
    callback();
    return () => {};
  }

  const observer = new MutationObserver(() => {
    if (panel.classList.contains('open')) {
      observer.disconnect();
      callback();
    }
  });

  observer.observe(panel, {attributes: true, attributeFilter: ['class']});
  return () => observer.disconnect();
}

/**
 * Watch for the chat panel to close (`.c7-panel` loses the `open` class).
 * Calls `callback` once when that happens, then auto-disconnects.
 * Returns a cleanup function to cancel the observer early.
 */
function observePanelClose(callback) {
  const container = document.getElementById('context7-widget');
  const sr = container?.shadowRoot;
  if (!sr) return () => {};

  const panel = sr.querySelector('.c7-panel');
  if (!panel) return () => {};

  const observer = new MutationObserver(() => {
    if (!panel.classList.contains('open')) {
      observer.disconnect();
      callback();
    }
  });

  observer.observe(panel, {attributes: true, attributeFilter: ['class']});
  return () => observer.disconnect();
}

/**
 * Update the widget's brand color in-place by rewriting the shadow DOM
 * <style> tag. This avoids destroying & recreating the widget (which would
 * lose any conversation in progress).
 */
function updateWidgetColor(oldColor, newColor) {
  const container = document.getElementById('context7-widget');
  const sr = container?.shadowRoot;
  if (!sr) return;

  const style = sr.querySelector('style');
  if (style && style.textContent.includes(oldColor)) {
    style.textContent = style.textContent.replaceAll(oldColor, newColor);
  }

  // Also update the script tag attribute for consistency.
  const script = document.getElementById('context7-widget-script');
  if (script) {
    script.setAttribute('data-color', newColor);
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function Context7Widget() {
  const {pathname} = useLocation();

  // What's currently rendered in the DOM.
  const activeRef = useRef(null);
  // Widget queued for when the user closes the chat panel.
  const pendingRef = useRef(null);
  // Cleanup fn for the panel-close observer.
  const panelCleanupRef = useRef(null);
  // Cleanup fn for the theme observer.
  const themeCleanupRef = useRef(null);
  // Cleanup fn for the panel-open observer (tracks first open).
  const openObserverCleanupRef = useRef(null);
  // The last color injected (so we can do in-place replacement on theme change).
  const lastColorRef = useRef(null);
  // Whether the user has ever opened the chat panel for the current widget.
  const hasOpenedRef = useRef(false);

  function cancelPanelObserver() {
    if (panelCleanupRef.current) {
      panelCleanupRef.current();
      panelCleanupRef.current = null;
    }
  }

  function cancelThemeObserver() {
    if (themeCleanupRef.current) {
      themeCleanupRef.current();
      themeCleanupRef.current = null;
    }
  }

  function cancelOpenObserver() {
    if (openObserverCleanupRef.current) {
      openObserverCleanupRef.current();
      openObserverCleanupRef.current = null;
    }
  }

  function performSwitch(widget) {
    cancelPanelObserver();
    cancelThemeObserver();
    cancelOpenObserver();
    pendingRef.current = null;
    hasOpenedRef.current = false;

    injectWidget(widget);
    activeRef.current = widget;
    lastColorRef.current = getThemeColor();

    // Watch for the user to open the chat panel for the first time.
    // The widget script loads async, so poll briefly until the shadow DOM is ready.
    let attempts = 0;
    const tryObserve = () => {
      const container = document.getElementById('context7-widget');
      if (container?.shadowRoot?.querySelector('.c7-panel')) {
        openObserverCleanupRef.current = observePanelOpen(() => {
          hasOpenedRef.current = true;
        });
      } else if (attempts < 20) {
        attempts++;
        setTimeout(tryObserve, 250);
      }
    };
    tryObserve();

    // Watch for theme changes — update color in-place instead of re-injecting.
    const themeObserver = new MutationObserver(() => {
      if (!activeRef.current) return;
      const newColor = getThemeColor();
      const oldColor = lastColorRef.current;
      if (oldColor && oldColor !== newColor) {
        updateWidgetColor(oldColor, newColor);
        lastColorRef.current = newColor;
      }
    });
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });
    themeCleanupRef.current = () => themeObserver.disconnect();
  }

  // Main navigation effect — runs on every client-side route change.
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const targetWidget = findWidget(pathname);

    // Same widget as what's active (or both null on initial load): nothing to do.
    if (targetWidget === activeRef.current) {
      return;
    }

    // Navigated to a page with no widget.
    if (targetWidget === null) {
      if (hasOpenedRef.current) {
        // User has interacted with the chat — keep it open (sticky).
        pendingRef.current = null;
        cancelPanelObserver();
      } else {
        // User never opened the chat — clean up so the bubble doesn't linger.
        cancelPanelObserver();
        cancelThemeObserver();
        cancelOpenObserver();
        cleanupWidget();
        activeRef.current = null;
      }
      return;
    }

    // No widget currently active: inject fresh.
    if (activeRef.current === null) {
      performSwitch(targetWidget);
      return;
    }

    // Different widget requested while one is already active.
    if (isChatEngaged()) {
      // User has an active conversation — defer until they close the panel.
      pendingRef.current = targetWidget;
      cancelPanelObserver();
      panelCleanupRef.current = observePanelClose(() => {
        const pending = pendingRef.current;
        pendingRef.current = null;
        if (pending) {
          performSwitch(pending);
        }
      });
    } else {
      // Panel closed or no user messages — safe to switch immediately.
      performSwitch(targetWidget);
    }
  }, [pathname]);

  // Cleanup on unmount.
  useEffect(() => {
    return () => {
      cancelPanelObserver();
      cancelThemeObserver();
      cancelOpenObserver();
      uninstallShadowPatch();
      cleanupWidget();
      activeRef.current = null;
      pendingRef.current = null;
      hasOpenedRef.current = false;
    };
  }, []);

  return null;
}
