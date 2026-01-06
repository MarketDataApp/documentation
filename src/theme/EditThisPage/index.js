import React from 'react';
import Link from '@docusaurus/Link';
import IconExternalLink from '@theme/Icon/ExternalLink';
import styles from './styles.module.css';

export default function EditThisPage({editUrl}) {
  if (!editUrl) {
    return null;
  }
  return (
    <Link
      className={styles.editThisPage}
      to={editUrl}
      target="_blank"
      rel="noreferrer noopener">
      <IconExternalLink />
      <span>Get markdown for LLMs</span>
    </Link>
  );
}

