/**
 * The metadata row under a doc's h1:
 *
 *     🕐 Last updated Sep 2, 2026  │  ⧉ Copy as Markdown  │  M↓ View as Markdown
 *
 * Ported from `MarkdownActions.astro` on the marketing site so the two halves
 * of the origin present the same control in the same place. That file is Astro
 * + Tailwind and this one is React + CSS modules, so the markup is rewritten
 * and the decisions are carried over. The ones that cost something there:
 *
 *   - The four button states are stacked in one grid cell rather than toggled,
 *     so the button's width never changes mid-click and the row under the
 *     reader's cursor does not move. See styles.module.css.
 *   - The date is not a control. It shares the row's type and spacing so the
 *     three read as one line, and takes no hover, focus ring or radius.
 *   - The copy button checks what it fetched before claiming success. A host
 *     that answers 200 with an error page would otherwise put that on the
 *     clipboard under a "Copied" label.
 *
 * WHERE THE MARKDOWN COMES FROM
 *
 * `plugins/markdown-twins.js` writes every built route's Markdown under three
 * names holding identical bytes. This names `<route>/index.md`, the one that
 * sits beside `index.html`, for the same reason the marketing component names
 * it: it exists for every twinned route, and `postBuild` fails the build when
 * one is missing, so the control cannot outlive the file it points at.
 *
 * `metadata.permalink` carries no trailing slash ("/docs/api/options/chain"),
 * so the join is `${permalink}/index.md`.
 *
 * THE DATE COMES FROM GIT
 *
 * `showLastUpdateTime: true` on each docs plugin makes Docusaurus read the
 * file's last commit. That needs full history at build time — both workflows
 * that build check out with `fetch-depth: 0`. Under a shallow clone every page
 * reports the same date and nothing says so.
 *
 * `formattedLastUpdatedAt` is Docusaurus's own locale-aware rendering. Using it
 * rather than formatting the timestamp here keeps one date format on the site
 * and keeps working if the docs are ever translated.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useDoc } from '@docusaurus/theme-common/internal';
import styles from './styles.module.css';

/** How long an outcome stays on the button before it returns to rest. */
const HOLD_MS = { copied: 3000, error: 6000 };

/**
 * Every twin `markdown-twins.js` writes opens with "# ". Testing for what the
 * file must be, rather than for what an impostor might look like, is the
 * difference between one string and an unbounded list of error-page shapes.
 */
const TWIN_PREFIX = '# ';

function ClockIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={styles.icon} aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm-1 4h2v5h3v2h-5V6Z"
      />
    </svg>
  );
}

/* The back sheet is an L so the two sheets read apart rather than merging into
   one blob at 16px. */
function CopyIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={styles.icon} aria-hidden="true">
      <path d="M6 3h7a2 2 0 0 1 2 2v2H8v9H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" />
      <path d="M11 8h7a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-7a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2Z" />
    </svg>
  );
}

function TickIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={styles.icon} aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm4.707 8.207-5 5a1 1 0 0 1-1.414 0l-2-2a1 1 0 0 1 1.414-1.414L11 13.086l4.293-4.293a1 1 0 0 1 1.414 1.414Z"
      />
    </svg>
  );
}

function WarningIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={styles.icon} aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm0 5a1 1 0 0 1 1 1v5a1 1 0 1 1-2 0V8a1 1 0 0 1 1-1Zm0 11a1.25 1.25 0 1 1 0-2.5 1.25 1.25 0 0 1 0 2.5Z"
      />
    </svg>
  );
}

/* simple-icons' markdown mark, inlined: solid by construction, viewBox 0 0. */
function MarkdownIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={styles.icon} aria-hidden="true">
      <path d="M22.27 19.385H1.73A1.73 1.73 0 0 1 0 17.655V6.345a1.73 1.73 0 0 1 1.73-1.73h20.54A1.73 1.73 0 0 1 24 6.345v11.31a1.73 1.73 0 0 1-1.73 1.73zM5.769 15.923v-4.5l2.308 2.885 2.307-2.885v4.5h2.308V8.078h-2.308l-2.307 2.885-2.308-2.885H3.46v7.845zM21.232 12h-2.309V8.077h-2.307V12h-2.308l3.461 4.039z" />
    </svg>
  );
}

