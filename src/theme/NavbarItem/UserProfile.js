import React, { useState, useEffect } from 'react';
import md5 from 'md5';

// Module-level cache: undefined = not fetched, null = logged out, object = user
// Persists across SPA navigations within the same page session.
let moduleCache;

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

export default function UserProfile() {
  const [user, setUser] = useState(moduleCache);
  const [loaded, setLoaded] = useState(moduleCache !== undefined);

  useEffect(() => {
    // Already have data from module cache — skip fetch
    if (moduleCache !== undefined) return;

    // Check sessionStorage (covers hard refresh within the same tab session)
    const cached = readSessionCache();
    if (cached !== undefined) {
      moduleCache = cached;
      setUser(cached);
      setLoaded(true);
      return;
    }

    fetch('https://dashboard.marketdata.app/api/user/', { credentials: 'include' })
      .then(r => r.json())
      .then(data => {
        const result = data.s === 'ok' ? data : null;
        moduleCache = result;
        writeSessionCache(result);
        setUser(result);
        setLoaded(true);
      })
      .catch(() => {
        moduleCache = null;
        writeSessionCache(null);
        setLoaded(true);
      });
  }, []);

  if (!loaded) return null;

  if (!user) {
    return (
      <a href="https://www.marketdata.app/dashboard/" className="navbar__item navbar__link">
        Log in
      </a>
    );
  }

  const hash = md5(user.email.trim().toLowerCase());
  const avatarUrl = `https://www.gravatar.com/avatar/${hash}?s=32&d=mp`;

  return (
    <a href="https://www.marketdata.app/dashboard/" className="navbar__item navbar-user-profile">
      <img src={avatarUrl} alt={user.login} className="navbar-user-avatar" />
      <span className="navbar-user-name">{user.login}</span>
    </a>
  );
}
