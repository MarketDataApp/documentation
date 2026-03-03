#!/usr/bin/env node
/**
 * fix-table-alignment.js
 *
 * Checks and optionally fixes misaligned markdown tables in .md/.mdx files.
 * "Aligned" means every cell in a column is padded to the same width so pipe
 * characters form straight vertical lines in the source.
 *
 * Usage:
 *   node scripts/fix-table-alignment.js           # check mode (exit 1 if misaligned)
 *   node scripts/fix-table-alignment.js --fix     # fix mode (rewrites files in place)
 *
 * Add to CI:
 *   node scripts/fix-table-alignment.js
 */

'use strict';

const fs = require('fs');
const path = require('path');

const FIX_MODE = process.argv.includes('--fix');
const ROOT = path.resolve(__dirname, '..');

// Directories to scan (relative to ROOT)
const SCAN_DIRS = ['docs', 'api', 'sheets', 'sdk', 'account'];
const EXTENSIONS = new Set(['.md', '.mdx']);

// ─── Visual width ─────────────────────────────────────────────────────────────
// Most emoji and symbols render as 2 columns in monospace fonts. We need to
// account for this when computing padding so columns line up visually.

function visualWidth(str) {
  let w = 0;
  for (const char of str) {
    const cp = char.codePointAt(0);
    if (isWide(cp)) {
      w += 2;
    } else {
      w += 1;
    }
  }
  return w;
}

function isWide(cp) {
  // Hangul Jamo
  if (cp >= 0x1100 && cp <= 0x115F) return true;
  // CJK Radicals Supplement … CJK Unified Ideographs Extension B (and beyond)
  if (cp >= 0x2E80 && cp <= 0x9FFF) return true;
  // Hangul Syllables
  if (cp >= 0xAC00 && cp <= 0xD7AF) return true;
  // CJK Compatibility Ideographs
  if (cp >= 0xF900 && cp <= 0xFAFF) return true;
  // Fullwidth Latin / Halfwidth Katakana / Fullwidth Signs
  if (cp >= 0xFF00 && cp <= 0xFF60) return true;
  if (cp >= 0xFFE0 && cp <= 0xFFE6) return true;
  // Miscellaneous Symbols (✅ U+2705) and Dingbats (❌ U+274C)
  if (cp >= 0x2600 && cp <= 0x27BF) return true;
  // Enclosed Alphanumerics, Enclosed CJK, etc.
  if (cp >= 0x2460 && cp <= 0x24FF) return true;
  // Emoji (Miscellaneous Symbols and Pictographs, Transport, etc.)
  if (cp >= 0x1F000) return true;
  return false;
}

/** Pad a string to a target visual width (appending spaces). */
function padEndVisual(str, targetWidth) {
  const spaces = Math.max(0, targetWidth - visualWidth(str));
  return str + ' '.repeat(spaces);
}

// ─── Table parsing ────────────────────────────────────────────────────────────

/** Split a raw table line into trimmed cell strings. */
function parseCells(line) {
  let inner = line.trim();
  if (inner.startsWith('|')) inner = inner.slice(1);
  if (inner.endsWith('|')) inner = inner.slice(0, -1);
  return inner.split('|').map(c => c.trim());
}

/** Return true if all cells look like separator dashes (e.g. `---`, `:---:`, `---:`). */
function isSeparatorRow(cells) {
  return cells.length > 0 && cells.every(c => /^:?-+:?$/.test(c));
}

/** Detect the column alignment encoded in a separator cell. */
function getAlignment(cell) {
  const left = cell.startsWith(':');
  const right = cell.endsWith(':');
  if (left && right) return 'center';
  if (right) return 'right';
  return 'left';
}

/**
 * Format a separator cell so it fills `colVisualWidth + 2` characters
 * (matching the ` content ` format of data cells).
 */
function formatSeparator(alignment, colVisualWidth) {
  const total = colVisualWidth + 2; // +2 for the surrounding spaces
  switch (alignment) {
    case 'center': return ':' + '-'.repeat(total - 2) + ':';
    case 'right':  return '-'.repeat(total - 1) + ':';
    default:       return '-'.repeat(total);
  }
}

/**
 * Re-format a block of consecutive table lines so every column is uniformly
 * padded to the widest cell in that column.
 * Returns the formatted lines (same count as input).
 */
