import React, { useRef, useEffect } from 'react';
import { initUserProfile } from '@marketdataapp/ui/user-profile';

export default function UserProfile({ mobile }) {
  const ref = useRef(null);

  useEffect(() => {
    if (mobile) return;
    let cancelled = false;
    let cleanup;
    initUserProfile({
      container: ref.current,
      dropdown: true,
      loginUrl: 'https://www.marketdata.app/dashboard/',
      logoutUrl: 'https://dashboard.marketdata.app/marketdata/logout',
      dashboardUrl: 'https://www.marketdata.app/dashboard/',
      loginText: 'Log in',
    }).then((fn) => {
      if (cancelled) {
        fn();
        return;
      }
      cleanup = fn;
    });
    return () => {
      cancelled = true;
      if (cleanup) cleanup();
    };
  }, [mobile]);

  if (mobile) return null;
  return <div ref={ref} className="user-profile-container" />;
}
