import React from "react";
import { useColorMode } from "@docusaurus/theme-common";

export default function BgCustom(props: JSX.IntrinsicElements["div"]) {
  const { isDarkTheme } = useColorMode();
  return (
    <div
      style={{
        backgroundColor: isDarkTheme ? "#282A36" : "#F8F8F2",
        padding: 8,
        borderRadius: 14,
      }}
    >
      {props.children}
    </div>
  );
}
