import React from 'react';
import Head from '@docusaurus/Head';

export default function Root({children}) {
  return (
    <>
      <Head>
        <script src="/cdn-cgi/zaraz/i.js" referrerPolicy="origin" />
      </Head>
      {children}
    </>
  );
}
