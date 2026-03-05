import React, { useState, useEffect } from 'react';
import md5 from 'md5';
import IconExternalLink from '@theme/Icon/ExternalLink';

// Module-level state persists across SPA navigations within one page session.
let moduleCache;   // undefined = not fetched, null = logged out, object = user
let fetched = false; // true once the API call has completed this session

function readSessionCache() {
  try {
    const raw = sessionStorage.getItem('mda_user');
    if (raw === null) return undefined;
    return raw === 'null' ? null : JSON.parse(raw);
  } catch {
    return undefined;
  }
}

function writeSessionCache(user) {
  try {
    sessionStorage.setItem('mda_user', user === null ? 'null' : JSON.stringify(user));
  } catch {}
}

export default function UserProfile({ mobile }) {
  // Default to null (renders "Log in") so there's no blank gap before the API returns.
  // If we already have cached data, initialize from it immediately.
  const [user, setUser] = useState(moduleCache ?? null);

  useEffect(() => {
    // Stale-while-revalidate: serve cached data immediately, then
    // revalidate in the background so login/logout state changes
    // are picked up without a manual refresh.

    // 1. Serve from cache instantly (no flicker)
    if (moduleCache === undefined) {
      const cached = readSessionCache();
      if (cached !== undefined) {
        moduleCache = cached;
        setUser(cached);
      }
    }

    // 2. Skip fetch on SPA navigations — already revalidated this session
    if (fetched) return;
    fetched = true;

    // 3. Revalidate against the API
    fetch('https://dashboard.marketdata.app/api/user/', { credentials: 'include' })
      .then(r => r.json())
      .then(data => {
        const result = data.s === 'ok' ? data : null;
        moduleCache = result;
        writeSessionCache(result);
        setUser(result);
      })
      .catch(() => {});
  }, []);

  if (mobile) {
    return (
      <li className="menu__list-item">
        <a href="https://www.marketdata.app/dashboard/" className="menu__link" target="_blank" rel="noopener noreferrer">
          {user ? <>Customer Dashboard <IconExternalLink /></> : <>Log in <IconExternalLink /></>}
        </a>
      </li>
    );
  }

  if (!user) {
    return (
      <a href="https://www.marketdata.app/dashboard/" className="btn-hover-orange">
        Log in
      </a>
    );
  }

  const hash = md5(user.email.trim().toLowerCase());
  const avatarUrl = `https://www.gravatar.com/avatar/${hash}?s=32&d=mp`;

  return (
    <>
      <a href="https://www.marketdata.app/dashboard/" className="navbar__item navbar-user-profile">
        <img src={avatarUrl} alt={user.login} className="navbar-user-avatar" />
        <span className="navbar-user-name">{user.login}</span>
      </a>
      <a href="https://dashboard.marketdata.app/marketdata/login" className="btn-hover-orange">
        Log out
      </a>
    </>
  );
}
