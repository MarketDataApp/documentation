import React from 'react';
import Context7Widget from '@site/src/components/Context7Widget';

// The Cloudflare Zaraz loader used to live here, gated on NODE_ENV. Every
// `yarn build` sets NODE_ENV=production, so staging loaded it too and reported
// into the production GA4 property. It now sits in `docusaurus.config.js`
// under `headTags`, gated on PROD — the only place that can read that flag.
// Do not move it back: the client bundle cannot see `process.env.PROD`.
export default function Root({children}) {
  return (
    <>
      {children}
      <Context7Widget />
    </>
  );
}
