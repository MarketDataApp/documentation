import React from 'react';
import clsx from 'clsx';
import {ThemeClassNames} from '@docusaurus/theme-common';
import {useDoc} from '@docusaurus/plugin-content-docs/client';
import TagsListInline from '@theme/TagsListInline';
function TagsRow(props) {
  return (
    <div
      className={clsx(
        ThemeClassNames.docs.docFooterTagsRow,
        'row margin-bottom--sm',
      )}>
      <div className="col">
        <TagsListInline {...props} />
      </div>
    </div>
  );
}
/**
 * Tags only. The last-updated date and the Markdown link used to sit here, and
 * in the breadcrumbs row; both now live in one row under the h1, in
 * `DocItem/MarkdownActions`. Leaving either here would print the same date
 * twice on every page.
 */
export default function DocItemFooter() {
  const {metadata} = useDoc();
  const {tags} = metadata;
  if (tags.length === 0) {
    return null;
  }
  return (
    <footer
      className={clsx(ThemeClassNames.docs.docFooter, 'docusaurus-mt-lg')}>
      <TagsRow tags={tags} />
    </footer>
  );
}