function formatTable(lines) {
  const parsedRows = lines.map(parseCells);
  const isSep = parsedRows.map(isSeparatorRow);

  // Grab alignments from the separator row (if present)
  const sepIdx = isSep.findIndex(Boolean);
  const alignments = sepIdx >= 0 ? parsedRows[sepIdx].map(getAlignment) : [];

  // Number of columns = max across all rows
  const numCols = Math.max(...parsedRows.map(r => r.length));

  // Compute maximum visual width for each column (ignoring separator rows)
  const colWidths = Array(numCols).fill(1); // minimum 1
  for (let i = 0; i < parsedRows.length; i++) {
    if (isSep[i]) continue;
    for (let j = 0; j < parsedRows[i].length; j++) {
      colWidths[j] = Math.max(colWidths[j], visualWidth(parsedRows[i][j]));
    }
  }

  // Rebuild each row
  return lines.map((_, i) => {
    const cells = parsedRows[i];
    const sep = isSep[i];
    const parts = [];

    for (let j = 0; j < numCols; j++) {
      const cell = cells[j] !== undefined ? cells[j] : '';
      if (sep) {
        parts.push(formatSeparator(alignments[j] || 'left', colWidths[j]));
      } else {
        parts.push(' ' + padEndVisual(cell, colWidths[j]) + ' ');
      }
    }

    return '|' + parts.join('|') + '|';
  });
}

// ─── File processing ──────────────────────────────────────────────────────────

const TABLE_LINE = /^\s*\|/;
const FENCE_START = /^\s*(`{3,}|~{3,})/;

/**
 * Process one file: find tables, check/fix alignment.
 * Returns { hasChanges, misalignedCount, newContent }.
 */
function processFile(filePath) {
  const original = fs.readFileSync(filePath, 'utf8');
  const lines = original.split('\n');

  let inFence = false;
  let fenceChar = '';
  const result = [];
  let misalignedCount = 0;
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Track fenced code blocks — don't touch their content
    const fenceMatch = line.match(FENCE_START);
    if (fenceMatch) {
      if (!inFence) {
        inFence = true;
        fenceChar = fenceMatch[1][0];
      } else if (line.trim().startsWith(fenceChar)) {
        inFence = false;
      }
      result.push(line);
      i++;
      continue;
    }

    if (!inFence && TABLE_LINE.test(line)) {
      // Collect the entire table block
      const tableStart = i;
      while (i < lines.length && TABLE_LINE.test(lines[i]) && !lines[i].match(FENCE_START)) {
        i++;
      }
      const tableLines = lines.slice(tableStart, i);
      const formatted = formatTable(tableLines);

      const changed = formatted.some((fl, j) => fl !== tableLines[j]);
      if (changed) misalignedCount++;

      result.push(...formatted);
    } else {
      result.push(line);
      i++;
    }
  }

  const newContent = result.join('\n');
  return {
    hasChanges: newContent !== original,
    misalignedCount,
    newContent,
  };
}

// ─── Directory traversal ──────────────────────────────────────────────────────

function findFiles(dir) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findFiles(full));
    } else if (EXTENSIONS.has(path.extname(entry.name))) {
      results.push(full);
    }
  }
  return results;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

let issues = 0;
let scanned = 0;
let fixed = 0;

for (const dir of SCAN_DIRS) {
  for (const file of findFiles(path.join(ROOT, dir))) {
    scanned++;
    const { hasChanges, misalignedCount, newContent } = processFile(file);
    if (!hasChanges) continue;

    issues++;
    const rel = path.relative(ROOT, file);

    if (FIX_MODE) {
      fs.writeFileSync(file, newContent, 'utf8');
      fixed++;
      console.log(`  fixed  ${rel}  (${misalignedCount} table${misalignedCount > 1 ? 's' : ''})`);
    } else {
      console.log(`  MISALIGNED  ${rel}  (${misalignedCount} table${misalignedCount > 1 ? 's' : ''})`);
    }
  }
}

console.log('');
if (FIX_MODE) {
  console.log(`Scanned ${scanned} file(s). Fixed ${fixed} file(s).`);
} else if (issues === 0) {
  console.log(`All tables aligned across ${scanned} file(s).`);
  process.exit(0);
} else {
  console.log(`Found misaligned tables in ${issues}/${scanned} file(s).`);
  console.log('Run with --fix to auto-align.');
  process.exit(1);
}
