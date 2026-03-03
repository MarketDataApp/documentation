import React, { useState, useEffect } from 'react';
import md5 from 'md5';

export default function UserProfile() {
  const [user, setUser] = useState(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch('https://dashboard.marketdata.app/api/user/', { credentials: 'include' })
      .then(r => r.json())
      .then(data => {
        if (data.s === 'ok') setUser(data);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
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