const STATES = {
  idle: { Icon: CopyIcon, label: 'Copy as Markdown' },
  busy: { Icon: CopyIcon, label: 'Copying…' },
  copied: { Icon: TickIcon, label: 'Copied' },
  error: { Icon: WarningIcon, label: 'Copy failed' },
};

function CopyAsMarkdown({ href }) {
  const [state, setState] = useState('idle');
  const [status, setStatus] = useState('');
  const revert = useRef();

  useEffect(() => () => clearTimeout(revert.current), []);

  const settle = useCallback((next, message) => {
    setState(next);
    setStatus(message);
    clearTimeout(revert.current);
    revert.current = setTimeout(() => {
      setState('idle');
      // Cleared on the way back, so the next failure of the same kind is a
      // change and gets announced again rather than swallowed as "same text".
      setStatus('');
    }, HOLD_MS[next]);
  }, []);

  const onClick = useCallback(async () => {
    if (state === 'busy') return;
    clearTimeout(revert.current);
    setState('busy');
    setStatus('');

    // Read the file first and write to the clipboard second, so a 404 is
    // reported as a 404 and never as a clipboard problem.
    let text;
    try {
      const res = await fetch(href, { headers: { Accept: 'text/markdown, text/plain' } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      text = await res.text();
      if (!text.startsWith(TWIN_PREFIX)) throw new Error('not a Markdown twin');
    } catch {
      settle('error', 'The Markdown file could not be loaded. Use View as Markdown to open it.');
      return;
    }

    // `navigator.clipboard` is undefined outside a secure context, and
    // writeText rejects when permission is denied or the document is not
    // focused. Both land here, and both mean: the file is fine, the copy is
    // not, and the link beside this button still works.
    try {
      if (!navigator.clipboard?.writeText) throw new Error('no clipboard API');
      await navigator.clipboard.writeText(text);
    } catch {
      settle(
        'error',
        'This browser would not let the page write to the clipboard. Use View as Markdown to open the file and copy it yourself.',
      );
      return;
    }

    settle('copied', 'This page was copied to the clipboard as Markdown.');
  }, [href, settle, state]);

  return (
    <>
      <button
        type="button"
        className={styles.control}
        data-state={state}
        onClick={onClick}>
        {/* All four labels occupy one grid cell, so the button's width is the
            width of the widest ("Copy as Markdown") at every moment and
            clicking it moves nothing. */}
        <span className={styles.swap}>
          {Object.entries(STATES).map(([name, { Icon, label }]) => (
            <span key={name} className={styles.state} data-state={name}>
              <Icon />
              {label}
            </span>
          ))}
        </span>
      </button>
      {/* A sibling of the button, not a descendant, so its text is never part
          of the button's accessible name. A name change alone is not reliably
          announced when focus is already on the element. */}
      <span className={styles.srOnly} role="status" aria-live="polite">
        {status}
      </span>
    </>
  );
}

export default function MarkdownActions() {
  const { metadata } = useDoc();
  const { permalink, formattedLastUpdatedAt } = metadata;

  if (!permalink) return null;
  const href = `${permalink.replace(/\/$/, '')}/index.md`;

  return (
    <div className={styles.row}>
      <ul className={styles.list}>
        {formattedLastUpdatedAt && (
          <li className={styles.item}>
            {/* Static text, and deliberately not a control: no hover, no focus
                ring, no radius. It shares the row so the three read as one
                line, and stops there. */}
            <span className={styles.meta}>
              <ClockIcon />
              <span>Last updated {formattedLastUpdatedAt}</span>
            </span>
          </li>
        )}
        <li className={styles.item}>
          <CopyAsMarkdown href={href} />
        </li>
        <li className={styles.item}>
          {/* A plain link that needs no JS. It is also the fallback the button
              names when a copy fails, so it must work when script does not.
              `download` is deliberately absent: the reader asked to SEE the
              Markdown, and Pages serves .md as text/markdown. */}
          <a className={styles.control} href={href}>
            <MarkdownIcon />
            View as Markdown
          </a>
        </li>
      </ul>
    </div>
  );
}
