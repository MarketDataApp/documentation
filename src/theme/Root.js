import React from 'react';
import Head from '@docusaurus/Head';
import Context7Widget from '@site/src/components/Context7Widget';

const isProd = process.env.NODE_ENV === 'production';

export default function Root({children}) {
  return (
    <>
      {isProd && (
        <Head>
          <script data-cfasync="false" src="/cdn-cgi/zaraz/i.js" referrerPolicy="origin" />
        </Head>
      )}
      {children}
      <Context7Widget />
    </>
  );
}
