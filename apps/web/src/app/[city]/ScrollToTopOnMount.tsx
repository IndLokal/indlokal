'use client';

import { useEffect } from 'react';

export function ScrollToTopOnMount() {
  useEffect(() => {
    // Guard against browser/client navigation restoring a mid-page scroll position.
    if (window.location.hash) return;
    if (window.scrollY === 0) return;
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, []);

  return null;
}
