import React from "react";
import clsx from "clsx";
import Link from "@docusaurus/Link";
import { getLabelAndTag } from "@site/src/utils/functions";
export default function PaginatorNavLink(props) {
  const { permalink, title, subLabel, isNext } = props;
  let { label, tag } = getLabelAndTag({ label: title || "" });
  return (
    <Link
      className={clsx(
        "pagination-nav__link",
        isNext ? "pagination-nav__link--next" : "pagination-nav__link--prev"
      )}
      to={permalink}>
      {subLabel && <div className="pagination-nav__sublabel">{subLabel}</div>}
      <div className="pagination-nav__label">{label}</div>
    </Link>
  );
}
