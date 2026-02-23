import React from 'react';
import Head from '@docusaurus/Head';
import Context7Widget from '@site/src/components/Context7Widget';

export default function Root({children}) {
  return (
    <>
      <Head>
        <script data-cfasync="false" src="/cdn-cgi/zaraz/i.js" referrerPolicy="origin" />
      </Head>
      {children}
      <Context7Widget />
    </>
  );
}
