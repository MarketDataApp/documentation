import React from "react";
import clsx from "clsx";
import styles from "./styles.module.css";

import ThemedImage from "@theme/ThemedImage";

type FeatureItem = {
  title: string;
  image: string;
  description: JSX.Element;
  darkImage: string;
};

const FeatureList: FeatureItem[] = [
  {
    title: "Title here",
    image: require("@site/static/img/pngs/api.png").default,
    description: <>description here </>,
    darkImage: require("@site/static/img/pngs/api-darkmode.png").default,
  },
  {
    title: "Title here",
    image: require("@site/static/img/pngs/sheets.png").default,
    description: <>description here </>,
    darkImage: require("@site/static/img/pngs/sheets-darkmode.png").default,
  },
  {
    title: "Title here",
    image: require("@site/static/img/pngs/billing.png").default,
    description: <>description here </>,
    darkImage: require("@site/static/img/pngs/billing-darkmode.png").default,
  },
];

function Feature({ title, image, darkImage, description }: FeatureItem) {
  return (
    <div className={clsx("col col--4")}>
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
