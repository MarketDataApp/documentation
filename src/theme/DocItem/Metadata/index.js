import React from "react";
import { PageMetadata } from "@docusaurus/theme-common";
import { useDoc } from "@docusaurus/theme-common/internal";
import { getLabelAndTag } from "@site/src/utils/functions";

export default function DocItemMetadata() {
  const { metadata, frontMatter, assets } = useDoc();
  let { label, tag } = getLabelAndTag({ label: metadata.title || "" });
  return (
    <PageMetadata
      title={label}
      description={metadata.description}
      keywords={frontMatter.keywords}
      image={assets.image ?? frontMatter.image}
    />
  );
}
