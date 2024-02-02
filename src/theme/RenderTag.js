import clsx from "clsx";
import React from "react";

/**
 * Renders a tag based on the provided tag identifier.
 * To add new tags, add the letter identifier of the new tag in the switch statement below.
 * 
 * @param {Object} props - The component props.
 * @param {string} props.tag - The tag identifier.
 * @param {string} [props.size="small"] - The size of the tag, defaults to "small".
 * @returns The tag element or null if the tag identifier does not match.
 */
function RenderTag({ tag, size = "small" }) {
  switch (tag) {
    case "n": // For "New" tag
      return (
        <span
          className={clsx("cus-tag tg-n", size === "small" && "cus-tag-sm")}>
          New
        </span>
      );
    case "p": // For "Premium" tag
      return (
        <span
          className={clsx("cus-tag tg-p", size === "small" && "cus-tag-sm")}>
          Premium
        </span>
      );
    case "b": // For "Beta" tag
      return (
        <span
          className={clsx("cus-tag tg-b", size === "small" && "cus-tag-sm")}>
          Beta
        </span>
      );
    case "h": // For "High Usage" tag
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
