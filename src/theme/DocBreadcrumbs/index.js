import React from "react";
import clsx from "clsx";
import { ThemeClassNames, useWindowSize } from "@docusaurus/theme-common";
import {
  useSidebarBreadcrumbs,
  useHomePageRoute,
  useDoc,
} from "@docusaurus/theme-common/internal";
import Link from "@docusaurus/Link";
import { translate } from "@docusaurus/Translate";
import HomeBreadcrumbItem from "@theme/DocBreadcrumbs/Items/Home";
import EditThisPage from "@theme/EditThisPage";
import styles from "./styles.module.css";
import { getLabelAndTag } from "@site/src/utils/functions";
// TODO move to design system folder
function BreadcrumbsItemLink({ children, href, isLast }) {
  let { label, tag } = getLabelAndTag({ label: children });
  const className = "breadcrumbs__link";
  if (isLast) {
    return (
      <span className={className} itemProp="name">
        {label}
      </span>
    );
  }
  return href ? (
    <Link className={className} href={href} itemProp="item">
      <span itemProp="name">{children}</span>
    </Link>
  ) : (
    // TODO Google search console doesn't like breadcrumb items without href.
    // The schema doesn't seem to require `id` for each `item`, although Google
    // insist to infer one, even if it's invalid. Removing `itemProp="item
    // name"` for now, since I don't know how to properly fix it.
    // See https://github.com/facebook/docusaurus/issues/7241
    <span className={className}>{children}</span>
  );
}
// TODO move to design system folder
function BreadcrumbsItem({ children, active, index, addMicrodata }) {
  return (
    <li
      {...(addMicrodata && {
        itemScope: true,
        itemProp: "itemListElement",
        itemType: "https://schema.org/ListItem",
      })}
      className={clsx("breadcrumbs__item", {
        "breadcrumbs__item--active": active,
      })}>
      {children}
      <meta itemProp="position" content={String(index + 1)} />
    </li>
  );
}
export default function DocBreadcrumbs() {
  const breadcrumbs = useSidebarBreadcrumbs();
  const homePageRoute = useHomePageRoute();
  const { metadata } = useDoc();
  const { editUrl } = metadata;
  const windowSize = useWindowSize();
  const isDesktop = windowSize === "desktop" || windowSize === "ssr";
  
  if (!breadcrumbs) {
    return null;
  }
  return (
    <nav
      className={clsx(
        ThemeClassNames.docs.docBreadcrumbs,
        styles.breadcrumbsContainer
      )}
      aria-label={translate({
        id: "theme.docs.breadcrumbs.navAriaLabel",
        message: "Breadcrumbs",
        description: "The ARIA label for the breadcrumbs",
      })}>
      <div className={styles.breadcrumbsWrapper}>
        <ul
          className="breadcrumbs"
          itemScope
          itemType="https://schema.org/BreadcrumbList">
          {homePageRoute && <HomeBreadcrumbItem />}
          {breadcrumbs.map((item, idx) => {
            const isLast = idx === breadcrumbs.length - 1;
            const href =
              item.type === "category" && item.linkUnlisted
                ? undefined
                : item.href;
            return (
              <BreadcrumbsItem
                key={idx}
                active={isLast}
                index={idx}
                addMicrodata={!!href}>
                <BreadcrumbsItemLink href={href} isLast={isLast}>
                  {item.label}
                </BreadcrumbsItemLink>
              </BreadcrumbsItem>
            );
          })}
        </ul>
        {editUrl && isDesktop && (
          <div className={styles.editThisPageWrapper}>
            <EditThisPage editUrl={editUrl} />
          </div>
        )}
      </div>
    </nav>
  );
}
