import clsx from "clsx";
import React from "react";

function RenderTag({ tag, size = "large" }) {
  switch (tag) {
    case "n":
      return (
        <span
          className={clsx("cus-tag tg-n", size === "small" && "cus-tag-sm")}>
          New
        </span>
      );
    case "p":
      return (
        <span
          className={clsx("cus-tag tg-p", size === "small" && "cus-tag-sm")}>
          Premium
        </span>
      );
    case "h":
      return (
        <span
          className={clsx("cus-tag tg-h", size === "small" && "cus-tag-sm")}>
          High Usage
        </span>
      );
    default:
      return null;
  }
}

export default RenderTag;
