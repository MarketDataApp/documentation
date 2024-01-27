import React from "react";
import clsx from "clsx";
import styles from "./styles.module.css";

import ThemedImage from "@theme/ThemedImage";
import Link from "@docusaurus/Link";

type FeatureItem = {
  title: string;
  image: string;
  description: JSX.Element;
  darkImage: string;
  link: string;
};

const FeatureList: FeatureItem[] = [
  {
    title: "Market Data API",
    image: require("@site/static/img/pngs/api.png").default,
    description: (
      <>
        A complete reference of all Market Data API endpoints, authentication,
        and universal parameters.
      </>
    ),
    darkImage: require("@site/static/img/pngs/api-darkmode.png").default,
    link: "/api",
  },
  {
    title: "Google Sheets Add-On",
    image: require("@site/static/img/pngs/sheets.png").default,
    description: (
      <>
        Learn how to use each Market Data formula in our Add-On with practical
        examples.
      </>
    ),
    darkImage: require("@site/static/img/pngs/sheets-darkmode.png").default,
    link: "/sheets",
  },
  {
    title: "Accounts & Billing",
    image: require("@site/static/img/pngs/billing.png").default,
    description: (
      <>
        Frequently asked questions about your account, our billing rules, and
        administrative information.
      </>
    ),
    darkImage: require("@site/static/img/pngs/billing-darkmode.png").default,
    link: "/account",
  },
];

function Feature({ title, link, image, darkImage, description }: FeatureItem) {
  return (
    <div className={clsx("col col--4")}>
      <Link
        to={link}
        style={{
          textDecoration: "none",
        }}
      >
        <div
          style={{
            marginTop: 24,
            marginBottom: 24,
            padding: 12,
          }}
          className="text--center"
        >
          <ThemedImage
            className={styles.featureSvg}
            alt={title}
            sources={{
              light: image,
              dark: darkImage,
            }}
            style={{
              objectFit: "contain",
              width: "50%",
            }}
          />
        </div>
        <div className="text--center padding-horiz--md">
          <h3>{title}</h3>
          <p>{description}</p>
        </div>
      </Link>{" "}
    </div>
  );
}

export default function HomepageFeatures(): JSX.Element {
  return (
    <section className={styles.features}>
      <div className="container">
        <div className="row">
          {FeatureList.map((props, idx) => (
            <Feature key={idx} {...props} />
          ))}
        </div>
      </div>
    </section>
  );
}
