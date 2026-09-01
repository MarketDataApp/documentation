'use strict';

/** Directory name to the name people use for the language. */
const SDK_LANGUAGES = {
  go: 'Go',
  py: 'Python',
  js: 'JavaScript',
  csharp: 'C#',
  php: 'PHP',
  java: 'Java',
};

/**
 * Top-level directory to the section it becomes. Anything absent is skipped.
 *
 * "reference" is in two of these names on purpose. The orchestrator splices
 * these sections into the site root's llms.txt, which already has its own
 * "Using the API" and "Google Sheets add-on" sections covering the same
 * products. Naming ours "API reference" and "Google Sheets reference" tells a
 * reader at a glance which is the endpoint documentation and which is the
 * guide, instead of leaving two similarly named sections to be told apart by
 * reading their entries.
 */
const SECTIONS = {
  api: 'API reference',
  sheets: 'Google Sheets reference',
  account: 'Account & Policies',
};

/**
 * The section a route stem belongs to in llms.txt, or null for a route the
 * index skips. A stem is the path under /docs/ with no leading or trailing
 * slash -- the same value markdown-twins calls a stem.
 */
function categoryOf(stem) {
  if (stem === '') return { section: 'Overview', subsection: null };

  const parts = stem.split('/');

  // Tag pages are generated per docs-instance, so they are NESTED under their
  // section -- api/tags/api-premium, sheets/tags/... -- rather than sitting at
  // the top level. Matching only the top-level form let seven of them into the
  // index, filed under API and Google Sheets as though they were real pages.
  // Matched as a whole segment so a page merely named "tagsoup" survives.
  if (parts.includes('tags')) return null;

  if (parts[0] === 'sdk') {
    return { section: 'SDKs', subsection: SDK_LANGUAGES[parts[1]] || null };
  }

  const section = SECTIONS[parts[0]];
  return section ? { section, subsection: null } : null;
}

/** The order sections appear in, whatever order the routes arrive in. */
const SECTION_ORDER = [
  'Overview',
  'API reference',
  'SDKs',
  'Google Sheets reference',
  'Account & Policies',
];

/** A route's Markdown twin URL. The docs root has an empty stem. */
function twinUrl(origin, stem) {
  return stem === '' ? `${origin}/index.md` : `${origin}/${stem}/index.md`;
}

function renderEntry(origin, { stem, title, description }) {
  const link = `- [${title}](${twinUrl(origin, stem)})`;
  return description ? `${link}: ${description}` : link;
}

/**
 * The llms.txt index, in the shape the site root already publishes: a heading,
 * a one-line summary, the Markdown-twin note, then entries grouped by section.
 *
 * Entries whose stem has no category are dropped rather than guessed at. That
 * is how the navigation artifacts -- the tag pages, the search UI and the 404
 * -- stay out of a file an agent reads. They still get Markdown twins;
 * markdown-twins fails the build if any route lacks one. The two lists are
 * deliberately different.
 */
function renderIndex({ entries, origin, title, summary, preamble }) {
  const grouped = new Map();

  for (const entry of disambiguate(entries)) {
    const category = categoryOf(entry.stem);
    if (!category) continue;
    if (!grouped.has(category.section)) grouped.set(category.section, new Map());
    const bySub = grouped.get(category.section);
    const key = category.subsection || '';
    if (!bySub.has(key)) bySub.set(key, []);
    bySub.get(key).push(entry);
  }

  if (grouped.size === 0) {
    throw new Error(
      '[llms-txt] refusing to render an index with no entries. An empty index ' +
        'still parses and still splices, so the loss would only surface as ' +
        'documentation missing from the composed root file.'
    );
  }

  const lines = [`# ${title}`, '', `> ${summary}`, '', preamble];

  for (const section of SECTION_ORDER) {
    const bySub = grouped.get(section);
    if (!bySub) continue;

    lines.push('', `## ${section}`);

    // Entries that sit directly under the section, above any subsection --
    // sdk/sdk-requirements and sdk/postman are the only ones today.
    const direct = bySub.get('') || [];
    if (direct.length) {
      lines.push('');
      for (const entry of direct) lines.push(renderEntry(origin, entry));
    }

    for (const language of Object.values(SDK_LANGUAGES)) {
      const inLanguage = bySub.get(language);
      if (!inLanguage) continue;
      lines.push('', `### ${language}`, '');
      for (const entry of inLanguage) lines.push(renderEntry(origin, entry));
    }
  }

  return `${lines.join('\n')}\n`;
}


/** The five entities Docusaurus emits into a meta description. */
const ENTITIES = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#x27;': "'",
};

