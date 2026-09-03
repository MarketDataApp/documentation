import React from "react";
import clsx from "clsx";
import {
  PageMetadata,
  HtmlClassNameProvider,
  ThemeClassNames,
  translateTagsPageTitle,
} from "@docusaurus/theme-common";
import { useActivePlugin } from "@docusaurus/plugin-content-docs/client";
import TagsListByLetter from "@theme/TagsListByLetter";
import SearchMetadata from "@theme/SearchMetadata";
import Heading from "@theme/Heading";

/**
 * Ejected from @docusaurus/theme-classic to name each docs instance's tag
 * index after its own section.
 *
 * Four plugin-content-docs instances share this one component, and the upstream
 * version titles every one of them with `translateTagsPageTitle()` — a single
 * translation string, "Tags". Two instances carry tags today, so
 * /docs/api/tags/ and /docs/sheets/tags/ shipped byte-identical <title>s. That
 * is the duplicate scripts/lint-seo.js rule H1 gates against, and it is the
 * only one that no frontmatter can fix: these pages are generated, so they have
 * no source file to carry a `title:`.
 *
 * The tags themselves are already section-qualified ("API: Premium",
 * "Sheets: Premium"), so the section name is what the page was missing rather
 * than a decoration added for the linter.
 *
 * The instance id is read back from the route because the plugin hands the
 * component only `{tags}`. `useActivePlugin` resolves it from the same route
 * data the sidebar uses. If it ever fails to resolve, the upstream title is the
 * fallback — a wrong-looking title, not a crash.
 *
 * The <h1> is set from the same string as the <title> on purpose: the Markdown
 * twin for a generated route is converted from the built HTML by
 * lib/html-to-md.js, which takes its heading from <title>. Setting one and not
 * the other would make the twin disagree with the page it mirrors.
 */
const SECTION_TITLES = {
  api: "API Tags",
  sdk: "SDK Tags",
  sheets: "Google Sheets Tags",
  account: "Account Tags",
};

function useTagsPageTitle() {
  const activePlugin = useActivePlugin();
  return (
    SECTION_TITLES[activePlugin?.pluginId] ?? translateTagsPageTitle()
  );
}

function DocTagsListPageMetadata({ title }) {
  return (
    <>
      <PageMetadata title={title} />
      <SearchMetadata tag="doc_tags_list" />
    </>
  );
}

function DocTagsListPageContent({ tags, title }) {
  return (
    <HtmlClassNameProvider
      className={clsx(ThemeClassNames.page.docsTagsListPage)}
    >
      <div className="container margin-vert--lg">
        <div className="row">
          <main className="col col--8 col--offset-2">
            <Heading as="h1">{title}</Heading>
            <TagsListByLetter tags={tags} />
          </main>
        </div>
      </div>
    </HtmlClassNameProvider>
  );
}

export default function DocTagsListPage(props) {
  const title = useTagsPageTitle();
  return (
    <>
      <DocTagsListPageMetadata {...props} title={title} />
      <DocTagsListPageContent {...props} title={title} />
    </>
  );
}
