'use strict';

const ADMONITION_MAP = {
  note: 'NOTE',
  tip: 'TIP',
  info: 'NOTE',
  important: 'IMPORTANT',
  warning: 'WARNING',
  caution: 'CAUTION',
  danger: 'CAUTION',
};

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n*/;
const MDX_COMMENT_RE = /\{\s*\/\*[\s\S]*?\*\/\s*\}/g;
const IMPORT_FROM_RE = /^import\b[^\n]*?\bfrom\s+["'][^"'\n]+["'];?[ \t]*$/gm;
const IMPORT_BARE_RE = /^import\s+["'][^"'\n]+["'];?[ \t]*$/gm;
const TABS_OPEN_RE = /<Tabs\b[^>]*>[ \t]*\n?/g;
const TABS_CLOSE_RE = /<\/Tabs>[ \t]*\n?/g;
const TABITEM_OPEN_RE = /<TabItem\b[^>]*?\blabel="([^"]+)"[^>]*>[ \t]*\n?/g;
const TABITEM_CLOSE_RE = /<\/TabItem>[ \t]*\n?/g;
const DOCCARDLIST_SELF_RE = /<DocCardList\b[^>]*\/>[ \t]*\n?/g;
const DOCCARDLIST_PAIRED_RE = /<DocCardList\b[^>]*>[\s\S]*?<\/DocCardList>[ \t]*\n?/g;
const USECURRENT_SIDEBAR_RE = /<useCurrentSidebarCategory\b[^>]*\/>[ \t]*\n?/g;
const JSX_STYLE_RE = /\s+style=\{\{[^}]*\}\}/g;
// Link label may contain: non-special chars, inline code spans `...`, or balanced [...]
const LINK_RE = /(!?)\[((?:[^\[\]`]|`[^`]*`|\[[^\]]*\])*)\]\(([^)\s]+)\)/g;
const FENCE_OPEN_RE = /^([ \t]*)(`{3,}|~{3,})(.*)$/;
const ADMONITION_OPEN_RE = /^:::(\w+)(.*)$/;
const ADMONITION_CLOSE_RE = /^:::[ \t]*$/;

function extractTitle(frontmatter) {
  const m = frontmatter.match(/^title:\s*(.+)$/m);
  if (!m) return null;
  return m[1].trim().replace(/^["']|["']$/g, '');
}

// Compute a relative path from one repo-relative POSIX file to another,
// collapsing the common prefix so siblings get './x.md' instead of '../dir/x.md'.
function relativePath(fromFile, toFile) {
  const fromParts = fromFile.split('/').slice(0, -1); // directory of source
  const toParts = toFile.split('/');
  let i = 0;
  while (i < fromParts.length && i < toParts.length - 1 && fromParts[i] === toParts[i]) {
    i++;
  }
  const ups = fromParts.length - i;
  const rest = toParts.slice(i).join('/');
  const prefix = ups === 0 ? './' : '../'.repeat(ups);
  return prefix + rest;
}

function resolveSameSdkLink(sourcePath, sdkBase, targetSub, linkTargets) {
  const cleanedSub = targetSub.replace(/\/$/, '');
  // If the CLI gave us a source-aware target map, use it. This is the only
  // way to disambiguate "/sdk/js/funds" (a directory → funds/README.md) from
  // "/sdk/js/client" (a file → client.md) without false guesses.
  if (linkTargets && linkTargets[cleanedSub]) {
    const srcOutput = sourcePath
      .slice(sdkBase.length + 1)
      .replace(/\.mdx$/, '.md');
    return relativePath(srcOutput, linkTargets[cleanedSub]);
  }
  // Fallback for callers that don't supply a target map: assume "foo" → "foo.md".
  // Worker/LLM-bundle paths use absolute URLs instead and never hit this.
  const srcRelative = sourcePath.startsWith(sdkBase + '/')
    ? sourcePath.slice(sdkBase.length + 1)
    : sourcePath;
  const lastSlash = srcRelative.lastIndexOf('/');
  const srcDir = lastSlash >= 0 ? srcRelative.slice(0, lastSlash) : '';
  const depth = srcDir ? srcDir.split('/').length : 0;
  const up = depth === 0 ? './' : '../'.repeat(depth);
  const target = cleanedSub === '' ? 'index' : cleanedSub;
  return up + target + '.md';
}

function rewriteHref(href, opts) {
  if (/^(https?:|mailto:|tel:|#)/i.test(href)) return href;
  if (!href.startsWith('/')) return href;

  const { sourcePath, sdk, baseUrl, linkTargets } = opts;

  const hashIdx = href.indexOf('#');
  const pathPart = hashIdx >= 0 ? href.slice(0, hashIdx) : href;
  const anchor = hashIdx >= 0 ? href.slice(hashIdx) : '';

  if (sdk && sourcePath) {
    const sdkPrefix = `/sdk/${sdk}/`;
    const sdkRoot = `/sdk/${sdk}`;
    if (pathPart === sdkRoot || pathPart === sdkRoot + '/') {
      return resolveSameSdkLink(sourcePath, `sdk/${sdk}`, '', linkTargets) + anchor;
    }
    if (pathPart.startsWith(sdkPrefix)) {
      const sub = pathPart.slice(sdkPrefix.length);
      return resolveSameSdkLink(sourcePath, `sdk/${sdk}`, sub, linkTargets) + anchor;
    }
  }

  return baseUrl + href;
}

function transformProse(text, opts) {
  text = text.replace(MDX_COMMENT_RE, '');
  text = text.replace(IMPORT_FROM_RE, '');
  text = text.replace(IMPORT_BARE_RE, '');
  text = text.replace(TABS_OPEN_RE, '');
  text = text.replace(TABS_CLOSE_RE, '');
  text = text.replace(TABITEM_OPEN_RE, '### $1\n\n');
  text = text.replace(TABITEM_CLOSE_RE, '\n\n');
  text = text.replace(DOCCARDLIST_PAIRED_RE, '');
  text = text.replace(DOCCARDLIST_SELF_RE, '');
  text = text.replace(USECURRENT_SIDEBAR_RE, '');
  text = text.replace(JSX_STYLE_RE, '');
  text = text.replace(LINK_RE, (_, bang, label, href) => {
    return `${bang}[${label}](${rewriteHref(href, opts)})`;
  });
  return text;
}

function isFenceClose(line, marker) {
  const trimmed = line.trim();
  if (trimmed.length < marker.length) return false;
  const ch = marker[0];
  for (let i = 0; i < trimmed.length; i++) {
    if (trimmed[i] !== ch) return false;
  }
  return true;
}

function tokenize(text) {
  const lines = text.split('\n');
  const tokens = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    const fenceMatch = line.match(FENCE_OPEN_RE);
    if (fenceMatch) {
      const marker = fenceMatch[2];
      const fenceLines = [line];
      i++;
      while (i < lines.length) {
        fenceLines.push(lines[i]);
        if (isFenceClose(lines[i], marker)) { i++; break; }
        i++;
      }
      tokens.push({ type: 'fence', text: fenceLines.join('\n') });
      continue;
    }

    const admMatch = line.match(ADMONITION_OPEN_RE);
    if (admMatch && admMatch[1].toLowerCase() in ADMONITION_MAP) {
      const kind = admMatch[1];
      const title = admMatch[2].trim();
      i++;
      const bodyLines = [];
      let closed = false;
      while (i < lines.length) {
        const l = lines[i];
        if (ADMONITION_CLOSE_RE.test(l)) { i++; closed = true; break; }
        bodyLines.push(l);
        i++;
      }
      if (!closed) {
        // No closing fence — treat opening as literal prose
        tokens.push({ type: 'prose-line', text: line });
        // Re-process the body lines normally
        for (const bl of bodyLines) tokens.push({ type: 'prose-line', text: bl });
        continue;
      }
      tokens.push({ type: 'admonition', kind, title, body: bodyLines.join('\n') });
      continue;
    }

    tokens.push({ type: 'prose-line', text: line });
    i++;
  }
  return tokens;
}

function renderAdmonition({ kind, title, body }, opts) {
  const alert = ADMONITION_MAP[kind.toLowerCase()] || 'NOTE';
  const innerProcessed = renderTokens(tokenize(body), opts).replace(/\s+$/, '');
  const bodyLines = innerProcessed.split('\n').map((l) => (l === '' ? '>' : `> ${l}`));
  const out = [`> [!${alert}]`];
  if (title) {
    out.push(`> **${title}**`);
    out.push('>');
  }
  for (const l of bodyLines) out.push(l);
  return out.join('\n');
}

function renderTokens(tokens, opts) {
  const out = [];
  let proseGroup = [];

  function flushProse() {
    if (proseGroup.length === 0) return;
    const text = proseGroup.join('\n');
    out.push(transformProse(text, opts));
    proseGroup = [];
  }

  for (const tok of tokens) {
    if (tok.type === 'prose-line') {
      proseGroup.push(tok.text);
    } else if (tok.type === 'fence') {
      flushProse();
      out.push(tok.text);
    } else if (tok.type === 'admonition') {
      flushProse();
      out.push(renderAdmonition(tok, opts));
    }
  }
  flushProse();
  return out.join('\n');
}

function cleanMdx(text, opts = {}) {
  const o = {
    sourcePath: opts.sourcePath ?? null,
    sdk: opts.sdk ?? null,
    baseUrl: opts.baseUrl ?? 'https://www.marketdata.app/docs',
    // Map of Docusaurus subpath (no leading slash, no trailing slash) → repo-relative
    // output file. Only consulted for same-SDK link rewriting. CLI builds this from
    // the source tree; worker / LLM-bundle leave it unset.
    linkTargets: opts.linkTargets ?? null,
  };

  let title = null;
  const fm = text.match(FRONTMATTER_RE);
  if (fm) {
    title = extractTitle(fm[1]);
    text = text.slice(fm[0].length);
  }

  let result = renderTokens(tokenize(text), o);

  if (title) {
    result = `# ${title}\n\n` + result.replace(/^\s+/, '');
  }

  result = result.replace(/\n{3,}/g, '\n\n').trim() + '\n';
  return result;
}

module.exports = { cleanMdx };