function decodeEntities(text) {
  // &amp; last would double-decode "&amp;lt;", so match them in one pass.
  return text.replace(/&(?:amp|lt|gt|quot|#x27);/g, (m) => ENTITIES[m]);
}

/**
 * A page's title, taken from the first heading of its Markdown twin.
 *
 * NOT from the built page's <title>: that carries a " | Market Data Docs"
 * suffix which differs between production and staging, so it would make the
 * two environments' index files differ for no reason that concerns a reader.
 */
function titleFromMarkdown(markdown) {
  // Anchored to the FIRST LINE, not to any line. Every twin opens with its
  // title today, so a /^# /m search would find the same string -- but the
  // corpus also holds ~199 shell comments inside fenced code blocks, and a
  // page that ever opened with prose would take its title from one of them.
  const [first] = markdown.split('\n', 1);
  const match = first.match(/^# (.+)$/);
  return match ? match[1].trim() : '';
}

/**
 * A page's description, from the built HTML's meta tag.
 *
 * Docusaurus synthesises this from the first paragraph when frontmatter does
 * not declare one, which is the case for 257 of 259 source files -- so this is
 * what makes an index with descriptions possible without authoring 257 of them.
 */
function descriptionFromHtml(html) {
  const match = html.match(/<meta[^>]*name="description"[^>]*content="([^"]*)"/);
  return match ? decodeEntities(match[1]).trim() : '';
}


/**
 * The concatenated full text, in the shape the site root's llms-full.txt uses:
 * the page title, a Source line naming its Markdown URL, then the page itself,
 * with pages separated by a horizontal rule.
 *
 * The Source line goes BELOW the title because the twin already opens with it,
 * and a reader scanning for a page wants the heading first. A page with no
 * heading gets the Source line at the top instead of an empty first line.
 */
function renderFull({ entries, origin }) {
  if (entries.length === 0) {
    throw new Error(
      '[llms-txt] refusing to render full text with no entries. Nothing ' +
        'downstream can tell an empty llms-full.txt from a correct one: the ' +
        'marker is found, the splice runs, and the file still parses.'
    );
  }

  const pages = entries.map(({ stem, markdown }) => {
    const source = `Source: ${twinUrl(origin, stem)}`;
    const body = markdown.trimEnd();
    // Same first-line anchoring as titleFromMarkdown, and for the same reason:
    // a fenced `# comment` must never be mistaken for the page heading.
    const heading = titleFromMarkdown(body);

    if (!heading) return `${source}\n\n${body}`;

    // A single-line page has no newline, so indexOf returns -1 and slice(0)
    // would return the heading itself as the body. Three pages are single-line
    // -- the generated Sheets category indexes, whose whole body IS the
    // heading -- and they shipped 50 bytes of duplicate headings before this.
    const breakAt = body.indexOf('\n');
    const rest = breakAt === -1 ? '' : body.slice(breakAt + 1).trimStart();
    return rest ? `# ${heading}\n\n${source}\n\n${rest}` : `# ${heading}\n\n${source}`;
  });

  return `${pages.join('\n\n---\n\n')}\n`;
}

/**
 * The docs root's own heading is the site title, which is
 * "Market Data Docs (staging)" on the staging build. The index heading names
 * the documentation rather than the environment serving it, and this is
 * spliced into a root file where "(staging)" would be noise.
 */
const ROOT_TITLE = 'Market Data Documentation';

/** A page's title for the index, falling back to the stem over an empty link. */
function titleForStem(stem, markdown) {
  if (stem === '') return ROOT_TITLE;
  return titleFromMarkdown(markdown) || stem;
}


/**
 * The line the site root's llms.txt and llms-full.txt carry, and that the
 * orchestrator replaces with our sections. Owned by the website repo; named
 * here only so we can prove we never emit one.
 */
const SPLICE_MARKER = '<!-- docs:llms -->';

/** Tolerant of spacing, because a page quoting the marker may reformat it. */
const SPLICE_MARKER_PATTERN = /<!--\s*docs:llms\s*-->/;

/**
 * Refuse to ship an artifact that carries the splice marker.
 *
 * llms-full.txt is the concatenated body of every page, so a page that quotes
 * the marker -- a page documenting this splice would -- puts a second marker
 * into the file the orchestrator is about to splice. The orchestrator already
 * refuses a root file with more than one marker, so this would surface there as
 * a blocked deploy with the cause in the wrong repo. Catching it at the source
 * names the actual problem: one of our pages contains the string.
 */
function assertNoSpliceMarker(text, filename) {
  if (!SPLICE_MARKER_PATTERN.test(text)) return;
  throw new Error(
    `[llms-txt] ${filename} contains the orchestrator's splice marker ` +
      `("${SPLICE_MARKER}"). One of the indexed pages quotes it, which would ` +
      'put a second marker into the composed root file and block the deploy ' +
      'with the cause reported from another repository. Rewrite the page so it ' +
      'does not contain the literal string.'
  );
}


/** "universal-parameters" -> "Universal Parameters". */
function humanise(segment) {
  return segment
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Qualify titles that collide INSIDE a single section, where the heading
 * cannot tell them apart.
 *
 * 252 entries carry only 130 distinct titles, because every SDK documents the
 * same endpoints and every asset class has a "Candles" and a "Quotes". Most of
 * those repeats are harmless: "Candles" under `### Go` and "Candles" under
 * `### Python` are separated by their headings. Fourteen are NOT -- funds and
 * stocks both have "Candles" within one language, and universal-parameters and
 * utilities both have "Headers" within the API. Those read as duplicate links
 * to different URLs.
 *
 * The parent path segment is what distinguishes them, so it is what gets
 * appended, and ONLY where a collision exists. Qualifying every title would
 * cost every reader a parenthesis to pay for fourteen cases.
 */
function disambiguate(entries) {
  const seen = new Map();

  for (const entry of entries) {
    const category = categoryOf(entry.stem);
    if (!category) continue;
    const key = `${category.section}>${category.subsection || ''}>${entry.title}`;
    seen.set(key, (seen.get(key) || 0) + 1);
  }

  return entries.map((entry) => {
    const category = categoryOf(entry.stem);
    if (!category) return entry;
    const key = `${category.section}>${category.subsection || ''}>${entry.title}`;
    if (seen.get(key) < 2) return entry;

    const parts = entry.stem.split('/');
    const parent = parts[parts.length - 2];
    if (!parent) return entry;
    return { ...entry, title: `${entry.title} (${humanise(parent)})` };
  });
}

module.exports = { categoryOf, renderIndex, renderFull, disambiguate, twinUrl, assertNoSpliceMarker, SPLICE_MARKER, titleForStem, ROOT_TITLE, titleFromMarkdown, descriptionFromHtml, SDK_LANGUAGES, SECTION_ORDER };
